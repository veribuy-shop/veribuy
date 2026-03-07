import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, requireRole, createAuthHeaders } from '@/lib/api-auth';
import { sanitizeTrustLens, sanitizePaginated } from '@/lib/sanitize';

const TRUST_LENS_SERVICE_URL = process.env.TRUST_LENS_SERVICE_URL || 'http://localhost:3004';

export async function GET(request: NextRequest) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get('listingId');

    let url = `${TRUST_LENS_SERVICE_URL}/trust-lens`;
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

export async function POST(request: NextRequest) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error;
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
    const authResult = requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get('listingId');

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
