import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireRole } from '../api-auth';

const SECRET = 'test-secret-for-require-role-checks';

async function tokenFor(role: string, expiresIn: string) {
  return new SignJWT({ role, sub: 'user-1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(SECRET));
}

function requestWith(token?: string) {
  return new NextRequest('http://localhost/api/admin/users', {
    headers: token ? { cookie: `accessToken=${token}` } : {},
  });
}

async function statusOf(token?: string) {
  const result = await requireRole(requestWith(token), 'ADMIN');
  return 'error' in result ? result.error.status : 200;
}

describe('requireRole', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', SECRET);
  });

  it('allows the required role', async () => {
    expect(await statusOf(await tokenFor('ADMIN', '5m'))).toBe(200);
  });

  it('refuses another role with 403', async () => {
    expect(await statusOf(await tokenFor('BUYER', '5m'))).toBe(403);
  });

  it('answers an expired token with 401, so the browser can refresh the session', async () => {
    const expired = await tokenFor('ADMIN', '-1m');
    expect(await statusOf(expired)).toBe(401);
  });

  it('answers a tampered token with 401', async () => {
    expect(await statusOf('not.a.token')).toBe(401);
  });

  it('answers a missing token with 401', async () => {
    expect(await statusOf()).toBe(401);
  });
});
