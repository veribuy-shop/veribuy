import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders, getTokenUserId } from '@/lib/api-auth';

const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3007';

/**
 * PATCH /api/checkout/update-shipping
 *
 * Updates shipping details (fee + service tier) on a PENDING order
 * and syncs the new total to the Stripe PaymentIntent.
 */
export async function PATCH(req: NextRequest) {
  try {
    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    const buyerId = await getTokenUserId(authResult.token);
    if (!buyerId) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or expired token' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { orderId, shippingFee, shippingService } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 },
      );
    }

    if (typeof shippingFee !== 'number' || shippingFee < 0) {
      return NextResponse.json(
        { error: 'shippingFee must be a non-negative number' },
        { status: 400 },
      );
    }

    if (!shippingService || !['TRACKED_24', 'TRACKED_48'].includes(shippingService)) {
      return NextResponse.json(
        { error: 'shippingService must be TRACKED_24 or TRACKED_48' },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/${orderId}/shipping`,
      {
        method: 'PATCH',
        headers: createAuthHeaders(authResult.token),
        body: JSON.stringify({ shippingFee, shippingService }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Transaction service error (update-shipping):', data);
      return NextResponse.json(
        { error: data.message || data.error || 'Failed to update shipping' },
        { status: response.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating shipping:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
