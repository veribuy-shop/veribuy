import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders, getTokenUserId } from '@/lib/api-auth';
import { sanitizeOrder, sanitizePaginated } from '@/lib/sanitize';

const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3007';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sellerId: string }> }
) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { sellerId } = await params;

    if (!UUID_RE.test(sellerId)) {
      return NextResponse.json({ error: 'Invalid seller ID format' }, { status: 400 });
    }

    // Ownership check — only the seller themselves may fetch their orders
    const tokenUserId = getTokenUserId(authResult.token);
    if (tokenUserId !== sellerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/seller/${sellerId}`,
      {
        method: 'GET',
        headers: createAuthHeaders(authResult.token),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to fetch orders' },
        { status: response.status }
      );
    }

    return NextResponse.json(sanitizePaginated(data, sanitizeOrder));
  } catch (error) {
    console.error('Error fetching seller orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
