import { NextRequest, NextResponse } from 'next/server';
import { requireRole, createAuthHeaders } from '@/lib/api-auth';
import { sanitizeListing, sanitizePaginated } from '@/lib/sanitize';
import { getBackendUrl } from '@/lib/backend-url';

const LISTING_SERVICE_URL = getBackendUrl();

export async function GET(request: NextRequest) {
  try {
    // Require ADMIN role
    const authResult = await requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ALL';
    const limit = searchParams.get('limit') || '100';
    const page = searchParams.get('page') || '1';
    const search = searchParams.get('search');

    const backendUrl = new URL(`${LISTING_SERVICE_URL}/listings`);
    backendUrl.searchParams.set('status', status);
    backendUrl.searchParams.set('limit', limit);
    backendUrl.searchParams.set('page', page);
    if (search) backendUrl.searchParams.set('search', search);

    // Fetch all listings
    const response = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: createAuthHeaders(authResult.token),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || 'Failed to fetch listings' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(sanitizePaginated(data, sanitizeListing));
  } catch (error) {
    console.error('[Admin Listings API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
