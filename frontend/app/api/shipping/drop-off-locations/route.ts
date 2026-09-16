import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';
import { getBackendUrl } from '@/lib/backend-url';

const TRANSACTION_SERVICE_URL = getBackendUrl();

export async function GET(request: NextRequest) {
  try {
    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const postcode = searchParams.get('postcode');

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const url = new URL(`${TRANSACTION_SERVICE_URL}/transactions/orders/${orderId}/dropoff-locations`);
    if (postcode) {
      url.searchParams.set('postcode', postcode);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: createAuthHeaders(authResult.token),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({ error: 'Failed to fetch drop-off locations' }));
      return NextResponse.json(errorJson, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Dropoff Locations API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
