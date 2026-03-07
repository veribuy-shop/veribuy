import { NextRequest, NextResponse } from 'next/server';
import { requireRole, createAuthHeaders } from '@/lib/api-auth';
import { sanitizeUser } from '@/lib/sanitize';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH /api/admin/users/[userId] - Update user (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Require ADMIN role
    const authResult = requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    const { userId } = await params;

    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    const body = await request.json();

    // Forward request to auth service
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/admin/users/${userId}`, {
      method: 'PATCH',
      headers: createAuthHeaders(authResult.token),
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to update user' },
        { status: response.status }
      );
    }

    return NextResponse.json(sanitizeUser(data));
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[userId] - Delete user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Require ADMIN role
    const authResult = requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    const { userId } = await params;

    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    // Forward request to auth service
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/admin/users/${userId}`, {
      method: 'DELETE',
      headers: createAuthHeaders(authResult.token),
    });

    if (!response.ok) {
      const data = await response.json();
      return NextResponse.json(
        { error: data.message || 'Failed to delete user' },
        { status: response.status }
      );
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
