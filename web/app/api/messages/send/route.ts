import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders, getTokenUserId } from '@/lib/api-auth';

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Look up a user's name and email via the auth-service internal endpoint.
 * Returns null on any failure so the message send still proceeds.
 */
async function fetchUserInfo(
  userId: string,
): Promise<{ name: string; email: string } | null> {
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/auth/internal/users/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': INTERNAL_SERVICE_TOKEN,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.email) return null;
    return { name: data.name ?? '', email: data.email };
  } catch {
    return null;
  }
}

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
    const { recipientId, listingId, subject, content, listingTitle } = body;

    if (!recipientId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch sender and seller info server-side for email notification.
    // Both are fire-and-forget lookups — failure doesn't block the message.
    const [senderInfo, sellerInfo] = await Promise.all([
      fetchUserInfo(senderId),
      fetchUserInfo(recipientId),
    ]);

    // Build emailContext only when we have enough data to send a useful email
    const emailContext =
      sellerInfo && senderInfo
        ? {
            senderName: senderInfo.name,
            recipientEmail: sellerInfo.email,
            recipientName: sellerInfo.name,
            listingTitle: typeof listingTitle === 'string' ? listingTitle.slice(0, 200) : undefined,
          }
        : undefined;

    // Forward request to notification service — senderId is NOT included in
    // the body because the notification controller derives it from the JWT
    // via @CurrentUser(). The global ValidationPipe (forbidNonWhitelisted)
    // would reject unknown properties.
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/notifications/messages`, {
      method: 'POST',
      headers: createAuthHeaders(authResult.token),
      body: JSON.stringify({
        recipientId,
        listingId,
        subject,
        content,
        ...(emailContext ? { emailContext } : {}),
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
