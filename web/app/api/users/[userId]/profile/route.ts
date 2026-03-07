import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders, getTokenUserId } from '@/lib/api-auth';
import { sanitizeProfile } from '@/lib/sanitize';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';

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

    // Ownership check: only the account owner (or admin) may read their own profile
    const tokenUserId = await getTokenUserId(authResult.token);
    if (tokenUserId !== userId) {
      // Decode role to allow admins through
      const { requireRole } = await import('@/lib/api-auth');
      const adminCheck = await requireRole(request, 'ADMIN');
      if ('error' in adminCheck) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const response = await fetch(`${USER_SERVICE_URL}/users/${userId}/profile`, {
      method: 'GET',
      headers: createAuthHeaders(authResult.token),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to fetch profile' },
        { status: response.status }
      );
    }

    return NextResponse.json(sanitizeProfile(data));
  } catch (error) {
    console.error('Fetch profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    const body = await request.json();

    // Get and validate access token
    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    // Ownership check: only the account owner (or admin) may update their profile
    const tokenUserId = await getTokenUserId(authResult.token);
    if (tokenUserId !== userId) {
      const { requireRole } = await import('@/lib/api-auth');
      const adminCheck = await requireRole(request, 'ADMIN');
      if ('error' in adminCheck) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const response = await fetch(`${USER_SERVICE_URL}/users/${userId}/profile`, {
      method: 'PUT',
      headers: createAuthHeaders(authResult.token),
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to update profile' },
        { status: response.status }
      );
    }

    return NextResponse.json(sanitizeProfile(data));
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
