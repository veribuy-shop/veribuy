import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';
import { friendlyApiError } from '@/lib/api-errors';

/** GET /api/offers?role=buyer|seller — offers the user made or received. */
export async function GET(request: NextRequest) {
  const authResult = getAccessToken(request);
  if ('error' in authResult) return authResult.error;

  const role = request.nextUrl.searchParams.get('role') === 'seller' ? 'seller' : 'buyer';
  try {
    const response = await fetch(`${getBackendUrl()}/offers?role=${role}`, {
      headers: createAuthHeaders(authResult.token),
    });
    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: friendlyApiError(data, 'Failed to load offers') }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Offers API] list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
