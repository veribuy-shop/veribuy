import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

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
 * Verify the JWT and return its payload using the server-side JWT_SECRET.
 * Throws if the secret is missing, the token is malformed, or the signature
 * is invalid — so callers can rely on the returned payload being authentic.
 */
async function verifyJwtPayload(token: string): Promise<Record<string, any> | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[api-auth] JWT_SECRET environment variable is not set');
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as Record<string, any>;
  } catch {
    return null;
  }
}

/**
 * Require a specific role from the access token cookie.
 * Performs full JWT signature verification — not just a base64 decode.
 * Returns { token, role } on success, or { error: NextResponse } on failure.
 *
 * Usage:
 *   const authResult = await requireRole(request, 'ADMIN');
 *   if ('error' in authResult) return authResult.error;
 */
export async function requireRole(
  request: NextRequest,
  requiredRole: string,
): Promise<{ token: string; role: string } | { error: NextResponse }> {
  const tokenResult = getAccessToken(request);
  if ('error' in tokenResult) return tokenResult;

  const payload = await verifyJwtPayload(tokenResult.token);
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
 * Extract the authenticated user's ID from a verified JWT payload.
 * Returns null if the token is missing, malformed, or has an invalid signature.
 */
export async function getTokenUserId(token: string): Promise<string | null> {
  const payload = await verifyJwtPayload(token);
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
