import { NextRequest, NextResponse } from 'next/server';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const response = await fetch(`${AUTH_SERVICE_URL}/auth/reset-password`, {
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
        { message: data.message || 'Password reset failed' },
        { status: response.status },
      );
    }

    // No auth cookies — user must sign in manually after reset
    return NextResponse.json(data);
  } catch (error) {
    console.error('[reset-password API] Unexpected error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
