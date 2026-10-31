import { NextResponse } from 'next/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Route parameters are interpolated into backend URLs. Accepting only UUIDs
 * prevents path traversal (e.g. `../auth/admin/users/…`) into other endpoints.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function invalidIdResponse(): NextResponse {
  return NextResponse.json({ error: 'Invalid identifier' }, { status: 400 });
}
