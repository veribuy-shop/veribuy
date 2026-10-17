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

export async function initPaymentSheet(_params: unknown): Promise<{ error?: { message: string } | null }> {
  return { error: null };
}

export async function presentPaymentSheet(): Promise<{ error?: { message: string } | null }> {
  return { error: null };
}
