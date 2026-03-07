import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
   * Returns true if the brand string indicates an Apple device.
   * Handles common casing/spacing variations (e.g. "apple", "Apple", "APPLE").
   */
  private isAppleBrand(brand?: string): boolean {
    if (!brand) return false;
    return brand.trim().toLowerCase() === 'apple';
  }

  /**
   * Run IMEI checks in parallel, with brand-aware service selection:
   *
   *   Apple devices  → service 3 (Apple Full Info) + service 4 (iCloud check) + service 5 (GSMA blacklist)
   *   All others     → service 5 only (GSMA blacklist — brand-agnostic)
   *
   * Never throws — on error returns a safe default with the error captured in rawApiResponse.
   */
  async checkImei(imei: string, brand?: string): Promise<ImeiCheckResult> {
    if (!this.apiKey) {
      this.logger.warn('IMEI_CHECK_API_KEY is not set — skipping IMEI verification');
      return this.buildDefaultResult({ error: 'API key not configured' });
    }

    const apple = this.isAppleBrand(brand);
    this.logger.log(
      `Running IMEI checks for ${brand ?? 'unknown brand'} (apple=${apple}), IMEI ${imei}`,
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

    if (apple) {
      // --- Apple: run services 3, 4, 5 in parallel ---
      checksRun.push('apple_full_info', 'icloud_check', 'gsma_blacklist');

      const [service3, service4, service5] = await Promise.allSettled([
        this.callService(3, imei), // Apple Full Info [No Carrier] — $0.07
        this.callService(4, imei), // iCloud Clean/Lost Check      — $0.02
        this.callService(5, imei), // Blacklist Status (GSMA)      — $0.02
      ]);

      // Service 3 — Apple Full Info
      if (service3.status === 'fulfilled') {
        raw['service3'] = service3.value;
        const obj = service3.value.object;
        if (obj) {
          deviceModel = (obj['model'] as string) ?? undefined;
          deviceColor = (obj['color'] as string) ?? undefined;
          deviceStorage = (obj['storage'] as string) ?? undefined;
          if (obj['fmiOn'] !== undefined) fmiOn = Boolean(obj['fmiOn']);
          if (obj['fmiON'] !== undefined) fmiOn = Boolean(obj['fmiON']);
        }
      } else {
        this.logger.warn(`ImeiCheck service 3 failed: ${String(service3.reason)}`);
        raw['service3Error'] = String(service3.reason);
      }

      // Service 4 — iCloud Clean/Lost Check
      if (service4.status === 'fulfilled') {
        raw['service4'] = service4.value;
        const obj = service4.value.object;
        if (obj) {
          const lostMode = obj['lostMode'] ?? obj['lost_mode'];
          const icloudLock = obj['icloudLock'] ?? obj['icloud_lock'] ?? obj['iCloudLock'];
          if (lostMode === true || lostMode === 'true' || lostMode === 1) icloudLocked = true;
          if (icloudLock === true || icloudLock === 'true' || icloudLock === 1) icloudLocked = true;
          if (fmiOn === undefined) {
            const fmi = obj['fmiOn'] ?? obj['fmiON'];
            if (fmi !== undefined) fmiOn = Boolean(fmi);
          }
        }
        const result = (service4.value.result ?? '').toLowerCase();
        if (result.includes('lost') || result.includes('locked')) icloudLocked = true;
      } else {
        this.logger.warn(`ImeiCheck service 4 failed: ${String(service4.reason)}`);
        raw['service4Error'] = String(service4.reason);
      }

      // fmiOn counts as iCloud locked for Apple devices
      if (fmiOn === true) icloudLocked = true;

      // Service 5 — GSMA Blacklist
      if (service5.status === 'fulfilled') {
        raw['service5'] = service5.value;
        ({ blacklisted, reportedStolen } = this.parseBlacklistResult(service5.value, blacklisted, reportedStolen));
      } else {
        this.logger.warn(`ImeiCheck service 5 failed: ${String(service5.reason)}`);
        raw['service5Error'] = String(service5.reason);
      }
    } else {
      // --- Non-Apple: run service 5 only (GSMA blacklist is brand-agnostic) ---
      checksRun.push('gsma_blacklist');
      raw['brand'] = brand ?? 'unknown';

      const [service5] = await Promise.allSettled([
        this.callService(5, imei), // Blacklist Status (GSMA) — $0.02
      ]);

      if (service5.status === 'fulfilled') {
        raw['service5'] = service5.value;
        ({ blacklisted, reportedStolen } = this.parseBlacklistResult(service5.value, blacklisted, reportedStolen));
      } else {
        this.logger.warn(`ImeiCheck service 5 (non-Apple) failed: ${String(service5.reason)}`);
        raw['service5Error'] = String(service5.reason);
      }
    }

    // Build integrity flags
    const flags: string[] = [];
    if (icloudLocked) flags.push('ICLOUD_LOCKED');
    if (reportedStolen) flags.push('REPORTED_STOLEN');
    if (blacklisted) flags.push('BLACKLISTED');
    if (flags.length === 0) flags.push('CLEAN');

    // IMEI is considered valid if at least service 5 ran and no hard blocks
    const anySucceeded = 'service3' in raw || 'service4' in raw || 'service5' in raw;
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

      const statusStr = ((obj['status'] as string) ?? '').toLowerCase();
      if (statusStr === 'blacklisted' || statusStr === 'blocked') blacklisted = true;
      if (statusStr === 'stolen') {
        blacklisted = true;
        reportedStolen = true;
      }
    }
    const result = (response.result ?? '').toLowerCase();
    if (result.includes('blacklist') || result.includes('blocked')) blacklisted = true;
    if (result.includes('stolen')) {
      blacklisted = true;
      reportedStolen = true;
    }
    return { blacklisted, reportedStolen };
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
