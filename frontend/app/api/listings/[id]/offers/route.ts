import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';
import { isUuid, invalidIdResponse } from '@/lib/validate-id';
import { friendlyApiError } from '@/lib/api-errors';

/** POST /api/listings/:id/offers — { amount, note? }. Buyer comes from the session. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = getAccessToken(request);
  if ('error' in authResult) return authResult.error;

  const { id } = await params;
  if (!isUuid(id)) return invalidIdResponse();

  try {
    const { amount, note } = await request.json();
    const response = await fetch(`${getBackendUrl()}/offers/listing/${id}`, {
      method: 'POST',
      headers: createAuthHeaders(authResult.token),
      body: JSON.stringify({ amount: Number(amount), ...(typeof note === 'string' && note.trim() ? { note } : {}) }),
    });
    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: friendlyApiError(data, 'Failed to submit offer') }, { status: response.status });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('[Offers API] create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
