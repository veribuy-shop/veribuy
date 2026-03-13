import { NextRequest, NextResponse } from 'next/server';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

/**
 * Logout endpoint
 * Revokes the refresh token on the auth-service, then clears cookies.
 * Cookies are always cleared even if revocation fails — the client is always logged out.
 */
export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refreshToken')?.value;

    // Revoke refresh token on auth-service (fire-and-forget; don't block logout on failure)
    if (refreshToken) {
      try {
        await fetch(`${AUTH_SERVICE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch (revokeError) {
        console.error('Logout: failed to revoke refresh token on auth-service:', revokeError);
      }
    }

    const response = NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    );

    // Always clear authentication cookies regardless of revocation outcome
    response.cookies.delete({ name: 'accessToken', path: '/' });
    response.cookies.delete({ name: 'refreshToken', path: '/' });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
