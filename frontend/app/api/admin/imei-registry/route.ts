import { NextRequest, NextResponse } from 'next/server';
import { requireRole, createAuthHeaders } from '@/lib/api-auth';
import { getBackendUrl } from '@/lib/backend-url';

const BACKEND_URL = getBackendUrl();

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const page = searchParams.get('page') || '1';
    const search = searchParams.get('search');
    const flagged = searchParams.get('flagged');

    const backendUrl = new URL(`${BACKEND_URL}/trust-lens/imei-registry`);
    backendUrl.searchParams.set('limit', limit);
    backendUrl.searchParams.set('page', page);
    if (search) backendUrl.searchParams.set('search', search);
    if (flagged) backendUrl.searchParams.set('flagged', flagged);

    const response = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: createAuthHeaders(authResult.token),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || 'Failed to fetch IMEI registry' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Admin IMEI Registry API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
