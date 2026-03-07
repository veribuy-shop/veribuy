import { NextRequest, NextResponse } from 'next/server';
import { requireRole, createAuthHeaders } from '@/lib/api-auth';
import { sanitizeListing, sanitizePaginated } from '@/lib/sanitize';

const LISTING_SERVICE_URL = process.env.LISTING_SERVICE_URL || 'http://localhost:3003';

export async function GET(request: NextRequest) {
  try {
    // Require ADMIN role
    const authResult = await requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    // Fetch all listings
    const response = await fetch(`${LISTING_SERVICE_URL}/listings`, {
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
