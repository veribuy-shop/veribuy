import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

const BACKEND_URL = getBackendUrl();

/**
 * GET /api/config/fees
 *
 * Public runtime fee configuration. The Buyer Protection Fee is server-owned
 * (backend BUYER_PROTECTION_FEE_PERCENT); this proxies it so browser displays
 * always show the authoritative rate without a frontend rebuild.
 */
export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/transactions/config/fees`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to load fee configuration' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(
      { buyerProtectionFeePercent: data.buyerProtectionFeePercent },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to load fee configuration' },
      { status: 502 },
    );
  }
}
