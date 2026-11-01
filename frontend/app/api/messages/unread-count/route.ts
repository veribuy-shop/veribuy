import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { getAccessToken, createAuthHeaders, getTokenUserId } from '@/lib/api-auth';

const NOTIFICATION_SERVICE_URL = getBackendUrl();

/** GET /api/messages/unread-count — unread in-app messages for the signed-in user. */
export async function GET(req: NextRequest) {
  try {
    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
    }
    const userId = await getTokenUserId(authResult.token);
    if (!userId) {
      return NextResponse.json({ count: 0 }, { status: 401 });
    }

    const response = await fetch(
      `${NOTIFICATION_SERVICE_URL}/notifications/messages/unread-count/${userId}`,
      { headers: createAuthHeaders(authResult.token), cache: 'no-store' },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ count: 0 }, { status: response.status });
    }
    return NextResponse.json({ count: Number(data?.count ?? 0) });
  } catch (error) {
    console.error('Error loading unread count:', error);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
