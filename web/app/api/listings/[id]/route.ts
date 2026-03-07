import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders, getTokenUserId } from '@/lib/api-auth';
import { sanitizeListing, sanitizePublicListing } from '@/lib/sanitize';

const LISTING_SERVICE_URL = process.env.LISTING_SERVICE_URL || 'http://localhost:3003';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid listing ID format' }, { status: 400 });
    }

    // Listing detail is public — no token required to view
    const response = await fetch(`${LISTING_SERVICE_URL}/listings/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to fetch listing' },
        { status: response.status }
      );
    }

    // Determine if the requester is the seller — if so, include IMEI/serial
    const tokenCookie = request.cookies.get('accessToken')?.value;
    const requesterId = tokenCookie ? getTokenUserId(tokenCookie) : null;
    const isOwner = requesterId && requesterId === data.sellerId;

    return NextResponse.json(isOwner ? sanitizeListing(data) : sanitizePublicListing(data));
  } catch (error) {
    console.error('Fetch listing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid listing ID format' }, { status: 400 });
    }

    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const body = await request.json();

    const response = await fetch(`${LISTING_SERVICE_URL}/listings/${id}`, {
      method: 'PATCH',
      headers: createAuthHeaders(authResult.token),
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to update listing' },
        { status: response.status }
      );
    }

    // Return seller view (owner can see IMEI/serial) since only owner can edit
    return NextResponse.json(sanitizeListing(data));
  } catch (error) {
    console.error('Update listing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid listing ID format' }, { status: 400 });
    }

    // Get and validate access token for DELETE (requires authentication)
    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const response = await fetch(`${LISTING_SERVICE_URL}/listings/${id}`, {
      method: 'DELETE',
      headers: createAuthHeaders(authResult.token),
    });

    if (!response.ok) {
      const data = await response.json();
      return NextResponse.json(
        { error: data.message || 'Failed to delete listing' },
        { status: response.status }
      );
    }

    // 200 with success body (204 must not have a body)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete listing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
