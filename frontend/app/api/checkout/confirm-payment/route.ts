import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';
import { sanitizeOrder } from '@/lib/sanitize';

const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3007';

export async function POST(req: NextRequest) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    const body = await req.json();
    const { orderId, paymentIntentId } = body;

    if (!orderId || !paymentIntentId) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId and paymentIntentId are required' },
        { status: 400 }
      );
    }

    // Validate UUID format for orderId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orderId)) {
      return NextResponse.json(
        { error: 'Invalid order ID format' },
        { status: 400 }
      );
    }

    // Validate Stripe payment intent format
    if (!paymentIntentId.startsWith('pi_')) {
      return NextResponse.json(
        { error: 'Invalid payment intent ID format' },
        { status: 400 }
      );
    }

    // Forward request to transaction service
    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/${orderId}/confirm-payment`,
      {
        method: 'POST',
        headers: createAuthHeaders(authResult.token),
        body: JSON.stringify({ paymentIntentId }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Transaction service error:', data);
      return NextResponse.json(
        { error: data.message || data.error || 'Failed to confirm payment' },
        { status: response.status }
      );
    }

    // Transaction service returns { order: {...}, escrow: {...} }
    // Extract the nested order object before sanitizing
    return NextResponse.json(sanitizeOrder(data.order ?? data));
  } catch (error) {
    console.error('Error confirming payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
