import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders, getTokenUserId } from '@/lib/api-auth';
import { sanitizeOrder, sanitizePublicProfile, sanitizeListing } from '@/lib/sanitize';

const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3007';
const LISTING_SERVICE_URL = process.env.LISTING_SERVICE_URL || 'http://localhost:3003';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { orderId } = await params;

    // Validate UUID format
    if (!UUID_RE.test(orderId)) {
      return NextResponse.json(
        { error: 'Invalid order ID format' },
        { status: 400 }
      );
    }

    // Fetch order from transaction service
    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/${orderId}`,
      {
        method: 'GET',
        headers: createAuthHeaders(authResult.token),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Failed to fetch order details' },
        { status: response.status }
      );
    }

    const order = await response.json();

    // Compute role flags server-side before sanitization strips buyerId/sellerId
    const currentUserId = await getTokenUserId(authResult.token);
    const isSeller = currentUserId !== null && order.sellerId === currentUserId;
    const isBuyer = currentUserId !== null && order.buyerId === currentUserId;

    // Fetch listing and seller details in parallel
    const [listingResult, sellerResult] = await Promise.allSettled([
      fetch(`${LISTING_SERVICE_URL}/listings/${order.listingId}`, {
        headers: { 'Content-Type': 'application/json' },
      }),
      fetch(`${USER_SERVICE_URL}/users/${order.sellerId}/profile`, {
        headers: createAuthHeaders(authResult.token),
      }),
    ]);

    const listing =
      listingResult.status === 'fulfilled' && listingResult.value.ok
        ? sanitizeListing(await listingResult.value.json())
        : null;

    const sellerRaw =
      sellerResult.status === 'fulfilled' && sellerResult.value.ok
        ? await sellerResult.value.json()
        : null;
    const seller = sanitizePublicProfile(sellerRaw);

    return NextResponse.json({
      order: sanitizeOrder(order),
      listing,
      seller,
      isSeller,
      isBuyer,
    });
  } catch (error) {
    console.error('[Order API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
