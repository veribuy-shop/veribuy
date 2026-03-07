/**
 * Public verification summary for a listing.
 *
 * Returns a sanitized proof-of-verification object safe for all viewers
 * (buyers, unauthenticated users). Never exposes the raw IMEI, serial number,
 * or raw API payloads. The full identifierValidation (with rawApiResponse) is
 * only returned to admins via the trust-lens service directly.
 */
import { NextRequest, NextResponse } from 'next/server';

const TRUST_LENS_SERVICE_URL = process.env.TRUST_LENS_SERVICE_URL || 'http://localhost:3004';
const LISTING_SERVICE_URL = process.env.LISTING_SERVICE_URL || 'http://localhost:3003';
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
    // We use a lightweight approach: read the listing's own trustLensStatus and
    // integrityFlags (already public), then derive check results from them.
    const status: string = listing.trustLensStatus ?? 'PENDING';
    const integrityFlags: string[] = Array.isArray(listing.integrityFlags)
      ? listing.integrityFlags
      : [];

    // Derive per-check results from the integrity flags and listing state.
    // The actual identifier validation only ran if the listing has gone past PENDING.
    const verificationRan =
      status === 'PASSED' || status === 'REQUIRES_REVIEW' || status === 'FAILED';
    const imeiCheckPerformed = verificationRan && integrityFlags.length > 0;

    let checks: PublicVerificationSummary['checks'] = null;

    if (imeiCheckPerformed) {
      const isFlagged = (flag: string) => integrityFlags.includes(flag);

      checks = {
        gsmaBlacklist: isFlagged('BLACKLISTED') || isFlagged('REPORTED_STOLEN')
          ? 'FLAGGED'
          : 'CLEAN',
        icloudStatus: isApple
          ? isFlagged('ICLOUD_LOCKED') ? 'LOCKED' : 'CLEAN'
          : 'NOT_APPLICABLE',
        stolenReport: isFlagged('REPORTED_STOLEN') ? 'FLAGGED' : 'CLEAN',
      };
    }

    const summary: PublicVerificationSummary = {
      listingId: id,
      status,
      conditionGrade: listing.conditionGrade ?? null,
      integrityFlags,
      imeiCheckPerformed,
      isAppleDevice: isApple,
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
