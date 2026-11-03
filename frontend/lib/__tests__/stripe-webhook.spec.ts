import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { POST } from '../../app/api/webhooks/stripe/route';

const secret = 'whsec_test_secret';
const body = JSON.stringify({ id: 'evt_1', object: 'event', type: 'account.updated', data: { object: {} } });

const post = (signature?: string) =>
  POST(
    new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body,
      headers: signature ? { 'stripe-signature': signature } : {},
    }),
  );

describe('Stripe webhook', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    delete process.env.STRIPE_SECRET_KEY;
  });

  it('accepts a correctly signed event without the Stripe secret key', async () => {
    const response = await post(Stripe.webhooks.generateTestHeaderString({ payload: body, secret }));
    expect(response.status).toBe(200);
  });

  it('rejects a missing or forged signature', async () => {
    expect((await post()).status).toBe(400);
    const forged = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: 'whsec_wrong' });
    expect((await post(forged)).status).toBe(400);
  });

  it('refuses everything until the signing secret is set', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await expect(post('t=1,v1=anything')).rejects.toThrow('STRIPE_WEBHOOK_SECRET');
  });
});
