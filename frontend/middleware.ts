import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Verifies JWT token locally using jose — no network round-trip to the auth service.
 * SEC-09: Replaced live HTTP verification with local jose.jwtVerify() for lower latency
 * and elimination of auth-service dependency in the middleware hot path.
 */
async function verifyToken(token: string): Promise<{ valid: boolean; user?: any }> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[Middleware] JWT_SECRET is not set — cannot verify tokens');
      return { valid: false };
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));

    return {
      valid: true,
      user: {
        userId: (payload['sub'] ?? payload['userId']) as string,
        role: payload['role'] as string,
      },
    };
  } catch (error) {
    // Token is expired, tampered, or otherwise invalid
    return { valid: false };
  }
}

/**
 * Next.js middleware for route protection and authentication
 * Runs on all protected routes before the request reaches the page
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get access token from cookies
  const accessToken = request.cookies.get('accessToken')?.value;

  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/profile', '/settings', '/orders', '/my-listings'];
  const adminRoutes = ['/admin'];

  // Check if current path is protected
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));

  // If route is protected and no token exists, redirect to login
  if ((isProtectedRoute || isAdminRoute) && !accessToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If token exists on protected route, verify it
  if ((isProtectedRoute || isAdminRoute) && accessToken) {
    const { valid, user } = await verifyToken(accessToken);

    if (!valid) {
      // Token is invalid or expired
      const response = NextResponse.redirect(new URL('/login', request.url));
      
      // Clear invalid tokens
      response.cookies.delete('accessToken');
      response.cookies.delete('refreshToken');
      
      return response;
    }

    // Check admin access
    if (isAdminRoute && user?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // SEC-04: These headers are set for server-rendered page components only (e.g. RSC layout data).
    // IMPORTANT: API routes MUST NOT trust these headers for authorization decisions — they perform
    // their own token verification via getAccessToken() / requireRole() from lib/api-auth.ts.
    // These headers are intentionally absent from the matcher for /api/:path* routes.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.userId);
    requestHeaders.set('x-user-role', user.role);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Allow request to proceed
  return NextResponse.next();
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

    // Admin routes
    '/admin/:path*',
    // Note: /api/:path* is intentionally excluded — API routes perform their own
    // token validation via getAccessToken() / requireRole(), so running the
    // middleware's full backend round-trip on every API call is redundant and
    // adds latency.
  ],
};
