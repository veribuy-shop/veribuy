import { NextRequest, NextResponse } from 'next/server';
import { sanitizeAuthUser } from '@/lib/sanitize';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
    
    const response = await fetch(`${authServiceUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Handle non-JSON responses (errors)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { message: 'Authentication service unavailable' },
        { status: response.status || 500 }
      );
    }

    const data = await response.json();

    if (!response.ok) {
      // 403 from auth-service means email not yet verified
      if (response.status === 403) {
        return NextResponse.json(
          { message: 'Please verify your email before signing in. Check your inbox for the verification link.' },
          { status: 403 }
        );
      }
      // Return only the message field — never the full backend error object
      return NextResponse.json(
        { message: data.message || 'Invalid credentials' },
        { status: response.status }
      );
    }

    // Return only sanitized user fields — no tokens in response body
    const nextResponse = NextResponse.json({ user: sanitizeAuthUser(data.user) });

    // Set HttpOnly cookies for tokens (secure, not accessible via JavaScript)
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
    console.error('[Login API] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
