import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders } from '@/lib/api-auth';
import { getBackendUrl } from '@/lib/backend-url';
import { friendlyApiError } from '@/lib/api-errors';

/** Seller payout routes. The backend acts on the signed-in user only, so no user id is passed. */
const READS: Record<string, string> = {
  account: 'account',
  history: 'mine',
};
const ACTIONS: Record<string, string> = {
  'onboarding-link': 'account/onboarding-link',
  'dashboard-link': 'account/dashboard-link',
};

async function forward(request: NextRequest, method: 'GET' | 'POST', backendPath: string | undefined) {
  if (!backendPath) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const authResult = getAccessToken(request);
  if ('error' in authResult) return authResult.error;

  try {
    const response = await fetch(`${getBackendUrl()}/transactions/payouts/${backendPath}`, {
      method,
      headers: createAuthHeaders(authResult.token),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        { error: friendlyApiError(data, 'We could not load your payout details. Please try again.') },
        { status: response.status },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[Payouts] ${backendPath} failed:`, error);
    return NextResponse.json({ error: 'We could not reach the server. Please try again.' }, { status: 502 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  return forward(request, 'GET', READS[(await params).action]);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  return forward(request, 'POST', ACTIONS[(await params).action]);
}
