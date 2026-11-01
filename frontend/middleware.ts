import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getBackendUrl } from '@/lib/backend-url';
import { clientIpHeaders } from '@/lib/client-ip';
import { setAuthCookies, clearAuthCookies } from '@/lib/auth-cookies';

interface SessionUser {
  userId: string;
  role: string;
}

/**
 * Verifies JWT token locally using jose — no network round-trip to the auth service.
 * SEC-09: Replaced live HTTP verification with local jose.jwtVerify() for lower latency
 * and elimination of auth-service dependency in the middleware hot path.
 */
async function verifyToken(token: string): Promise<SessionUser | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[Middleware] JWT_SECRET is not set — cannot verify tokens');
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
    });
    return {
      userId: (payload['sub'] ?? payload['userId']) as string,
      role: payload['role'] as string,
    };
  } catch {
    // Token is expired, tampered, or otherwise invalid
    return null;
  }
}

type RefreshResult =
  | { status: 'refreshed'; accessToken: string; refreshToken?: string }
  | { status: 'raced' }
  | { status: 'failed' };

/**
 * Exchange the refresh-token cookie for a new session so an expired 15-minute
 * access token doesn't bounce the user to the login page.
 */
async function refreshSession(request: NextRequest, refreshToken: string): Promise<RefreshResult> {
  try {
    const res = await fetch(`${getBackendUrl()}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await clientIpHeaders(request.headers.get('x-forwarded-for'))),
      },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(5000),
    });
    // 409: a concurrent request already rotated this token and set fresh cookies.
    if (res.status === 409) return { status: 'raced' };
    if (!res.ok) return { status: 'failed' };
    const data = await res.json();
    return data.accessToken
      ? { status: 'refreshed', accessToken: data.accessToken, refreshToken: data.refreshToken }
      : { status: 'failed' };
  } catch {
    return { status: 'failed' };
  }
}

function redirectToLogin(request: NextRequest, clearCookies: boolean): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(loginUrl);
  if (clearCookies) clearAuthCookies(response);
  return response;
}

/**
 * Next.js middleware for route protection and authentication
 * Runs on all protected routes before the request reaches the page
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith('/admin');

  const accessToken = request.cookies.get('accessToken')?.value;
  const refreshToken = request.cookies.get('refreshToken')?.value;

  let user = accessToken ? await verifyToken(accessToken) : null;
  let refreshed: Extract<RefreshResult, { status: 'refreshed' }> | null = null;

  if (!user) {
    if (!refreshToken) {
      return redirectToLogin(request, Boolean(accessToken));
    }
    const result = await refreshSession(request, refreshToken);
    if (result.status === 'raced') {
      // Another in-flight request won the refresh; its Set-Cookie is on the way.
      // Let the page load and authenticate client-side with the fresh cookies.
      return NextResponse.next();
    }
    if (result.status === 'failed') {
      return redirectToLogin(request, true);
    }
    refreshed = result;
    user = await verifyToken(result.accessToken);
    if (!user) {
      return redirectToLogin(request, true);
    }
  }

  // Check admin access
  if (isAdminRoute && user.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  // SEC-04: These headers are set for server-rendered page components only (e.g. RSC layout data).
  // IMPORTANT: API routes MUST NOT trust these headers for authorization decisions — they perform
  // their own token verification via getAccessToken() / requireRole() from lib/api-auth.ts.
  // These headers are intentionally absent from the matcher for /api/:path* routes.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', user.userId);
  requestHeaders.set('x-user-role', user.role);

  if (refreshed) {
    // Make the new tokens visible to server components rendering this request.
    request.cookies.set('accessToken', refreshed.accessToken);
    if (refreshed.refreshToken) request.cookies.set('refreshToken', refreshed.refreshToken);
    requestHeaders.set('cookie', request.cookies.toString());
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  if (refreshed) {
    setAuthCookies(response, refreshed);
  }
  return response;
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
  matcher: [
    // Protected user routes
    '/dashboard/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/orders/:path*',
    '/my-listings',
    '/my-listings/:path*',
    '/checkout/:path*',
    '/listings/create',
    '/listings/:id/edit',
    '/seller-verification/:path*',
    '/verification/:path*',
    '/offers/:path*',
    '/messages/:path*',

    // Admin routes
    '/admin/:path*',
    // Note: /api/:path* is intentionally excluded — API routes perform their own
    // token validation via getAccessToken() / requireRole().
  ],
};
