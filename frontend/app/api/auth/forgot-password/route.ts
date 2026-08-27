import { NextRequest, NextResponse } from 'next/server';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const response = await fetch(`${AUTH_SERVICE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : {};

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || 'Request failed' },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[forgot-password API] Unexpected error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
