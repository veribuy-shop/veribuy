import type { NextResponse } from 'next/server';

export const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

const baseCookie = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
});

/** Set the HttpOnly session cookies on a response. */
export function setAuthCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken?: string },
): void {
  response.cookies.set('accessToken', tokens.accessToken, { ...baseCookie(), maxAge: ACCESS_TOKEN_MAX_AGE });
  if (tokens.refreshToken) {
    response.cookies.set('refreshToken', tokens.refreshToken, { ...baseCookie(), maxAge: REFRESH_TOKEN_MAX_AGE });
  }
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.delete({ name: 'accessToken', path: '/' });
  response.cookies.delete({ name: 'refreshToken', path: '/' });
}
