import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';

const EVIDENCE_SERVICE_URL = process.env.EVIDENCE_SERVICE_URL || 'http://localhost:3006';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;

    if (!itemId || typeof itemId !== 'string' || itemId.trim() === '') {
      return NextResponse.json({ error: 'Invalid evidence item ID' }, { status: 400 });
    }

    const authResult = getAccessToken(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const response = await fetch(`${EVIDENCE_SERVICE_URL}/evidence/items/${itemId}`, {
      method: 'DELETE',
      headers: createAuthHeaders(authResult.token),
    });

    if (!response.ok) {
      // Evidence service returns 204 on success — non-ok means an actual error
      let errorMessage = 'Failed to delete evidence item';
      try {
        const data = await response.json();
        errorMessage = data.message || errorMessage;
      } catch {
        // body may be empty on some errors
      }
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete evidence item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
