import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';
import { isUuid, invalidIdResponse } from '@/lib/validate-id';
import { friendlyApiError } from '@/lib/api-errors';

const NOTIFICATION_SERVICE_URL = getBackendUrl();

/** PATCH /api/messages/:messageId/read — the backend checks the caller is the recipient. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    const { messageId } = await params;
    if (!isUuid(messageId)) return invalidIdResponse();

    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    const response = await fetch(
      `${NOTIFICATION_SERVICE_URL}/notifications/messages/${messageId}/read`,
      { method: 'PATCH', headers: createAuthHeaders(authResult.token) },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: friendlyApiError(data, 'Failed to update message') },
        { status: response.status },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking message read:', error);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
}
