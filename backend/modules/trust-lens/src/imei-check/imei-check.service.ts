import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Mask all but the last 4 digits of an IMEI for safe logging. */
function maskImei(imei?: string): string {
  if (!imei || imei.length < 4) return '****';
  return `${'*'.repeat(imei.length - 4)}${imei.slice(-4)}`;
}

export interface ImeiCheckResult {
  imeiValid: boolean;
  icloudLocked: boolean;
  reportedStolen: boolean;
  blacklisted: boolean;
  deviceModel?: string;
  deviceColor?: string;
  deviceStorage?: string;
  fmiOn?: boolean;
  rawApiResponse: Record<string, unknown>;
  flags: string[];
  checksRun: string[];
  /** Brand reported by the GSMA lookup (e.g. "Nokia"), if any. */
  reportedBrand?: string;
  /** Provider fraud-risk score (0–100), if reported. */
  fraudRiskScore?: number;
}

/** Fraud-risk score at/above which a listing is never auto-approved. */
export const FRAUD_RISK_REVIEW_THRESHOLD = 70;

/** Convert the provider's HTML `result` string into plain text lines. */
function htmlToText(input: unknown): string {
  return String(input ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Value of a "Label: value" line in provider text, lowercased and trimmed. */
function labeledValue(text: string, label: string): string | undefined {
  const match = new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, 'im').exec(text);
  return match ? match[1].trim().toLowerCase() : undefined;
}

/** True for affirmative provider values (true / 1 / "yes" / "blacklisted" …). */
function isAffirmative(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value !== 'string') return false;
  return ['true', 'yes', 'blacklisted', 'blocked', 'locked', 'stolen', 'reported'].includes(
    value.trim().toLowerCase(),
  );
}

interface ImeiApiResponse {
  orderId: number;
  status: 'success' | 'failed' | 'error';
  imei: string;
  price: string;
  result?: string;
  object?: Record<string, unknown>;
}

@Injectable()
export class ImeiCheckService {
  private readonly logger = new Logger(ImeiCheckService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiUrl = this.configService.get<string>(
      'IMEI_CHECK_API_URL',
      'https://alpha.imeicheck.com',
    );
    this.apiKey = this.configService.get<string>('IMEI_CHECK_API_KEY', '');
  }

  /**
   * Brand-specific imeicheck.com service IDs (from the account dashboard).
   * Each entry maps a normalised brand to [serviceId, checksRunLabel].
   * The GSMA blacklist (service 5) is always run on top as a universal safety
   * net, so these are only the "extra" brand-specific lookups.
   */
  private static readonly BRAND_SERVICES: {
    matches: string[];
    serviceId: number;
    label: string;
  }[] = [
    {
      matches: ['samsung', 'galaxy'],
      serviceId: 21, // Samsung Info & KNOX GUARD
      label: 'samsung_knox',
    },
    {
      matches: ['xiaomi', 'redmi', 'poco', 'mi '],
      serviceId: 25, // Xiaomi MI LOCK & INFO
      label: 'xiaomi_info',
    },
    {
      matches: ['oneplus', 'one plus'],
      serviceId: 27, // OnePlus IMEI INFO
      label: 'oneplus_info',
    },
    {
      matches: ['honor'],
      serviceId: 58, // Honor Info
      label: 'honor_info',
    },
    {
      matches: ['motorola', 'moto'],
      serviceId: 63, // Motorola Info
      label: 'motorola_info',
    },
    {
      matches: ['google', 'pixel'],
      serviceId: 72, // Google Pixel Info + Warranty
      label: 'google_pixel_info',
    },
  ];

  /** GSMA blacklist service — brand-agnostic, always used as a safety net. */
  private static readonly BLACKLIST_SERVICE = 5;

  /**
   * Returns true if the brand string indicates an Apple device.
   * Handles common casing/spacing variations (e.g. "apple", "Apple", "APPLE").
   */
  private isAppleBrand(brand?: string): boolean {
    if (!brand) return false;
    return brand.trim().toLowerCase() === 'apple';
  }

  /** Normalise a free-form brand string (lowercase, trimmed, no diacritics). */
  private normalizeBrand(brand?: string): string {
    return (brand ?? '').trim().toLowerCase();
  }

  /**
   * Resolve a free-form brand string to its brand-specific imeicheck service,
   * if we have one configured. Returns null for unknown/unsupported brands.
   */
  private resolveBrandService(brand?: string): { serviceId: number; label: string } | null {
    const normalized = this.normalizeBrand(brand);
    if (!normalized) return null;
    for (const entry of ImeiCheckService.BRAND_SERVICES) {
      if (entry.matches.some((m) => normalized.includes(m))) {
        return { serviceId: entry.serviceId, label: entry.label };
      }
    }
    return null;
  }

  /**
   * Run IMEI checks in parallel, with brand-aware service selection:
   *
   *   Apple     → service 3 (Apple Full Info — iCloud/FMI lock, model info) + service 5
   *               (GSMA blacklist, kept live so a change in blacklist state stays current)
   *   Samsung   → service 21 (Info & KNOX GUARD) + service 5 (GSMA blacklist)
   *   Xiaomi    → service 25 (MI LOCK & INFO) + service 5
   *   OnePlus   → service 27 (IMEI INFO) + service 5
   *   Honor     → service 58 (Info) + service 5
   *   Motorola  → service 63 (Info) + service 5
   *   Google    → service 72 (Pixel Info + Warranty) + service 5
   *   All others→ service 5 only (GSMA blacklist — brand-agnostic)
   *
   * The GSMA blacklist (service 5) is the universal safety net for every non-Apple
   * device, so a brand is never left unchecked even when no specific lookup exists.
   *
   * Never throws — on error returns a safe default with the error captured in rawApiResponse.
   */
  async checkImei(imei: string, brand?: string): Promise<ImeiCheckResult> {
    if (!this.apiKey) {
      this.logger.error(
        'CRITICAL: IMEI_CHECK_API_KEY is not set — all IMEI checks will return NOT_RUN. ' +
          'Set IMEI_CHECK_API_KEY in your backend environment variables on Render.',
      );
      return this.buildDefaultResult({ error: 'API key not configured' });
    }

    const apple = this.isAppleBrand(brand);
    const brandService = apple ? null : this.resolveBrandService(brand);
    this.logger.log(
      `Running IMEI checks for ${brand ?? 'unknown brand'} (apple=${apple}, brandService=${brandService?.label ?? 'none'}), IMEI ${maskImei(imei)}`,
    );

    const raw: Record<string, unknown> = {};
    const checksRun: string[] = [];

    let deviceModel: string | undefined;
    let deviceColor: string | undefined;
    let deviceStorage: string | undefined;
    let fmiOn: boolean | undefined;
    let icloudLocked = false;
    let blacklisted = false;
    let reportedStolen = false;
    // Brand-specific soft locks (e.g. Samsung Knox Guard, Xiaomi MI Lock). These
    // surface as REQUIRES_REVIEW flags but do NOT make the IMEI "invalid".
    let brandLocked = false;
    let brandLockFlag: string | null = null;
    let reportedBrand: string | undefined;
    let fraudRiskScore: number | undefined;
    // The provider says the device is not the brand the seller claimed.
    let brandMismatch = false;

    if (apple) {
      // --- Apple: run services 3 + 5 in parallel (service 4 iCloud check is
      // redundant — Apple Full Info already returns iCloud/FMI lock state). ---
      checksRun.push('apple_full_info', 'gsma_blacklist');

      const [service3, service5] = await Promise.allSettled([
        this.callService(3, imei), // Apple Full Info [No Carrier] — $0.07
        this.callService(5, imei), // Blacklist Status (GSMA)      — $0.02, kept live
      ]);

      // Service 3 — Apple Full Info (device model + iCloud/FMI lock state)
      if (service3.status === 'fulfilled') {
        raw['service3'] = service3.value;
        const obj = service3.value.object;
        if (obj) {
          deviceModel = (obj['model'] as string) ?? undefined;
          deviceColor = (obj['color'] as string) ?? undefined;
          deviceStorage = (obj['storage'] as string) ?? undefined;

          if (obj['fmiOn'] !== undefined) fmiOn = Boolean(obj['fmiOn']);
          if (obj['fmiON'] !== undefined) fmiOn = Boolean(obj['fmiON']);

          // iCloud / Activation Lock — the definitive lock state. This is NOT
          // the same as Find My iPhone (FMI) being ON, which is a normal state
          // on a clean, legitimately-owned device. Only an actual iCloud /
          // activation-lock / lost-mode signal means the device is locked.
          const lockVal =
            obj['icloudLock'] ?? obj['icloud_lock'] ?? obj['iCloudLock'] ??
            obj['activationLock'] ?? obj['activation_lock'] ?? obj['lostMode'] ?? obj['lost_mode'];
          if (lockVal === true || lockVal === 'true' || lockVal === 1 || lockVal === 'locked') {
            icloudLocked = true;
          } else if (lockVal !== undefined && lockVal !== null) {
            const lockStr = String(lockVal).toLowerCase();
            if (lockStr === 'locked' || lockStr === 'on' || lockStr === 'true' || lockStr === 'yes') {
              icloudLocked = true;
            }
          }

          // Service 3 can also surface blacklist/stolen state; merge it with the
          // GSMA result so both sources are captured.
          const objBlacklist = obj['blacklisted'] ?? obj['blacklist'];
          if (objBlacklist === true || objBlacklist === 'true' || objBlacklist === 1) blacklisted = true;
          const objStolen = obj['stolen'] ?? obj['reportedStolen'] ?? obj['reported_stolen'];
          if (objStolen === true || objStolen === 'true' || objStolen === 1) reportedStolen = true;
        }
        const s3result = this.statusValue(service3.value.result);
        if (this.isBlocked(s3result)) blacklisted = true;
        if (this.isStolen(s3result)) reportedStolen = true;
        if (
          service3.value.status === 'failed' &&
          /only apple devices supported/i.test(String(service3.value.result ?? ''))
        ) {
          brandMismatch = true;
        }
      } else {
        this.logger.warn(`ImeiCheck service 3 failed: ${String(service3.reason)}`);
        raw['service3Error'] = String(service3.reason);
      }

      // NOTE: Find My iPhone being ON is NOT treated as iCloud-locked. FMI ON is
      // a normal, expected state on a clean owned device; only an iCloud /
      // activation lock above means the device is actually locked.

      // Service 5 — GSMA Blacklist (brand-agnostic live safety net)
      if (service5.status === 'fulfilled') {
        raw['service5'] = service5.value;
        ({ blacklisted, reportedStolen, reportedBrand, fraudRiskScore } = this.parseBlacklistResult(
          service5.value,
          blacklisted,
          reportedStolen,
        ));
      } else {
        this.logger.warn(`ImeiCheck service 5 failed: ${String(service5.reason)}`);
        raw['service5Error'] = String(service5.reason);
      }
    } else {
      // --- Non-Apple: run the brand-specific service (if known) + GSMA blacklist ---
      const label = brandService?.label ?? 'gsma_blacklist';
      checksRun.push(label, 'gsma_blacklist');
      raw['brand'] = brand ?? 'unknown';

      const [brandCall, service5] = await Promise.allSettled([
        brandService ? this.callService(brandService.serviceId, imei) : Promise.resolve(undefined),
        this.callService(ImeiCheckService.BLACKLIST_SERVICE, imei),
      ]);

      if (brandService) {
        const key = `service${brandService.serviceId}`;
        if (brandCall.status === 'fulfilled' && brandCall.value) {
          const brandResult = brandCall.value;
          raw[key] = brandResult;
          const obj = brandResult.object;
          if (obj) {
            deviceModel = (obj['model'] as string) ?? (obj['modelName'] as string) ?? undefined;
            deviceColor = (obj['color'] as string) ?? undefined;
            deviceStorage = (obj['storage'] as string) ?? undefined;
          }
          // Brand-specific lock detection (Samsung Knox Guard, Xiaomi MI Lock, etc.)
          brandLocked = this.parseBrandLock(brandService.label, brandResult.object ?? (brandResult as unknown as Record<string, unknown>));
          if (brandLocked) brandLockFlag = this.brandLockFlagFor(brandService.label);
        } else if (brandCall.status === 'rejected') {
          this.logger.warn(`ImeiCheck service ${brandService.serviceId} (${brandService.label}) failed: ${String(brandCall.reason)}`);
          raw[`service${brandService.serviceId}Error`] = String(brandCall.reason);
        }
      }

      // GSMA blacklist — brand-agnostic safety net
      if (service5.status === 'fulfilled') {
        raw['service5'] = service5.value;
        ({ blacklisted, reportedStolen, reportedBrand, fraudRiskScore } = this.parseBlacklistResult(
          service5.value,
          blacklisted,
          reportedStolen,
        ));
      } else {
        this.logger.warn(`ImeiCheck service 5 (non-Apple) failed: ${String(service5.reason)}`);
        raw['service5Error'] = String(service5.reason);
      }
    }

    // Build integrity flags. Only report CLEAN when at least one check actually
    // ran and found nothing wrong. If every service errored (e.g. invalid IMEI
    // or upstream failure) we must NOT auto-approve — route to NOT_RUN so the
    // request stays PENDING for manual review instead of falsely PASSING.
    const flags: string[] = [];
    if (icloudLocked) flags.push('ICLOUD_LOCKED');
    if (reportedStolen) flags.push('REPORTED_STOLEN');
    if (blacklisted) flags.push('BLACKLISTED');
    if (brandLocked && brandLockFlag) flags.push(brandLockFlag);

    // The IMEI must belong to the brand the seller listed. A mismatch means the
    // identifier was copied from another device — never auto-approve it.
    const claimed = this.normalizeBrand(brand);
    const reported = this.normalizeBrand(reportedBrand);
    if (claimed && reported && !['na', 'n/a', 'unknown'].includes(reported) && claimed !== reported) {
      brandMismatch = true;
    }
    if (brandMismatch) flags.push('IMEI_MISMATCH');

    // High provider fraud score (cloning / suspicious resale) → manual review.
    if (fraudRiskScore !== undefined && fraudRiskScore >= FRAUD_RISK_REVIEW_THRESHOLD) {
      flags.push('HIGH_FRAUD_RISK');
    }

    // Check if any service reported an explicitly invalid IMEI / SN
    const isExplicitlyInvalidImei = (val: unknown): boolean => {
      if (!val || typeof val !== 'object') return false;
      const resp = val as Record<string, unknown>;
      const text = String(resp.response ?? resp.result ?? '').toLowerCase();
      return resp.status === 'failed' && (text.includes('invalid') || text.includes('not found'));
      // ("Only Apple devices supported" is handled above as a brand mismatch.)
    };

    const hasInvalidImeiReport = Object.keys(raw)
      .filter((k) => /^service\d+$/.test(k))
      .some((k) => isExplicitlyInvalidImei(raw[k]));

    if (hasInvalidImeiReport && !flags.includes('IMEI_MISMATCH')) {
      flags.push('IMEI_MISMATCH');
    }

    // A service genuinely succeeded if it returned status === 'success' or an object payload
    const isServiceSuccess = (val: unknown): boolean => {
      if (!val || typeof val !== 'object') return false;
      const resp = val as Record<string, unknown>;
      return resp.status === 'success' || (Boolean(resp.object) && resp.status !== 'failed');
    };

    const anySucceeded = Object.keys(raw)
      .filter((k) => /^service\d+$/.test(k))
      .some((k) => isServiceSuccess(raw[k]));

    if (flags.length === 0) {
      flags.push(anySucceeded ? 'CLEAN' : 'NOT_RUN');
    }
    const imeiValid =
      anySucceeded && !blacklisted && !reportedStolen && !hasInvalidImeiReport && !brandMismatch;

    return {
      imeiValid,
      icloudLocked,
      reportedStolen,
      blacklisted,
      deviceModel,
      deviceColor,
      deviceStorage,
      fmiOn,
      rawApiResponse: raw,
      flags,
      checksRun,
      reportedBrand,
      fraudRiskScore,
    };
  }

  /** Extract blacklist/stolen booleans, brand and fraud score from a service 5 API response. */
  private parseBlacklistResult(
    response: ImeiApiResponse,
    blacklisted: boolean,
    reportedStolen: boolean,
  ): { blacklisted: boolean; reportedStolen: boolean; reportedBrand?: string; fraudRiskScore?: number } {
    const obj = response.object;
    let reportedBrand: string | undefined;
    if (obj) {
      // The provider has used several key names for the same signal.
      const blacklistKeys = [
        'blacklisted', 'blacklist', 'blacklistStatus', 'blacklist_status',
        'gsmaBlacklisted', 'gsma_blacklisted',
      ];
      if (blacklistKeys.some((key) => isAffirmative(obj[key]))) blacklisted = true;
      if (typeof obj['brand'] === 'string') reportedBrand = obj['brand'] as string;

      const stolen = obj['stolen'] ?? obj['reportedStolen'] ?? obj['reported_stolen'];
      if (stolen === true || stolen === 'true' || stolen === 1) reportedStolen = true;

      const statusValue = this.statusValue(obj['status']);
      if (this.isBlocked(statusValue)) blacklisted = true;
      if (this.isStolen(statusValue)) {
        blacklisted = true;
        reportedStolen = true;
      }
    }

    // The human-readable `result` is HTML with "<Label>: <Status>" lines, e.g.
    // "Brand: Nokia<br>Blacklist Status: <span>Blacklisted</span><br>Fraud Risk
    // Score: 90/100". Read the STATUS VALUE of the relevant line — grepping the
    // whole string for "blacklist" would flag clean devices because of the label.
    const text = htmlToText(response.result);
    const blacklistLine = labeledValue(text, 'Blacklist Status');
    const resultValue = blacklistLine ?? this.statusValue(text);
    if (this.isBlocked(resultValue)) blacklisted = true;
    if (this.isStolen(resultValue)) {
      blacklisted = true;
      reportedStolen = true;
    }

    reportedBrand ??= labeledValue(text, 'Brand');
    const score = /fraud risk score\s*:\s*(\d{1,3})\s*\/\s*100/i.exec(text);
    const fraudRiskScore = score ? Number(score[1]) : undefined;

    return { blacklisted, reportedStolen, reportedBrand, fraudRiskScore };
  }

  /** The status token after the last ":", trimmed and lowercased ("Clean", "Blacklisted"). */
  private statusValue(input: unknown): string {
    const s = String(input ?? '').toLowerCase();
    const idx = s.lastIndexOf(':');
    return (idx >= 0 ? s.slice(idx + 1) : s).trim();
  }

  /** True when a status VALUE affirms blocked/blacklisted. Clean/No/green are false. */
  private isBlocked(value: string): boolean {
    return (
      value === 'blacklisted' ||
      value === 'blocked' ||
      value === 'yes' ||
      value === 'true' ||
      value === 'locked'
    );
  }

  /** True when a status VALUE affirms stolen / reported stolen. */
  private isStolen(value: string): boolean {
    return value === 'stolen' || value === 'reported' || value === 'yes' || value === 'true';
  }

  /**
   * Detect a brand-specific soft lock (a device-level lock that shouldn't be
   * auto-approved but isn't a GSMA blacklist entry) from a brand service's raw
   * response. Looks at key names/values commonly returned by these services.
   */
  private parseBrandLock(label: string, obj: Record<string, unknown>): boolean {
    const keys = Object.keys(obj ?? {});
    const join = keys.join(' ').toLowerCase();
    const valStr = keys
      .map((k) => String(obj[k] ?? ''))
      .join(' ')
      .toLowerCase();

    if (label === 'samsung_knox') {
      // Knox Guard ON + Locked / KG Locked means a lost/stolen or financed-dispute device.
      const kg = (obj['kg'] ?? obj['knoxGuard'] ?? obj['knox_guard'] ?? '').toString().toLowerCase();
      return (
        kg === 'on' ||
        kg === 'locked' ||
        (join.includes('knox') && valStr.includes('locked'))
      );
    }
    if (label === 'xiaomi_info') {
      const miLock = (obj['miLock'] ?? obj['mi_lock'] ?? obj['miActivationLock'] ?? '').toString().toLowerCase();
      return miLock === 'on' || miLock === 'locked' || (join.includes('mi activation') && valStr.includes('on'));
    }
    // Fallback: any generic "lock"/"guard" indicator that is ON/locked.
    const lockKey = keys.find((k) => {
      const lk = k.toLowerCase();
      return lk.includes('lock') || lk.includes('guard');
    });
    if (lockKey) {
      const v = String(obj[lockKey] ?? '').toLowerCase();
      if (v === 'on' || v === 'locked' || v === 'true' || v === '1') return true;
    }
    return false;
  }

  /** Integrity flag name for a brand-specific lock, for the REQUIRES_REVIEW path. */
  private brandLockFlagFor(label: string): string {
    switch (label) {
      case 'samsung_knox':
        return 'KNOX_LOCKED';
      case 'xiaomi_info':
        return 'MI_LOCKED';
      default:
        return 'DEVICE_LOCKED';
    }
  }

  private async callService(serviceId: number, imei: string): Promise<ImeiApiResponse> {
    const url = `${this.apiUrl}/api/php-api/create?key=${this.apiKey}&service=${serviceId}&imei=${encodeURIComponent(imei)}`;

    // Increased timeout to 90s to accommodate upstream imeicheck latency
    const response = await fetch(url, {
      signal: AbortSignal.timeout(90_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from service ${serviceId}`);
    }

    const data: ImeiApiResponse = await response.json();

    if (data.status === 'error') {
      throw new Error(`API error from service ${serviceId}: ${data.result ?? 'unknown error'}`);
    }

    // 'failed' = check ran but IMEI lookup returned no data or invalid IMEI
    return data;
  }

  private buildDefaultResult(extra: Record<string, unknown>): ImeiCheckResult {
    return {
      imeiValid: false,
      icloudLocked: false,
      reportedStolen: false,
      blacklisted: false,
      rawApiResponse: extra,
      // Use a sentinel flag so callers can distinguish "check not run" from
      // "check ran and came back clean". trust-lens.service.ts looks for 'CLEAN'
      // to auto-approve; 'NOT_RUN' leaves the request in PENDING instead of
      // incorrectly routing it to REQUIRES_REVIEW.
      flags: ['NOT_RUN'],
      checksRun: [],
    };
  }
}
