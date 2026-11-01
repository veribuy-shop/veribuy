import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { getAccessToken, createAuthHeaders, getTokenUserId } from '@/lib/api-auth';
import { friendlyApiError } from '@/lib/api-errors';

const NOTIFICATION_SERVICE_URL = getBackendUrl();

interface RawMessage {
  id: string;
  senderId: string;
  recipientId: string;
  listingId: string | null;
  subject: string | null;
  content: string;
  isSystem?: boolean;
  isRead: boolean;
  createdAt: string;
  sender?: { id: string; name: string } | null;
  recipient?: { id: string; name: string } | null;
  listing?: { id: string; title: string } | null;
}

/** "Jane Smith" -> "Jane S." so the inbox never shows full legal names. */
function shortName(name: string | undefined | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'VeriBuy member';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/**
 * GET /api/messages
 * The signed-in user's latest in-app messages (sent and received), newest first.
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
    }
    const userId = await getTokenUserId(authResult.token);
    if (!userId) {
      return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    }

    const response = await fetch(
      `${NOTIFICATION_SERVICE_URL}/notifications/messages/user/${userId}?limit=100`,
      { headers: createAuthHeaders(authResult.token), cache: 'no-store' },
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: friendlyApiError(data, 'Failed to load messages') },
        { status: response.status },
      );
    }

    const rows: RawMessage[] = Array.isArray(data?.data) ? data.data : [];
    return NextResponse.json({
      userId,
      messages: rows.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        recipientId: m.recipientId,
        senderName: shortName(m.sender?.name),
        recipientName: shortName(m.recipient?.name),
        listingId: m.listingId,
        listingTitle: m.listing?.title ?? null,
        subject: m.subject,
        content: m.content,
        isSystem: Boolean(m.isSystem),
        isRead: m.isRead,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error loading messages:', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}
