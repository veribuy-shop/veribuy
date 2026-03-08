import { NextRequest, NextResponse } from 'next/server';
import { sanitizeAuthUser } from '@/lib/sanitize';

/**
 * Verify endpoint
 * Checks if the user's access token is valid
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('accessToken')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { message: 'No access token found' },
        { status: 401 }
      );
    }

    // Verify token with backend auth service
    const response = await fetch(
      `${process.env.AUTH_SERVICE_URL || 'http://localhost:3001'}/auth/verify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      // Token is invalid, try to refresh
      const refreshToken = request.cookies.get('refreshToken')?.value;

      if (refreshToken) {
        // Attempt token refresh
        const refreshResponse = await fetch(
          `${process.env.AUTH_SERVICE_URL || 'http://localhost:3001'}/auth/refresh`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          }
        );

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();

          // Normalise id field (backend may return userId or id)
          const rawUser = {
            ...refreshData.user,
            id: refreshData.user?.userId ?? refreshData.user?.id,
          };

          const nextResponse = NextResponse.json({ user: sanitizeAuthUser(rawUser) });

          // Set new access token
          nextResponse.cookies.set('accessToken', refreshData.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60, // 15 minutes
            path: '/',
          });

          return nextResponse;
        }
      }

      // Both access and refresh failed
      const errorResponse = NextResponse.json(
        { message: 'Invalid or expired token' },
        { status: 401 }
      );

      errorResponse.cookies.delete('accessToken');
      errorResponse.cookies.delete('refreshToken');

      return errorResponse;
    }

    const data = await response.json();

    // Normalise: backend verify returns { userId, email, role, name? }
    const rawUser = {
      ...data,
      id: data.userId ?? data.id,
    };

    return NextResponse.json({ user: sanitizeAuthUser(rawUser) });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
