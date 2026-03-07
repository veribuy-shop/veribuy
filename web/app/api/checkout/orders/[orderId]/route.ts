import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';
import { sanitizeOrder } from '@/lib/sanitize';

const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3007';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { orderId } = await params;

    if (!UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID format' }, { status: 400 });
    }

    // Forward request to transaction service
    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/${orderId}`,
      {
        method: 'GET',
        headers: createAuthHeaders(authResult.token),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to fetch order' },
        { status: response.status }
      );
    }

    return NextResponse.json(sanitizeOrder(data));
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { orderId } = await params;

    if (!UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID format' }, { status: 400 });
    }

    const body = await req.json();
    const { status, trackingNumber } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Missing status field' },
        { status: 400 }
      );
    }

    // Forward request to transaction service
    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/${orderId}/status`,
      {
        method: 'PATCH',
        headers: createAuthHeaders(authResult.token),
        body: JSON.stringify({ status, trackingNumber }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to update order status' },
        { status: response.status }
      );
    }

    return NextResponse.json(sanitizeOrder(data));
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
