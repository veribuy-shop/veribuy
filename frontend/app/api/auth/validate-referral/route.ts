import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

const USER_SERVICE_URL = getBackendUrl();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code') || '';

    if (!code.trim()) {
      return NextResponse.json({ valid: false, message: 'Code required' }, { status: 400 });
    }

    const response = await fetch(
      `${USER_SERVICE_URL}/users/referral-code/${encodeURIComponent(code.trim().toUpperCase())}/validate`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Validate referral error:', error);
    return NextResponse.json(
      { valid: false, message: 'Unable to validate referral code' },
      { status: 500 }
    );
  }
}
