import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders, getTokenUserId } from '@/lib/api-auth';
import { getBackendUrl } from '@/lib/backend-url';

const USER_SERVICE_URL = getBackendUrl();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    // Get and validate access token
    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    // Ownership check: only the account owner (or admin) may read their own referrals
    const tokenUserId = await getTokenUserId(authResult.token);
    if (tokenUserId !== userId) {
      const { requireRole } = await import('@/lib/api-auth');
      const adminCheck = await requireRole(request, 'ADMIN');
      if ('error' in adminCheck) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const response = await fetch(`${USER_SERVICE_URL}/users/${userId}/referrals`, {
      method: 'GET',
      headers: createAuthHeaders(authResult.token),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to fetch referral data' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Fetch referrals error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
