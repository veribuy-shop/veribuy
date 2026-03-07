import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders, getTokenUserId } from '@/lib/api-auth';

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008';

export async function POST(req: NextRequest) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    // Derive senderId from the verified JWT — never trust the client-supplied value
    const senderId = await getTokenUserId(authResult.token);
    if (!senderId) {
      return NextResponse.json(
        { error: 'Could not identify sender from token' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { recipientId, listingId, subject, content } = body;

    if (!recipientId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Forward request to notification service with server-derived senderId
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/notifications/messages`, {
      method: 'POST',
      headers: createAuthHeaders(authResult.token),
      body: JSON.stringify({
        senderId,
        recipientId,
        listingId,
        subject,
        content,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to send message' },
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
