import React from 'react';

export function StripeProvider({
  children,
}: {
  children: React.ReactNode;
  publishableKey?: string;
  urlScheme?: string;
  [key: string]: unknown;
}) {
  return React.createElement(React.Fragment, null, children);
}

// Stripe's native PaymentSheet doesn't exist on web. Fail loudly rather than
// pretend a payment succeeded — buyers on the web use veribuy.shop.
const WEB_UNAVAILABLE = {
  code: 'Unavailable',
  message: 'Payments are not available in the web preview. Please use the VeriBuy app or veribuy.shop.',
};

export async function initPaymentSheet(
  _params: unknown,
): Promise<{ error?: { code?: string; message: string } | null }> {
  return { error: WEB_UNAVAILABLE };
}

export async function presentPaymentSheet(): Promise<{ error?: { code?: string; message: string } | null }> {
  return { error: WEB_UNAVAILABLE };
}
