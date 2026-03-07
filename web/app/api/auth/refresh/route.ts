import { NextRequest, NextResponse } from 'next/server';
import { sanitizeAuthUser } from '@/lib/sanitize';

/**
 * Token refresh endpoint
 * Uses the refresh token from HttpOnly cookie to get a new access token
 */
export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { message: 'No refresh token provided' },
        { status: 401 }
      );
    }

    // Call backend refresh endpoint
    const response = await fetch(
      `${process.env.AUTH_SERVICE_URL || 'http://localhost:3001'}/auth/refresh`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      }
    );

    if (!response.ok) {
      // Refresh token is invalid or expired — clear cookies, return generic message
      const errorResponse = NextResponse.json(
        { message: 'Session expired. Please log in again.' },
        { status: 401 }
      );
      errorResponse.cookies.delete('accessToken');
      errorResponse.cookies.delete('refreshToken');
      return errorResponse;
    }

    const data = await response.json();

    // Return only sanitized user fields
    const nextResponse = NextResponse.json({ user: sanitizeAuthUser(data.user) });

    // Set new access token in HttpOnly cookie
    nextResponse.cookies.set('accessToken', data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60, // 15 minutes
      path: '/',
    });

    // Optionally update refresh token if backend returns a new one
    if (data.refreshToken) {
      nextResponse.cookies.set('refreshToken', data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
