import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';
import { isUuid, invalidIdResponse } from '@/lib/validate-id';
import { friendlyApiError } from '@/lib/api-errors';

/** PATCH /api/offers/:offerId — { action: ACCEPT | DECLINE | WITHDRAW } */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const authResult = getAccessToken(request);
  if ('error' in authResult) return authResult.error;

  const { offerId } = await params;
  if (!isUuid(offerId)) return invalidIdResponse();

  try {
    const { action } = await request.json();
    const response = await fetch(`${getBackendUrl()}/offers/${offerId}`, {
      method: 'PATCH',
      headers: createAuthHeaders(authResult.token),
      body: JSON.stringify({ action }),
    });
    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: friendlyApiError(data, 'Failed to update offer') }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Offers API] respond error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
