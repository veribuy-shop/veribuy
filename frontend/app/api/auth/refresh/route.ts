import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { sanitizeAuthUser } from '@/lib/sanitize';
import { setAuthCookies, clearAuthCookies } from '@/lib/auth-cookies';

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
      `${getBackendUrl()}/auth/refresh`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      }
    );

    if (response.status === 409) {
      // A concurrent refresh (another tab / the middleware) already rotated the
      // token and set fresh cookies — keep them and tell the client to retry.
      return NextResponse.json({ message: 'Session already refreshed' }, { status: 409 });
    }

    if (!response.ok) {
      // Refresh token is invalid or expired — clear cookies, return generic message
      const errorResponse = NextResponse.json(
        { message: 'Session expired. Please log in again.' },
        { status: 401 }
      );
      clearAuthCookies(errorResponse);
      return errorResponse;
    }

    const data = await response.json();

    // The backend has already rotated the refresh token at this point, so the new
    // cookies MUST be set — nothing after this may throw before they are attached.
    // The backend refresh response carries tokens only; user data is optional.
    const nextResponse = NextResponse.json(
      data.user ? { user: sanitizeAuthUser(data.user) } : { refreshed: true },
    );
    setAuthCookies(nextResponse, { accessToken: data.accessToken, refreshToken: data.refreshToken });

    return nextResponse;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
