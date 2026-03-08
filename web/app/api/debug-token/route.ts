import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * TEMPORARY DEBUG ROUTE — remove after login issue is resolved.
 * Decodes the accessToken cookie and reports what the middleware sees.
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('accessToken')?.value;
  const secret = process.env.JWT_SECRET;

  // Always dump all cookies and headers so we can see what arrives
  const allCookies = Object.fromEntries(
    request.cookies.getAll().map((c) => [c.name, c.value.substring(0, 30) + '...'])
  );
  const cookieHeader = request.headers.get('cookie') ?? '(none)';

  if (!accessToken) {
    return NextResponse.json({
      error: 'No accessToken cookie found',
      allCookies,
      cookieHeaderPrefix: cookieHeader.substring(0, 200),
      nodeEnv: process.env.NODE_ENV,
    }, { status: 400 });
  }

  // Decode header+payload without verification (to see what's in the token)
  let decoded: any = null;
  try {
    const [, payloadB64] = accessToken.split('.');
    decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  } catch {
    decoded = 'failed to decode';
  }

  // Attempt verification with the current JWT_SECRET
  let verifyResult: any = null;
  try {
    if (!secret) {
      verifyResult = { error: 'JWT_SECRET env var is not set on this service' };
    } else {
      const { payload } = await jwtVerify(accessToken, new TextEncoder().encode(secret));
      verifyResult = { ok: true, payload };
    }
  } catch (err: any) {
    verifyResult = { ok: false, error: err.message };
  }

  return NextResponse.json({
    tokenPresent: true,
    tokenPrefix: accessToken.substring(0, 20) + '...',
    allCookies,
    decoded,
    secretPresent: !!secret,
    secretPrefix: secret ? secret.substring(0, 8) + '...' : null,
    verifyResult,
    nodeEnv: process.env.NODE_ENV,
  });
}
