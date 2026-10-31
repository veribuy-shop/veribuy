import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getBackendUrl } from '@/lib/backend-url';

const TRANSACTION_SERVICE_URL = getBackendUrl();

// Read at request time — throwing at module scope breaks Next.js build-time
// static analysis (page-data collection runs without env vars).
function getInternalServiceToken(): string {
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token) {
    throw new Error(
      '[Stripe Webhook] INTERNAL_SERVICE_TOKEN environment variable is not set. ' +
      'This is required for internal service-to-service authentication.',
    );
  }
  return token;
}

// Initialize Stripe lazily to avoid build-time errors
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-01-28.clover',
  });
}

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      '[Stripe Webhook] STRIPE_WEBHOOK_SECRET environment variable is not set. ' +
      'Webhook signature verification cannot proceed without it.',
    );
  }
  return secret;
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = getWebhookSecret();
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('[Stripe Webhook] Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log('[Stripe Webhook] Received event:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        console.log('[Stripe Webhook] Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // A non-2xx response makes Stripe retry the event with backoff, so a
    // transient backend failure can't leave a paid order stuck in PENDING.
    console.error('[Stripe Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/** Thrown for transient failures so the POST handler returns 5xx and Stripe retries. */
class RetryableWebhookError extends Error {}

type OrderLookup = Record<string, any> | null;

/**
 * Look up an order by its Stripe PaymentIntent ID.
 * Returns null if no order exists; throws RetryableWebhookError on transient failure.
 */
async function fetchOrderByPaymentIntentId(paymentIntentId: string): Promise<OrderLookup> {
  let response: Response;
  try {
    response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/by-payment-intent/${encodeURIComponent(paymentIntentId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': getInternalServiceToken(),
        },
        signal: AbortSignal.timeout(8000),
      }
    );
  } catch (err) {
    throw new RetryableWebhookError(`Order lookup failed: ${(err as Error).message}`);
  }

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new RetryableWebhookError(`Order lookup returned ${response.status}`);
  }
  return response.json();
}

/**
 * Call an internal transaction endpoint. 5xx / network errors are retryable;
 * 4xx means the backend rejected the transition on purpose (e.g. already
 * handled) and retrying would not help, so it is logged and acknowledged.
 */
async function callInternal(path: string, method: 'POST' | 'PATCH', payload: unknown, label: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${TRANSACTION_SERVICE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': getInternalServiceToken(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new RetryableWebhookError(`${label} failed: ${(err as Error).message}`);
  }

  if (response.status >= 500) {
    throw new RetryableWebhookError(`${label} returned ${response.status}`);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    console.warn(`[Stripe Webhook] ${label} rejected:`, response.status, data);
    return;
  }
  console.log(`[Stripe Webhook] ${label} succeeded`);
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('[Stripe Webhook] Payment succeeded:', paymentIntent.id);

  const order = await fetchOrderByPaymentIntentId(paymentIntent.id);
  if (!order) {
    console.warn('[Stripe Webhook] No order found for paymentIntentId:', paymentIntent.id);
    return;
  }

  // PENDING is the normal case. CANCELLED means the checkout expired before a
  // slow (3DS/BNPL) payment completed — the backend revives or auto-refunds it.
  if (order.status !== 'PENDING' && order.status !== 'CANCELLED') {
    console.log(`[Stripe Webhook] Order ${order.id} already in status ${order.status} — skipping`);
    return;
  }

  await callInternal(
    `/transactions/orders/${encodeURIComponent(order.id)}/confirm-payment/internal`,
    'POST',
    { paymentIntentId: paymentIntent.id },
    `confirm-payment for order ${order.id}`,
  );
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  // A declined attempt is not terminal: the buyer can retry with another card on
  // the same PaymentIntent. Cancelling here would strand a later successful
  // payment, so the order stays PENDING until it succeeds, is cancelled, or expires.
  console.log(
    '[Stripe Webhook] Payment attempt failed (order left pending for retry):',
    paymentIntent.id,
    paymentIntent.last_payment_error?.code ?? '',
  );
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  console.log('[Stripe Webhook] Charge refunded:', charge.id);

  // Partial refunds (e.g. goodwill adjustments) don't end the order.
  if (!charge.refunded) {
    console.log(`[Stripe Webhook] Charge ${charge.id} only partially refunded — order unchanged`);
    return;
  }

  if (!charge.payment_intent) {
    console.warn('[Stripe Webhook] No payment intent associated with charge');
    return;
  }

  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent.id;

  const order = await fetchOrderByPaymentIntentId(paymentIntentId);
  if (!order) {
    console.warn('[Stripe Webhook] No order found for refunded paymentIntentId:', paymentIntentId);
    return;
  }

  // If already REFUNDED (e.g. admin refund flow already handled it), skip
  if (order.status === 'REFUNDED') {
    console.log(`[Stripe Webhook] Order ${order.id} already REFUNDED — skipping`);
    return;
  }

  await callInternal(
    `/transactions/orders/${encodeURIComponent(order.id)}/status/internal`,
    'PATCH',
    { status: 'REFUNDED' },
    `mark order ${order.id} REFUNDED`,
  );
}

async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  console.log('[Stripe Webhook] Payment intent canceled:', paymentIntent.id);

  const order = await fetchOrderByPaymentIntentId(paymentIntent.id);
  if (!order) {
    console.warn('[Stripe Webhook] No order found for canceled paymentIntentId:', paymentIntent.id);
    return;
  }

  // Only cancel orders that are still PENDING
  if (order.status !== 'PENDING') {
    console.log(
      `[Stripe Webhook] Order ${order.id} in status ${order.status} — not cancelling on PI cancellation`
    );
    return;
  }

  await callInternal(
    `/transactions/orders/${encodeURIComponent(order.id)}/status/internal`,
    'PATCH',
    { status: 'CANCELLED' },
    `cancel order ${order.id}`,
  );
}
