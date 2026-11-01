import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, requireRole, createAuthHeaders } from '@/lib/api-auth';
import { sanitizeTrustLens, sanitizePaginated } from '@/lib/sanitize';
import { getBackendUrl } from '@/lib/backend-url';
import { isUuid, invalidIdResponse } from '@/lib/validate-id';

const TRUST_LENS_SERVICE_URL = getBackendUrl();

export async function GET(request: NextRequest) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get('listingId');
    if (listingId !== null && !isUuid(listingId)) return invalidIdResponse();

    // Forward pagination (the backend caps limit at 100; it defaults to 10,
    // which silently truncated the admin verification queue).
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 10));
    let url = `${TRUST_LENS_SERVICE_URL}/trust-lens?page=${page}&limit=${limit}`;
    if (listingId) {
      url = `${TRUST_LENS_SERVICE_URL}/trust-lens/${listingId}`;
    }

    const response = await fetch(url, {
      headers: createAuthHeaders(authResult.token),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch verification requests' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();

    // Single record when listingId provided, paginated list otherwise
    if (listingId) {
      return NextResponse.json(sanitizeTrustLens(data));
    }
    return NextResponse.json(sanitizePaginated(data, sanitizeTrustLens));
  } catch (error) {
    console.error('Trust Lens API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch verification requests' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Require ADMIN role — only admins can delete verification requests
    const authResult = await requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get('listingId');
    if (listingId !== null && !isUuid(listingId)) return invalidIdResponse();

    if (!listingId) {
      return NextResponse.json({ error: 'listingId is required' }, { status: 400 });
    }

    const response = await fetch(`${TRUST_LENS_SERVICE_URL}/trust-lens/${listingId}`, {
      method: 'DELETE',
      headers: createAuthHeaders(authResult.token),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete verification request' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Trust Lens API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to delete verification request' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get('listingId');
    if (listingId !== null && !isUuid(listingId)) return invalidIdResponse();
    const action = searchParams.get('action');

    if (action === 'rerun' && listingId) {
      const adminAuth = await requireRole(request, 'ADMIN');
      if ('error' in adminAuth) {
        return adminAuth.error;
      }
      const rerunRes = await fetch(`${TRUST_LENS_SERVICE_URL}/trust-lens/${listingId}/rerun`, {
        method: 'POST',
        headers: createAuthHeaders(adminAuth.token),
      });
      if (!rerunRes.ok) {
        const error = await rerunRes.json().catch(() => ({ error: 'Failed to re-run verification check' }));
        return NextResponse.json(error, { status: rerunRes.status });
      }
      return NextResponse.json(await rerunRes.json());
    }

    const body = await request.json();

    const response = await fetch(`${TRUST_LENS_SERVICE_URL}/trust-lens`, {
      method: 'POST',
      headers: createAuthHeaders(authResult.token),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create verification request' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(sanitizeTrustLens(data));
  } catch (error) {
    console.error('Trust Lens API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to create verification request' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Require ADMIN role — only admins can update verification status
    const authResult = await requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get('listingId');
    if (listingId !== null && !isUuid(listingId)) return invalidIdResponse();

    if (!listingId) {
      return NextResponse.json(
        { error: 'listingId is required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const response = await fetch(`${TRUST_LENS_SERVICE_URL}/trust-lens/${listingId}/status`, {
      method: 'PATCH',
      headers: createAuthHeaders(authResult.token),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update verification status' }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(sanitizeTrustLens(data));
  } catch (error) {
    console.error('Trust Lens API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to update verification status' },
      { status: 500 }
    );
  }
}
