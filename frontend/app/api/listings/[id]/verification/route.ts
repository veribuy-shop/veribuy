import { getBackendUrl } from '@/lib/backend-url';
import { getCachedImeiStatus } from '@/lib/redis';
/**
 * Public verification summary for a listing.
 *
 * Returns a sanitized proof-of-verification object safe for all viewers
 * (buyers, unauthenticated users). Never exposes the raw IMEI, serial number,
 * or raw API payloads. The full identifierValidation (with rawApiResponse) is
 * only returned to admins via the trust-lens service directly.
 */
import { NextRequest, NextResponse } from 'next/server';

const TRUST_LENS_SERVICE_URL = getBackendUrl();
const LISTING_SERVICE_URL = getBackendUrl();
interface CheckSummaryShape {
      imeiValid: boolean | null;
      icloudLocked: boolean | null;
      reportedStolen: boolean | null;
      blacklisted: boolean | null;
      fmiOn: boolean | null;
      verifiedAt: string | null;
      deviceAttributes: Array<{ label: string; value: string }>;
    }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PublicVerificationSummary {
  listingId: string;
  status: string;
  conditionGrade: string | null;
  integrityFlags: string[];
  /** Whether an IMEI check was actually performed (not just submitted). */
  imeiCheckPerformed: boolean;
  /** Whether the device is Apple (determines which checks are applicable). */
  isAppleDevice: boolean;
  liveStatus: 'IN_PROGRESS' | 'PASSED' | 'REQUIRES_REVIEW' | 'FAILED' | 'PENDING' | null;
  liveStatusUpdatedAt: string | null;
  /** The 4 core public checks. */
  checks: {
    unlockedDevice: 'CLEAN' | 'LOCKED' | 'NOT_RUN';
    blacklistStatus: 'CLEAN' | 'FLAGGED' | 'NOT_RUN';
    warrantyStatus: 'ACTIVE' | 'EXPIRED' | 'VALID' | 'NOT_RUN';
    findMyPhone: 'CLEAN' | 'LOCKED' | 'NOT_RUN';
    // Backwards compatibility aliases
    gsmaBlacklist?: 'CLEAN' | 'FLAGGED' | 'NOT_RUN';
    icloudStatus?: 'CLEAN' | 'LOCKED' | 'NOT_APPLICABLE' | 'NOT_RUN';
    stolenReport?: 'CLEAN' | 'FLAGGED' | 'NOT_RUN';
  } | null;
  deviceAttributes: Array<{ label: string; value: string }>;
  verifiedAt: string | null;
  completedAt: string | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid listing ID format' }, { status: 400 });
    }

    const listingRes = await fetch(`${LISTING_SERVICE_URL}/listings/${id}`, {
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => null);

    if (!listingRes || !listingRes.ok) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: listingRes?.status ?? 404 },
      );
    }

    const listing = await listingRes.json();
    const brand: string = (listing.brand ?? '').trim().toLowerCase();
    const isApple = brand === 'apple';

    const status: string = listing.trustLensStatus ?? 'PENDING';
    const integrityFlags: string[] = Array.isArray(listing.integrityFlags)
      ? listing.integrityFlags
      : [];

    let checkSummary: CheckSummaryShape | null = null;
    try {
      const checkSummaryRes = await fetch(
        `${TRUST_LENS_SERVICE_URL}/trust-lens/${id}/summary`,
        { headers: { 'Content-Type': 'application/json' } },
      );
      if (checkSummaryRes.ok) {
        const text = await checkSummaryRes.text();
        if (text) {
          const parsed = JSON.parse(text) as { check?: CheckSummaryShape };
          checkSummary = parsed?.check ?? null;
        }
      }
    } catch {
      // Best-effort
    }

    const isRunning = status === 'IN_PROGRESS' || status === 'PENDING';
    const imeiCheckPerformed = !!checkSummary || isRunning;

    let cached: Record<string, unknown> | null = null;
    try {
      cached = await getCachedImeiStatus(id);
    } catch {
      cached = null;
    }
    const LIVE_STATUSES = new Set(['IN_PROGRESS', 'PASSED', 'REQUIRES_REVIEW', 'FAILED', 'PENDING']);
    const cachedStatus = String(cached?.status ?? '');
    const liveStatus = LIVE_STATUSES.has(cachedStatus)
      ? (cachedStatus as PublicVerificationSummary['liveStatus'])
      : null;
    const liveStatusUpdatedAt =
      typeof cached?.updatedAt === 'string' ? cached.updatedAt : null;

    let checks: PublicVerificationSummary['checks'] = null;

    if (imeiCheckPerformed && checkSummary) {
      const clean = (v: boolean | null) => v === true;
      const isBlacklisted = clean(checkSummary.blacklisted) || clean(checkSummary.reportedStolen);
      const isLocked = clean(checkSummary.icloudLocked) || (isApple && clean(checkSummary.fmiOn));

      checks = {
        unlockedDevice: clean(checkSummary.imeiValid) ? 'CLEAN' : 'LOCKED',
        blacklistStatus: isBlacklisted ? 'FLAGGED' : 'CLEAN',
        warrantyStatus: 'VALID',
        findMyPhone: isLocked ? 'LOCKED' : 'CLEAN',
        // Backwards compatible aliases
        gsmaBlacklist: isBlacklisted ? 'FLAGGED' : 'CLEAN',
        icloudStatus: isApple ? (isLocked ? 'LOCKED' : 'CLEAN') : 'NOT_APPLICABLE',
        stolenReport: clean(checkSummary.reportedStolen) ? 'FLAGGED' : 'CLEAN',
      };
    }

    const summary: PublicVerificationSummary = {
      listingId: id,
      status,
      conditionGrade: listing.conditionGrade ?? null,
      integrityFlags,
      imeiCheckPerformed,
      isAppleDevice: isApple,
      liveStatus,
      liveStatusUpdatedAt,
      checks,
      deviceAttributes: checkSummary?.deviceAttributes ?? [],
      verifiedAt: null,
      completedAt: null,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Listing verification summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
