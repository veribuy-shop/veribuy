import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    // Require an authenticated session — token must be present in HttpOnly cookie
    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Basic presence check — full validation is done by auth-service DTO
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'currentPassword and newPassword are required' },
        { status: 400 },
      );
    }

    const response = await fetch(`${AUTH_SERVICE_URL}/auth/change-password`, {
      method: 'POST',
      headers: createAuthHeaders(authResult.token),
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to update password' },
        { status: response.status },
      );
    }

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('[change-password] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
