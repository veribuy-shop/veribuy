import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

const LISTING_SERVICE_URL = getBackendUrl();

export async function GET() {
  try {
    const response = await fetch(`${LISTING_SERVICE_URL}/listings/options`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to fetch listing options' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Fetch listing options error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
