import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';

const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3007';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { orderId } = await params;

    if (!UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID format' }, { status: 400 });
    }

    const body = await req.json();
    const { rating, comment } = body;

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be an integer between 1 and 5' },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/${orderId}/rate`,
      {
        method: 'POST',
        headers: createAuthHeaders(authResult.token),
        body: JSON.stringify({ rating: Math.round(rating), comment }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to submit rating' },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error submitting rating:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { orderId } = await params;

    if (!UUID_RE.test(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID format' }, { status: 400 });
    }

    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/${orderId}/rating`,
      {
        method: 'GET',
        headers: createAuthHeaders(authResult.token),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to fetch rating' },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching rating:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
