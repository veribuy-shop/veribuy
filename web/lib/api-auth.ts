import { NextRequest, NextResponse } from 'next/server';

/**
 * Helper function to extract access token from request cookies
 * Returns the token if found, or an error response if not found
 */
export function getAccessToken(request: NextRequest): { token: string } | { error: NextResponse } {
  const accessToken = request.cookies.get('accessToken')?.value;

  if (!accessToken) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized - No access token' },
        { status: 401 }
      ),
    };
  }

  return { token: accessToken };
}

/**
 * Decode the JWT payload without verifying the signature.
 * Verification happens at the backend; here we only need the role claim
 * to gate admin routes at the BFF layer without an extra network call.
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Base64url → Base64 → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Require a specific role from the access token cookie.
 * Returns { token, role } on success, or { error: NextResponse } on failure.
 *
 * Usage:
 *   const authResult = requireRole(request, 'ADMIN');
 *   if ('error' in authResult) return authResult.error;
 */
export function requireRole(
  request: NextRequest,
  requiredRole: string,
): { token: string; role: string } | { error: NextResponse } {
  const tokenResult = getAccessToken(request);
  if ('error' in tokenResult) return tokenResult;

  const payload = decodeJwtPayload(tokenResult.token);
  const role: string = payload?.role ?? '';

  if (role !== requiredRole) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      ),
    };
  }

  return { token: tokenResult.token, role };
}

/**
 * Extract the authenticated user's ID from the JWT payload.
 * Returns null if the token is missing or malformed.
 */
export function getTokenUserId(token: string): string | null {
  const payload = decodeJwtPayload(token);
  return payload?.sub ?? payload?.userId ?? null;
}

/**
 * Helper function to create authorization headers for backend requests
 */
export function createAuthHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}
