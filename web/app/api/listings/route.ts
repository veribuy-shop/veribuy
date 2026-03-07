import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';
import { sanitizeListing, sanitizePublicListing, sanitizePaginated } from '@/lib/sanitize';

const LISTING_SERVICE_URL = process.env.LISTING_SERVICE_URL || 'http://localhost:3003';

export async function POST(request: NextRequest) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const body = await request.json();

    const response = await fetch(`${LISTING_SERVICE_URL}/listings`, {
      method: 'POST',
      headers: createAuthHeaders(authResult.token),
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to create listing' },
        { status: response.status }
      );
    }

    return NextResponse.json(sanitizeListing(data), { status: 201 });
  } catch (error) {
    console.error('Create listing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    const response = await fetch(`${LISTING_SERVICE_URL}/listings?${queryString}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to fetch listings' },
        { status: response.status }
      );
    }

    // Sanitize each listing in the paginated response — public view strips IMEI/serial
    return NextResponse.json(sanitizePaginated(data, sanitizePublicListing));
  } catch (error) {
    console.error('Fetch listings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
