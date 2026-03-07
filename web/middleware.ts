import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Verifies JWT token by making a request to the auth service
 * In production, consider caching validation results or using JWT verification library
 */
async function verifyToken(token: string): Promise<{ valid: boolean; user?: any }> {
  try {
    const response = await fetch(`${process.env.AUTH_SERVICE_URL || 'http://localhost:3001'}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const user = await response.json();
      return { valid: true, user };
    }

    return { valid: false };
  } catch (error) {
    console.error('Token verification failed:', error);
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

    // Token is valid, add user info to request headers for API routes to use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.userId);
    requestHeaders.set('x-user-role', user.role);
    requestHeaders.set('x-user-email', user.email);

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
    '/my-listings/:path*',

    // Admin routes
    '/admin/:path*',
    // Note: /api/:path* is intentionally excluded — API routes perform their own
    // token validation via getAccessToken() / requireRole(), so running the
    // middleware's full backend round-trip on every API call is redundant and
    // adds latency.
  ],
};
