import { NextRequest, NextResponse } from 'next/server';
import { requireRole, createAuthHeaders } from '@/lib/api-auth';
import { sanitizeOrder } from '@/lib/sanitize';

const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3007';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    // Require ADMIN role
    const authResult = requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    const { orderId } = await params;
    const body = await request.json();
    const { status } = body;

    // Validate UUID format
    if (!UUID_RE.test(orderId)) {
      return NextResponse.json(
        { error: 'Invalid order ID format' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = [
      'PENDING',
      'PAYMENT_RECEIVED',
      'ESCROW_HELD',
      'SHIPPED',
      'DELIVERED',
      'COMPLETED',
      'DISPUTED',
      'REFUNDED',
      'CANCELLED',
    ];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }

    // Update order status in transaction service
    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/${orderId}/status`,
      {
        method: 'PATCH',
        headers: createAuthHeaders(authResult.token),
        body: JSON.stringify({ status }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Failed to update order status' },
        { status: response.status }
      );
    }

    const updatedOrder = await response.json();
    return NextResponse.json(sanitizeOrder(updatedOrder));
  } catch (error) {
    console.error('[Admin Update Order] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    // Require ADMIN role
    const authResult = requireRole(request, 'ADMIN');
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

    // Cancel order by setting status to CANCELLED
    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/${orderId}/status`,
      {
        method: 'PATCH',
        headers: createAuthHeaders(authResult.token),
        body: JSON.stringify({ status: 'CANCELLED' }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Failed to cancel order' },
        { status: response.status }
      );
    }

    const cancelledOrder = await response.json();
    return NextResponse.json(sanitizeOrder(cancelledOrder));
  } catch (error) {
    console.error('[Admin Cancel Order] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
