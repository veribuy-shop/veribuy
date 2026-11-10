import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { requireRole, createAuthHeaders } from '@/lib/api-auth';
import { friendlyApiError } from '@/lib/api-errors';
import { isUuid, invalidIdResponse } from '@/lib/validate-id';

const ACTIONS = new Set(['retry', 'reverse', 'dismiss-flag']);

/** Admin actions on a seller payout. The backend decides whether money moves. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ payoutId: string; action: string }> }) {
  const authResult = await requireRole(request, 'ADMIN');
  if ('error' in authResult) return authResult.error;

  const { payoutId, action } = await params;
  if (!isUuid(payoutId)) return invalidIdResponse();
  if (!ACTIONS.has(action)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const response = await fetch(`${getBackendUrl()}/transactions/payouts/${payoutId}/${action}`, {
      method: 'POST',
      headers: createAuthHeaders(authResult.token),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json({ error: friendlyApiError(data, 'That did not work for this payout.') }, { status: response.status });
    }
    return NextResponse.json({ status: data?.status ?? null, failureReason: data?.failureReason ?? null });
  } catch (error) {
    console.error(`[Admin payout ${action}] failed:`, error);
    return NextResponse.json({ error: 'We could not reach the server. Please try again.' }, { status: 502 });
  }
}
