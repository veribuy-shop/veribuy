import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';
import { isUuid, invalidIdResponse } from '@/lib/validate-id';
import { friendlyApiError } from '@/lib/api-errors';

const NOTIFICATION_SERVICE_URL = getBackendUrl();

export async function POST(req: NextRequest) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    const body = await req.json();
    const { recipientId, listingId, subject, content } = body;

    if (!recipientId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    if (!isUuid(recipientId) || (listingId !== undefined && listingId !== null && !isUuid(listingId))) {
      return invalidIdResponse();
    }

    // The backend derives the sender from the JWT and resolves the recipient's
    // email, names and listing title itself before sending any notification.
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/notifications/messages`, {
      method: 'POST',
      headers: createAuthHeaders(authResult.token),
      body: JSON.stringify({
        recipientId,
        ...(listingId ? { listingId } : {}),
        subject,
        content,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: friendlyApiError(data, 'Failed to send message') },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, messageId: data.id ?? data.messageId ?? null });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
