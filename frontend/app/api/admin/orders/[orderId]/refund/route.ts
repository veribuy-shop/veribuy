import { friendlyApiError } from '@/lib/api-errors';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, createAuthHeaders } from '@/lib/api-auth';
import { sanitizeOrder } from '@/lib/sanitize';
import { getBackendUrl } from '@/lib/backend-url';
import { isUuid, invalidIdResponse } from '@/lib/validate-id';

const TRANSACTION_SERVICE_URL = getBackendUrl();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    // Require ADMIN role
    const authResult = await requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    const { orderId } = await params;

    if (!isUuid(orderId)) return invalidIdResponse();

    // Validate UUID format
    if (!UUID_RE.test(orderId)) {
      return NextResponse.json(
        { error: 'Invalid order ID format' },
        { status: 400 }
      );
    }

    const { reason } = await request.json().catch(() => ({ reason: undefined }));

    // Initiate refund via transaction service
    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/${orderId}/refund`,
      {
        method: 'POST',
        headers: createAuthHeaders(authResult.token),
        body: JSON.stringify({ reason: reason || undefined }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      if (response.status === 400) {
        const data = await response.json().catch(() => null);
        return NextResponse.json({ error: friendlyApiError(data, 'This order cannot be refunded.') }, { status: 400 });
      }

      return NextResponse.json(
        { error: 'Failed to refund order' },
        { status: response.status }
      );
    }

    const refundedOrder = await response.json();
    return NextResponse.json(sanitizeOrder(refundedOrder));
  } catch (error) {
    console.error('[Admin Refund Order] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
