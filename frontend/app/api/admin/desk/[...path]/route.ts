import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { requireRole, createAuthHeaders } from '@/lib/api-auth';
import { friendlyApiError } from '@/lib/api-errors';

const ALLOWED_PATHS = new Set(['summary', 'review-queue', 'listings', 'orders', 'payouts', 'audit-log']);

/** Read-only pass-through to the backend's admin endpoints, which select their own fields. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const authResult = await requireRole(request, 'ADMIN');
  if ('error' in authResult) return authResult.error;

  const { path } = await params;
  const target = path.join('/');
  if (!ALLOWED_PATHS.has(target)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const response = await fetch(`${getBackendUrl()}/admin/${target}${request.nextUrl.search}`, {
      headers: createAuthHeaders(authResult.token),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json({ error: friendlyApiError(data, 'We could not load this.') }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[Admin desk] ${target} failed:`, error);
    return NextResponse.json({ error: 'We could not reach the server. Please try again.' }, { status: 502 });
  }
}
