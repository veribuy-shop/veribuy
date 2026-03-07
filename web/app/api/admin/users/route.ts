import { NextRequest, NextResponse } from 'next/server';
import { requireRole, createAuthHeaders } from '@/lib/api-auth';
import { sanitizeUser, sanitizePaginated } from '@/lib/sanitize';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    // Require ADMIN role
    const authResult = requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    const response = await fetch(`${AUTH_SERVICE_URL}/auth/users`, {
      method: 'GET',
      headers: createAuthHeaders(authResult.token),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || 'Failed to fetch users' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(sanitizePaginated(data, sanitizeUser));
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
