import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';
import { getBackendUrl } from '@/lib/backend-url';

const TRANSACTION_SERVICE_URL = getBackendUrl();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { orderId } = await params;
    if (!UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID format' }, { status: 400 });
    }

    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/${orderId}/shipping-label`,
      {
        method: 'GET',
        headers: createAuthHeaders(authResult.token),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Failed to generate shipping label');
      return NextResponse.json(
        { error: errorText || 'Failed to generate shipping label' },
        { status: response.status }
      );
    }

    const pdfBuffer = await response.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="royal-mail-label-${orderId.substring(0, 8)}.pdf"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('[Shipping Label API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
