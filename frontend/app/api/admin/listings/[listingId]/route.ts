import { NextRequest, NextResponse } from 'next/server';
import { requireRole, createAuthHeaders } from '@/lib/api-auth';
import { sanitizeListing } from '@/lib/sanitize';

const LISTING_SERVICE_URL = process.env.LISTING_SERVICE_URL || 'http://localhost:3003';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH /api/admin/listings/[listingId] - Update listing (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    // Require ADMIN role
    const authResult = await requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    const { listingId } = await params;

    if (!UUID_RE.test(listingId)) {
      return NextResponse.json({ error: 'Invalid listing ID format' }, { status: 400 });
    }

    const body = await request.json();

    // Forward request to listing service
    const response = await fetch(`${LISTING_SERVICE_URL}/listings/${listingId}`, {
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

    return NextResponse.json(sanitizeListing(data));
  } catch (error) {
    console.error('Failed to update listing:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/listings/[listingId] - Delete listing (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    // Require ADMIN role
    const authResult = await requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    const { listingId } = await params;

    if (!UUID_RE.test(listingId)) {
      return NextResponse.json({ error: 'Invalid listing ID format' }, { status: 400 });
    }

    // Forward request to listing service
    const response = await fetch(`${LISTING_SERVICE_URL}/listings/${listingId}`, {
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

    return NextResponse.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Failed to delete listing:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
