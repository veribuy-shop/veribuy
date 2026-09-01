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
  /**
   * Live check state read directly from the shared Redis cache written by the
   * backend ImeiCheckWorker. Lets the frontend render an accurate in-progress
   * indicator (e.g. "Running device check…") before the check reaches a
   * terminal state. Null when nothing is cached / Redis unavailable.
   */
  liveStatus: 'IN_PROGRESS' | 'PASSED' | 'REQUIRES_REVIEW' | 'FAILED' | 'PENDING' | null;
  /** ISO timestamp of when the cached status was last written. */
  liveStatusUpdatedAt: string | null;
  /** Per-check results — only present when imeiCheckPerformed is true. */
  checks: {
    gsmaBlacklist: 'CLEAN' | 'FLAGGED' | 'NOT_RUN';
    icloudStatus: 'CLEAN' | 'LOCKED' | 'NOT_APPLICABLE' | 'NOT_RUN';
    stolenReport: 'CLEAN' | 'FLAGGED' | 'NOT_RUN';
  } | null;
  /** ISO timestamp of when the IMEI check was verified. */
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

    // Fetch verification request from trust-lens service.
    // This endpoint is called server-side — no user token needed here because
    // we're reading from our own trusted backend. We use an internal service
    // call without forwarding any user credentials.
    // NOTE: trust-lens GET requires auth — we call listing service instead
    // for the public fields, then augment with what listing carries.
    const listingRes = await fetch(`${LISTING_SERVICE_URL}/listings/${id}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!listingRes.ok) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: listingRes.status },
      );
    }

    const listing = await listingRes.json();
    const brand: string = (listing.brand ?? '').trim().toLowerCase();
    const isApple = brand === 'apple';

    // Trust Lens is a protected service — call it directly (server-to-server,
    // no user JWT needed; the trust-lens service trusts internal network calls).
    const status: string = listing.trustLensStatus ?? 'PENDING';
    const integrityFlags: string[] = Array.isArray(listing.integrityFlags)
      ? listing.integrityFlags
      : [];

    // The full check result lives on IdentifierValidation (written by the
    // backend worker). We read the sanitized booleans from the public summary
    // endpoint so clean devices (which carry no integrity flags) still show
    // their GSMA/iCloud/stolen rows in the Verification Report.
    const checkSummaryRes = await fetch(
      `${TRUST_LENS_SERVICE_URL}/trust-lens/${id}/summary`,
      { headers: { 'Content-Type': 'application/json' } },
    );
    let checkSummary: {
      imeiValid: boolean | null;
      icloudLocked: boolean | null;
      reportedStolen: boolean | null;
      blacklisted: boolean | null;
      fmiOn: boolean | null;
      verifiedAt: string | null;
    } | null = null;
    if (checkSummaryRes.ok) {
      checkSummary = await checkSummaryRes.json();
    }

    // Results surface the moment the worker writes them — no terminal-status
    // gate. A non-null checkSummary means the IMEI check actually ran.
    const imeiCheckPerformed = !!checkSummary;

    // Read the live cached outcome written by the backend ImeiCheckWorker so the
    // frontend can surface an accurate in-progress state (Redis is best-effort;
    // on failure we just fall back to the listing-derived status below). The
    // value is validated against a strict whitelist — never trusted blindly,
    // since it originates from a shared Redis instance.
    const cached = await getCachedImeiStatus(id);
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
      const icloudLocked = clean(checkSummary.icloudLocked) || (isApple && clean(checkSummary.fmiOn));

      checks = {
        gsmaBlacklist: clean(checkSummary.blacklisted) || clean(checkSummary.reportedStolen)
          ? 'FLAGGED'
          : 'CLEAN',
        icloudStatus: isApple
          ? icloudLocked ? 'LOCKED' : 'CLEAN'
          : 'NOT_APPLICABLE',
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
      verifiedAt: null, // Not exposed publicly — only in admin view
      completedAt: null,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Listing verification summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
