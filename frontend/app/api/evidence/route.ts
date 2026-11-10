import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/api-auth';
import { sanitizeEvidenceItem } from '@/lib/sanitize';
import { getBackendUrl } from '@/lib/backend-url';
import { friendlyApiError } from '@/lib/api-errors';

const EVIDENCE_SERVICE_URL = getBackendUrl();

export async function POST(req: NextRequest) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    const incomingFormData = await req.formData();
    const file = incomingFormData.get('file');
    const listingId = incomingFormData.get('listingId');
    const type = incomingFormData.get('type') || 'DEVICE_IMAGE';
    const description = incomingFormData.get('description');
    const metadata = incomingFormData.get('metadata');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ message: 'File is required' }, { status: 400 });
    }

    const forwardFormData = new FormData();
    const filename = (file as File).name || 'upload.jpg';
    forwardFormData.append('file', file, filename);
    if (listingId) forwardFormData.append('listingId', String(listingId));
    forwardFormData.append('type', String(type));
    if (description) forwardFormData.append('description', String(description));
    if (metadata) forwardFormData.append('metadata', String(metadata));

    // Forward the formData to evidence service with authorization
    const response = await fetch(`${EVIDENCE_SERVICE_URL}/evidence/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authResult.token}`,
      },
      body: forwardFormData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // Logged here as well as on the backend: a rejected upload must be
      // traceable from either service's logs.
      console.error(
        `[evidence] upload rejected: backend ${response.status} for listing ${listingId} ` +
          `(${describeFile(file as File)}): ${JSON.stringify(error?.message ?? error)}`,
      );
      return NextResponse.json(
        { message: friendlyApiError(error, uploadFailureMessage(response.status)) },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Return only the safe fields — not file size, mime type, or internal metadata
    return NextResponse.json(sanitizeEvidenceItem(data), { status: 201 });
  } catch (error) {
    // Reaching here means the request never got an answer from the backend
    // (unreachable, timed out, or the upload body couldn't be read), so the
    // backend has no log of it.
    const cause = error instanceof Error ? (error.cause as { code?: string } | undefined)?.code : undefined;
    console.error(
      `[evidence] upload failed before reaching the backend at ${EVIDENCE_SERVICE_URL}` +
        `${cause ? ` (${cause})` : ''}:`,
      error,
    );
    return NextResponse.json(
      { message: 'We couldn’t reach the photo service. Please try again in a moment.' },
      { status: 502 },
    );
  }
}

function describeFile(file: File): string {
  return `${Math.round(file.size / 1024)} KB ${file.type || 'unknown type'}`;
}

/** What to tell the seller when the backend gives no usable message. */
function uploadFailureMessage(status: number): string {
  if (status === 401) return 'Your session has expired. Sign in again, then press Submit to finish uploading.';
  if (status === 413) return 'That photo is too large to upload.';
  if (status === 429) return 'Too many uploads at once. Wait a minute, then press Submit again.';
  return `The photo couldn’t be saved (error ${status}). Please try again.`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const listingId = searchParams.get('listingId');
    const sellerId = searchParams.get('sellerId');

    let url = `${EVIDENCE_SERVICE_URL}/evidence`;

    if (listingId) {
      // Public product gallery: buyers and anonymous visitors must be able to
      // see photos of published listings. The backend exposes
      // GET /evidence/listing/:listingId publicly, so no auth is required here.
      url += `/listing/${listingId}`;
    } else if (sellerId) {
      // Seller-private evidence management: requires authentication. Evidence
      // data is seller-sensitive — never expose it to unauthenticated callers.
      const authResult = getAccessToken(req);
      if ('error' in authResult) {
        return authResult.error;
      }
      url += `/seller/${sellerId}`;
    } else {
      return NextResponse.json(
        { message: 'listingId or sellerId is required' },
        { status: 400 },
      );
    }

    // Only forward a verified auth token when one is present (the public
    // listing-image path sends none). The evidence service accepts public
    // listing reads without a token.
    const authResult = getAccessToken(req);
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (!('error' in authResult)) {
      headers['Authorization'] = `Bearer ${authResult.token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404 && listingId) {
        return NextResponse.json({ items: [] });
      }
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { message: friendlyApiError(error, 'Failed to fetch evidence') },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Sanitize each item — strip fileSize, mimeType, and internal metadata
    const rawItems: any[] = Array.isArray(data) ? data : (data.data ?? data.items ?? []);
    const items = rawItems.map(sanitizeEvidenceItem);
    // Return as { items: [] } so all consumers can use evidenceData.items
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching evidence:', error);
    return NextResponse.json(
      { message: 'Failed to fetch evidence' },
      { status: 500 },
    );
  }
}
