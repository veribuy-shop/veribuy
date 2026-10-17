import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { sanitizeAuthUser } from '@/lib/sanitize';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authServiceUrl = getBackendUrl();

    const response = await fetch(`${authServiceUrl}/auth/social`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { message: 'Authentication service unavailable' },
        { status: response.status || 500 },
      );
    }

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || 'Social authentication failed' },
        { status: response.status },
      );
    }

    const nextResponse = NextResponse.json({
      user: sanitizeAuthUser(data.user),
      isNewUser: Boolean(data.isNewUser),
      requiresEmailVerification: Boolean(data.requiresEmailVerification),
      requiresProfileCompletion: Boolean(data.requiresProfileCompletion),
    });

    // Set HttpOnly cookies for tokens (secure, inaccessible via client JavaScript)
    nextResponse.cookies.set('accessToken', data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60, // 15 minutes
      path: '/',
    });

    nextResponse.cookies.set('refreshToken', data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return nextResponse;
  } catch (error) {
    console.error('[Social Auth API] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
