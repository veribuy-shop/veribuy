import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postcode = searchParams.get('postcode') || 'SW1A 1AA';

    const backendUrl = getBackendUrl();
    const url = new URL(`${backendUrl}/transactions/shipping/collection-points`);
    url.searchParams.set('postcode', postcode);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorJson = await response
        .json()
        .catch(() => ({ error: 'Failed to fetch collection points' }));
      return NextResponse.json(errorJson, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Collection Points API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
