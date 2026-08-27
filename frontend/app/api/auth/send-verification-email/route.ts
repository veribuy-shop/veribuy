import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';

const AUTH_SERVICE_URL = getBackendUrl();

export async function POST(request: NextRequest) {
  try {
    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const response = await fetch(`${AUTH_SERVICE_URL}/auth/send-verification-email`, {
      method: 'POST',
      headers: createAuthHeaders(authResult.token),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || 'Failed to send verification email' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[send-verification-email API] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
