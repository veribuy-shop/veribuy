import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authServiceUrl = getBackendUrl();

    // Forward access token if authenticated
    const accessToken = request.cookies.get('accessToken')?.value;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${authServiceUrl}/auth/phone/verify-otp`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || 'Invalid or expired verification code' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Verify Phone OTP API] Error:', error);
    return NextResponse.json(
      { message: 'Failed to verify code. Please try again.' },
      { status: 500 }
    );
  }
}
