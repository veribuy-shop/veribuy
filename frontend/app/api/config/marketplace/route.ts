import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

const BACKEND_URL = getBackendUrl();

/**
 * GET /api/config/marketplace
 *
 * Public marketplace rules, set by backend environment variables. This proxies
 * them so browser displays match the server without a frontend rebuild.
 */
export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/transactions/config/marketplace`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to load marketplace configuration' },
        { status: response.status },
      );
    }

    return NextResponse.json(await response.json(), {
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to load marketplace configuration' },
      { status: 502 },
    );
  }
}
