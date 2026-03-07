import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3007';

// Internal service header value — must match what transaction-service and notification-service check
const INTERNAL_SERVICE_HEADER = process.env.INTERNAL_SERVICE_TOKEN || 'veribuy-bff';

// Initialize Stripe lazily to avoid build-time errors
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-01-28.clover',
  });
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
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
    console.error('[Stripe Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Look up an order by its Stripe PaymentIntent ID.
 * Returns null if not found or if the request fails.
 */
async function fetchOrderByPaymentIntentId(paymentIntentId: string): Promise<Record<string, any> | null> {
  try {
    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/by-payment-intent/${encodeURIComponent(paymentIntentId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': INTERNAL_SERVICE_HEADER,
        },
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      console.error('[Stripe Webhook] Failed to fetch order by paymentIntentId:', response.status);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('[Stripe Webhook] Error fetching order:', err);
    return null;
  }
}

/**
 * Update the status of an order via the transaction service.
 * Uses the x-internal-service confirm-payment endpoint so no user JWT is needed
 * for payment confirmation (the order ownership was already established at creation).
 */
async function confirmOrderPayment(orderId: string, paymentIntentId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/${orderId}/confirm-payment/internal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': INTERNAL_SERVICE_HEADER,
        },
        body: JSON.stringify({ paymentIntentId }),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error('[Stripe Webhook] confirm-payment failed:', response.status, data);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Stripe Webhook] Error confirming payment:', err);
    return false;
  }
}

/**
 * Cancel an order via the transaction service.
 * Uses x-internal-service header — transaction-service needs this endpoint
 * accessible internally (it already is: ESCROW_HELD → CANCELLED is allowed).
 */
async function cancelOrder(orderId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/${orderId}/status/internal`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': INTERNAL_SERVICE_HEADER,
        },
        body: JSON.stringify({ status: 'CANCELLED' }),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error('[Stripe Webhook] cancel order failed:', response.status, data);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Stripe Webhook] Error cancelling order:', err);
    return false;
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('[Stripe Webhook] Payment succeeded:', paymentIntent.id);

  // Look up the order by paymentIntentId
  const order = await fetchOrderByPaymentIntentId(paymentIntent.id);

  if (!order) {
    console.warn('[Stripe Webhook] No order found for paymentIntentId:', paymentIntent.id);
    return;
  }

  // Only process if still in PENDING — the frontend confirm-payment call may
  // have already advanced the order to PAYMENT_RECEIVED / ESCROW_HELD.
  if (order.status !== 'PENDING') {
    console.log(
      `[Stripe Webhook] Order ${order.id} already in status ${order.status} — skipping confirm-payment`
    );
    return;
  }

  const ok = await confirmOrderPayment(order.id, paymentIntent.id);
  if (ok) {
    console.log(`[Stripe Webhook] Order ${order.id} confirmed via webhook`);
  } else {
    console.error(`[Stripe Webhook] Failed to confirm order ${order.id} via webhook`);
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('[Stripe Webhook] Payment failed:', paymentIntent.id);

  const order = await fetchOrderByPaymentIntentId(paymentIntent.id);

  if (!order) {
    console.warn('[Stripe Webhook] No order found for failed paymentIntentId:', paymentIntent.id);
    return;
  }

  // Only cancel orders that are still PENDING (haven't been manually resolved)
  if (order.status !== 'PENDING') {
    console.log(
      `[Stripe Webhook] Order ${order.id} in status ${order.status} — not cancelling on payment failure`
    );
    return;
  }

  const ok = await cancelOrder(order.id);
  if (ok) {
    console.log(`[Stripe Webhook] Order ${order.id} cancelled due to payment failure`);
  } else {
    console.error(`[Stripe Webhook] Failed to cancel order ${order.id} after payment failure`);
  }
}

/**
 * Update an order to REFUNDED status via the transaction service.
 * Used when Stripe fires a charge.refunded event (e.g. dispute resolved in dashboard).
 */
async function refundOrder(orderId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders/${orderId}/status/internal`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': INTERNAL_SERVICE_HEADER,
        },
        body: JSON.stringify({ status: 'REFUNDED' }),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error('[Stripe Webhook] refund order failed:', response.status, data);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Stripe Webhook] Error refunding order:', err);
    return false;
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  console.log('[Stripe Webhook] Charge refunded:', charge.id);

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

  const ok = await refundOrder(order.id);
  if (ok) {
    console.log(`[Stripe Webhook] Order ${order.id} marked as REFUNDED via webhook`);
  } else {
    console.error(`[Stripe Webhook] Failed to mark order ${order.id} as REFUNDED`);
  }
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

  const ok = await cancelOrder(order.id);
  if (ok) {
    console.log(`[Stripe Webhook] Order ${order.id} cancelled due to payment intent cancellation`);
  } else {
    console.error(`[Stripe Webhook] Failed to cancel order ${order.id} after PI cancellation`);
  }
}
