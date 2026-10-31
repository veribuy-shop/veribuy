import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { sanitizeAuthUser } from '@/lib/sanitize';
import { setAuthCookies, clearAuthCookies } from '@/lib/auth-cookies';

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
      `${getBackendUrl()}/auth/verify`,
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
          `${getBackendUrl()}/auth/refresh`,
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

          // The refresh response carries tokens only — hydrate the real user with
          // the new access token rather than returning a blank user (which made
          // pages treat a signed-in user as a stranger: no id, no role).
          const hydrated = await fetch(`${getBackendUrl()}/auth/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${refreshData.accessToken}`,
            },
          }).catch(() => null);
          const userData = hydrated?.ok ? await hydrated.json() : null;

          const nextResponse = userData
            ? NextResponse.json({ user: sanitizeAuthUser({ ...userData, id: userData.userId ?? userData.id }) })
            : NextResponse.json({ message: 'Unable to load session' }, { status: 401 });

          // The backend already rotated the refresh token — always persist the new pair.
          setAuthCookies(nextResponse, {
            accessToken: refreshData.accessToken,
            refreshToken: refreshData.refreshToken,
          });

          return nextResponse;
        }

        if (refreshResponse.status === 409) {
          // A concurrent request already refreshed; its cookies are on the way.
          return NextResponse.json({ message: 'Session already refreshed' }, { status: 409 });
        }
      }

      // Both access and refresh failed
      const errorResponse = NextResponse.json(
        { message: 'Invalid or expired token' },
        { status: 401 }
      );

      clearAuthCookies(errorResponse);

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
