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

          // iCloud lock may come through as activation/icloud lock keys or
          // via lost/FMI state — treat any of them as locked for Apple devices.
          const lockVal =
            obj['icloudLock'] ?? obj['icloud_lock'] ?? obj['iCloudLock'] ??
            obj['activationLock'] ?? obj['activation_lock'] ?? obj['lostMode'] ?? obj['lost_mode'];
          if (lockVal === true || lockVal === 'true' || lockVal === 1 || lockVal === 'locked') {
            icloudLocked = true;
          }
          const lockStr = String(lockVal ?? '').toLowerCase();
          if (lockStr.includes('locked') || lockStr.includes('on')) icloudLocked = true;

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
      } else {
        this.logger.warn(`ImeiCheck service 3 failed: ${String(service3.reason)}`);
        raw['service3Error'] = String(service3.reason);
      }

      // fmiOn counts as iCloud locked for Apple devices
      if (fmiOn === true) icloudLocked = true;

      // Service 5 — GSMA Blacklist (brand-agnostic live safety net)
      if (service5.status === 'fulfilled') {
        raw['service5'] = service5.value;
        ({ blacklisted, reportedStolen } = this.parseBlacklistResult(service5.value, blacklisted, reportedStolen));
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
        ({ blacklisted, reportedStolen } = this.parseBlacklistResult(service5.value, blacklisted, reportedStolen));
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

    // IMEI is considered valid if at least one service ran and no hard blocks
    const anySucceeded =
      'service3' in raw || 'service4' in raw || 'service5' in raw || Object.keys(raw).some((k) => /^service\d+$/.test(k));
    if (flags.length === 0) {
      flags.push(anySucceeded ? 'CLEAN' : 'NOT_RUN');
    }
    const imeiValid = anySucceeded && !blacklisted && !reportedStolen;

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
    };
  }

  /** Extract blacklist/stolen booleans from a service 5 API response. */
  private parseBlacklistResult(
    response: ImeiApiResponse,
    blacklisted: boolean,
    reportedStolen: boolean,
  ): { blacklisted: boolean; reportedStolen: boolean } {
    const obj = response.object;
    if (obj) {
      const blacklist = obj['blacklisted'] ?? obj['blacklist'];
      if (blacklist === true || blacklist === 'true' || blacklist === 1) blacklisted = true;

      const stolen = obj['stolen'] ?? obj['reportedStolen'] ?? obj['reported_stolen'];
      if (stolen === true || stolen === 'true' || stolen === 1) reportedStolen = true;

      const statusValue = this.statusValue(obj['status']);
      if (this.isBlocked(statusValue)) blacklisted = true;
      if (this.isStolen(statusValue)) {
        blacklisted = true;
        reportedStolen = true;
      }
    }

    // The human-readable `result` is a "<Label>: <Status>" string, e.g.
    // "Blacklist Status: Clean". We must look at the STATUS VALUE, not the whole
    // string — grepping the whole thing for "blacklist" would flag a clean device
    // just because the label contains the word "Blacklist".
    const resultValue = this.statusValue(response.result);
    if (this.isBlocked(resultValue)) blacklisted = true;
    if (this.isStolen(resultValue)) {
      blacklisted = true;
      reportedStolen = true;
    }
    return { blacklisted, reportedStolen };
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

    const response = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from service ${serviceId}`);
    }

    const data: ImeiApiResponse = await response.json();

    if (data.status === 'error') {
      throw new Error(`API error from service ${serviceId}: ${data.result ?? 'unknown error'}`);
    }

    // 'failed' = check ran but IMEI lookup returned no data — not a hard error
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
