import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';
import { friendlyApiError } from '@/lib/api-errors';

const DRAFT_URL = `${getBackendUrl()}/listings/draft`;

/** Proxies the signed-in seller's unfinished listing to the backend. */
async function forward(req: NextRequest, method: 'GET' | 'PUT' | 'DELETE') {
  const authResult = getAccessToken(req);
  if ('error' in authResult) {
    return authResult.error;
  }
  try {
    const response = await fetch(DRAFT_URL, {
      method,
      headers: createAuthHeaders(authResult.token),
      body: method === 'PUT' ? await req.text() : undefined,
      cache: 'no-store',
    });
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      return NextResponse.json(
        { error: friendlyApiError(data, 'We could not save your draft.') },
        { status: response.status },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Listing draft error:', error);
    return NextResponse.json({ error: 'We could not save your draft.' }, { status: 500 });
  }
}

export const GET = (req: NextRequest) => forward(req, 'GET');
export const PUT = (req: NextRequest) => forward(req, 'PUT');
export const DELETE = (req: NextRequest) => forward(req, 'DELETE');
