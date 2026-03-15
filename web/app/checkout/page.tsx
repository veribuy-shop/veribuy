'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import Link from 'next/link';
import { formatPrice } from '@/lib/currency';
import { CircleCheck, CircleX, Truck, Clock } from 'lucide-react';
import {
  calculateShippingFee,
  formatShippingService,
  type ShippingService,
  type ShippingQuote,
} from '@/lib/shipping';

// SEC-15: Fail loudly if the Stripe publishable key is absent rather than
// silently passing an empty string, which would produce confusing Stripe errors.
const STRIPE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
if (!STRIPE_KEY) {
  // This runs at module evaluation time (client bundle). In development the
  // console error is immediately visible; in production a mis-configured deploy
  // will break checkout loudly rather than silently.
  console.error(
    '[VeriBuy] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. ' +
    'Stripe Elements will not initialise. Check your environment variables.'
  );
}
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

interface Listing {
  id: string;
  sellerId: string;
  title: string;
  price: number | string;
  currency: string;
  brand: string;
  model: string;
  deviceType: string;
}

interface PendingOrder {
  id: string;
  clientSecret: string;
  paymentIntentId: string;
}

interface CheckoutFormProps {
  listing: Listing;
  pendingOrder: PendingOrder;
  selectedService: ShippingService;
  shippingQuote: ShippingQuote | null;
  onServiceChange: (service: ShippingService) => void;
  onPostcodeChange: (postcode: string) => void;
}

function CheckoutForm({ listing, pendingOrder, selectedService, shippingQuote, onServiceChange, onPostcodeChange }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [succeeded, setSucceeded] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Shipping address form state
  const [shippingAddress, setShippingAddress] = useState({
    name: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'GB',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setShippingAddress(prev => ({ ...prev, [name]: value }));
    if (name === 'postal_code') {
      onPostcodeChange(value);
    }
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    setShippingAddress(prev => ({ ...prev, country: value }));
    if (validationErrors.country) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.country;
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!shippingAddress.name || shippingAddress.name.trim().length < 2) {
      errors.name = 'Full name must be at least 2 characters';
    }

    if (!shippingAddress.line1 || shippingAddress.line1.trim().length < 5) {
      errors.line1 = 'Address must be at least 5 characters';
    }

    if (!shippingAddress.city || shippingAddress.city.trim().length < 2) {
      errors.city = 'City must be at least 2 characters';
    }

    if (!shippingAddress.state || shippingAddress.state.trim().length < 2) {
      errors.state = 'State/Province is required';
    }

    if (!shippingAddress.postal_code || shippingAddress.postal_code.trim().length < 3) {
      errors.postal_code = 'Valid postal code is required';
    }

    if (!shippingAddress.country || shippingAddress.country.length !== 2) {
      errors.country = 'Please select a country';
    }

    if (!shippingQuote) {
      errors.postal_code = 'Enter a valid UK postcode to calculate shipping';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const itemPrice = typeof listing.price === 'string' ? parseFloat(listing.price) : listing.price;
  const totalPrice = shippingQuote ? Math.round((itemPrice + shippingQuote.totalFee) * 100) / 100 : itemPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError('Payment system not ready. Please refresh the page.');
      return;
    }

    if (!validateForm()) {
      setError('Please fix the errors in the form before proceeding.');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      // Step 1: Update shipping details on the order + Stripe PaymentIntent
      // before confirming payment so the charged amount matches the displayed total.
      if (shippingQuote) {
        const updateRes = await fetch('/api/checkout/update-shipping', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            orderId: pendingOrder.id,
            shippingFee: shippingQuote.totalFee,
            shippingService: selectedService,
          }),
        });

        if (!updateRes.ok) {
          const errData = await updateRes.json();
          throw new Error(errData.error || 'Failed to update shipping details');
        }
      }

      // Step 2: Confirm payment with Stripe using PaymentElement
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders/${pendingOrder.id}`,
          payment_method_data: {
            billing_details: {
              name: shippingAddress.name,
              address: {
                line1: shippingAddress.line1,
                line2: shippingAddress.line2 || undefined,
                city: shippingAddress.city,
                state: shippingAddress.state,
                postal_code: shippingAddress.postal_code,
                country: shippingAddress.country,
              },
            },
          },
        },
        redirect: 'if_required',
      });

      if (stripeError) {
        throw new Error(stripeError.message || 'Payment failed. Please check your card details.');
      }

      if (!paymentIntent || paymentIntent.status !== 'succeeded') {
        throw new Error('Payment was not completed. Please try again.');
      }

      // Step 3: Confirm payment on backend
      const confirmResponse = await fetch('/api/checkout/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId: pendingOrder.id,
          paymentIntentId: paymentIntent.id || pendingOrder.paymentIntentId,
        }),
      });

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json();
        throw new Error(errorData.error || 'Failed to confirm payment');
      }

      setSucceeded(true);

      // Redirect to order confirmation after 2 seconds
      setTimeout(() => {
        router.push(`/orders/${pendingOrder.id}`);
      }, 2000);

    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'An error occurred during checkout. Please try again.');
      setProcessing(false);
    }
  };

  if (succeeded) {
    return (
      <div className="text-center py-12">
        <CircleCheck aria-hidden="true" className="inline-block h-16 w-16 text-[var(--color-success)] mb-4" />
        <h2 className="text-2xl font-bold text-[var(--color-success)] mb-2">Payment Successful!</h2>
        <p className="text-[var(--color-text-muted)]">Redirecting to order confirmation...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Shipping Address */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
        <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Shipping Address</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="shipping-name" className="block text-sm font-medium text-[var(--color-text)] mb-1">Full Name</label>
            <input
              id="shipping-name"
              type="text"
              name="name"
              required
              autoComplete="name"
              value={shippingAddress.name}
              onChange={handleInputChange}
              aria-describedby={validationErrors.name ? 'error-name' : undefined}
              aria-invalid={!!validationErrors.name}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent ${
                validationErrors.name ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
              }`}
              placeholder="Jane Smith"
            />
            {validationErrors.name && (
              <p id="error-name" className="mt-1 text-sm text-[var(--color-danger)]">{validationErrors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="shipping-line1" className="block text-sm font-medium text-[var(--color-text)] mb-1">Address Line 1</label>
            <input
              id="shipping-line1"
              type="text"
              name="line1"
              required
              autoComplete="address-line1"
              value={shippingAddress.line1}
              onChange={handleInputChange}
              aria-describedby={validationErrors.line1 ? 'error-line1' : undefined}
              aria-invalid={!!validationErrors.line1}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent ${
                validationErrors.line1 ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
              }`}
              placeholder="1 Example Street"
            />
            {validationErrors.line1 && (
              <p id="error-line1" className="mt-1 text-sm text-[var(--color-danger)]">{validationErrors.line1}</p>
            )}
          </div>

          <div>
            <label htmlFor="shipping-line2" className="block text-sm font-medium text-[var(--color-text)] mb-1">Address Line 2 (Optional)</label>
            <input
              id="shipping-line2"
              type="text"
              name="line2"
              autoComplete="address-line2"
              value={shippingAddress.line2}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
              placeholder="Flat 4B"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="shipping-city" className="block text-sm font-medium text-[var(--color-text)] mb-1">City</label>
              <input
                id="shipping-city"
                type="text"
                name="city"
                required
                autoComplete="address-level2"
                value={shippingAddress.city}
                onChange={handleInputChange}
                aria-describedby={validationErrors.city ? 'error-city' : undefined}
                aria-invalid={!!validationErrors.city}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent ${
                  validationErrors.city ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
                }`}
                placeholder="London"
              />
              {validationErrors.city && (
                <p id="error-city" className="mt-1 text-sm text-[var(--color-danger)]">{validationErrors.city}</p>
              )}
            </div>

            <div>
              <label htmlFor="shipping-state" className="block text-sm font-medium text-[var(--color-text)] mb-1">County / State</label>
              <input
                id="shipping-state"
                type="text"
                name="state"
                required
                autoComplete="address-level1"
                value={shippingAddress.state}
                onChange={handleInputChange}
                aria-describedby={validationErrors.state ? 'error-state' : undefined}
                aria-invalid={!!validationErrors.state}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent ${
                  validationErrors.state ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
                }`}
                placeholder="Greater London"
              />
              {validationErrors.state && (
                <p id="error-state" className="mt-1 text-sm text-[var(--color-danger)]">{validationErrors.state}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="shipping-postal" className="block text-sm font-medium text-[var(--color-text)] mb-1">Postal Code</label>
              <input
                id="shipping-postal"
                type="text"
                name="postal_code"
                required
                autoComplete="postal-code"
                value={shippingAddress.postal_code}
                onChange={handleInputChange}
                aria-describedby={validationErrors.postal_code ? 'error-postal' : undefined}
                aria-invalid={!!validationErrors.postal_code}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent ${
                  validationErrors.postal_code ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
                }`}
                placeholder="SW1A 1AA"
              />
              {validationErrors.postal_code && (
                <p id="error-postal" className="mt-1 text-sm text-[var(--color-danger)]">{validationErrors.postal_code}</p>
              )}
            </div>

            <div>
              <label htmlFor="shipping-country" className="block text-sm font-medium text-[var(--color-text)] mb-1">Country</label>
              <select
                id="shipping-country"
                name="country"
                required
                autoComplete="country"
                value={shippingAddress.country}
                onChange={handleCountryChange}
                aria-describedby={validationErrors.country ? 'error-country' : undefined}
                aria-invalid={!!validationErrors.country}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent bg-white ${
                  validationErrors.country ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
                }`}
              >
                <option value="GB">United Kingdom</option>
              </select>
              {validationErrors.country && (
                <p id="error-country" className="mt-1 text-sm text-[var(--color-danger)]">{validationErrors.country}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Shipping Service */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
        <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Shipping Service</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          All orders are shipped via Royal Mail with tracking and photo on delivery.
        </p>

        {shippingQuote ? (
          <div className="space-y-3">
            {(['TRACKED_48', 'TRACKED_24'] as ShippingService[]).map((svc) => {
              const quote = calculateShippingFee(listing.deviceType, shippingAddress.postal_code, svc);
              const isSelected = selectedService === svc;
              return (
                <label
                  key={svc}
                  className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-[var(--color-green)] bg-[var(--color-green)]/5'
                      : 'border-[var(--color-border)] hover:border-[var(--color-green)]/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="shippingService"
                    value={svc}
                    checked={isSelected}
                    onChange={() => onServiceChange(svc)}
                    className="accent-[var(--color-green)]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {svc === 'TRACKED_24' ? (
                        <Truck aria-hidden="true" className="h-4 w-4 text-[var(--color-green)]" />
                      ) : (
                        <Clock aria-hidden="true" className="h-4 w-4 text-[var(--color-text-muted)]" />
                      )}
                      <span className="font-medium text-[var(--color-text)]">{quote.label}</span>
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">{quote.estimate}</p>
                    {quote.surcharge > 0 && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        Includes {formatPrice(quote.surcharge, 'GBP')} remote area surcharge
                      </p>
                    )}
                  </div>
                  <span className="font-semibold text-[var(--color-text)]">
                    {formatPrice(quote.totalFee, 'GBP')}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="p-4 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-muted)]">
            Enter your postcode above to see shipping options.
          </div>
        )}
      </div>

      {/* Payment Information */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
        <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Payment Information</h2>

        <div className="border border-[var(--color-border)] rounded-lg p-4">
          <PaymentElement
            options={{
              layout: 'tabs',
              wallets: { applePay: 'never', googlePay: 'never', link: 'never' },
            }}
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div role="alert" className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg p-4 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || processing || !shippingQuote}
        className={`w-full px-6 py-3 rounded-lg font-semibold text-white ${
          !stripe || processing || !shippingQuote
            ? 'bg-[var(--color-border)] cursor-not-allowed'
            : 'bg-[var(--color-accent)] hover:opacity-90'
        }`}
      >
        {processing
          ? 'Processing...'
          : `Pay ${formatPrice(totalPrice, listing.currency)}`
        }
      </button>
      {!shippingQuote && (
        <p className="text-xs text-center text-[var(--color-text-muted)]">
          Enter your postcode to enable payment.
        </p>
      )}
    </form>
  );
}

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Shipping state
  const [selectedService, setSelectedService] = useState<ShippingService>('TRACKED_48');
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null);
  const [postcode, setPostcode] = useState('');

  const listingId = searchParams.get('listingId');

  // Guard against double order creation (React 18 Strict Mode runs effects twice)
  const initRef = useRef(false);

  useEffect(() => {
    if (!user) {
      router.push(`/login?redirect=/checkout?listingId=${listingId}`);
      return;
    }

    if (!listingId) {
      setError('No listing ID provided');
      setLoading(false);
      return;
    }

    if (initRef.current) return;
    initRef.current = true;

    initCheckout();
  }, [listingId, user?.id]); // PERF-07: depend on user?.id (primitive) not user object to avoid stale-closure re-runs

  const initCheckout = async () => {
    try {
      // Step 1: Fetch listing details
      const listingResponse = await fetch(`/api/listings/${listingId}`);
      if (!listingResponse.ok) {
        throw new Error('Failed to fetch listing');
      }
      const listingData = await listingResponse.json();
      setListing(listingData);

      // Compute a default shipping fee (cheapest: TRACKED_48, mainland UK)
      const defaultQuote = calculateShippingFee(
        listingData.deviceType || 'OTHER',
        'SW1A 1AA', // default mainland postcode for initial PaymentIntent
        'TRACKED_48',
      );

      // Step 2: Pre-create the order to get a clientSecret for PaymentElement.
      // The shipping fee is set to the default mainland TRACKED_48 rate. It will
      // be updated via PATCH /update-shipping before payment confirmation once
      // the buyer enters their real postcode and selects a service tier.
      const createOrderResponse = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        // SEC-05: buyerId is intentionally omitted — the BFF API route derives it
        // from the verified JWT token. Never trust client-supplied identity fields.
        body: JSON.stringify({
          sellerId: listingData.sellerId,
          listingId: listingData.id,
          amount:
            typeof listingData.price === 'string'
              ? parseFloat(listingData.price)
              : listingData.price,
          currency: listingData.currency,
          shippingFee: defaultQuote.totalFee,
          shippingService: 'TRACKED_48',
          // shippingAddress will be collected from the form
          shippingAddress: null,
        }),
      });

      if (!createOrderResponse.ok) {
        const errData = await createOrderResponse.json();
        throw new Error(errData.error || 'Failed to initialise checkout');
      }

      const orderWithPayment = await createOrderResponse.json();

      if (!orderWithPayment.clientSecret) {
        throw new Error('Payment intent creation failed. Please try again.');
      }

      setPendingOrder({
        id: orderWithPayment.id,
        clientSecret: orderWithPayment.clientSecret,
        paymentIntentId: orderWithPayment.paymentIntentId,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load checkout');
    } finally {
      setLoading(false);
    }
  };

  // Recalculate shipping when postcode or service changes
  const handlePostcodeChange = (newPostcode: string) => {
    setPostcode(newPostcode);
    if (newPostcode.trim().length >= 2 && listing) {
      const quote = calculateShippingFee(listing.deviceType, newPostcode, selectedService);
      setShippingQuote(quote);
    } else {
      setShippingQuote(null);
    }
  };

  const handleServiceChange = (service: ShippingService) => {
    setSelectedService(service);
    if (postcode.trim().length >= 2 && listing) {
      const quote = calculateShippingFee(listing.deviceType, postcode, service);
      setShippingQuote(quote);
    }
  };

  const itemPrice = listing
    ? typeof listing.price === 'string' ? parseFloat(listing.price) : listing.price
    : 0;
  const totalPrice = shippingQuote
    ? Math.round((itemPrice + shippingQuote.totalFee) * 100) / 100
    : itemPrice;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div role="status" className="text-center">
          <div aria-hidden="true" className="inline-block motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-green)]"></div>
          <span className="sr-only">Loading checkout...</span>
          <p aria-hidden="true" className="mt-4 text-[var(--color-text-muted)]">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (error || !listing || !pendingOrder) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div role="alert" className="max-w-md w-full bg-white rounded-xl border border-[var(--color-border)] p-8 text-center">
          <CircleX aria-hidden="true" className="inline-block h-16 w-16 text-[var(--color-danger)] mb-4" />
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-4">Checkout Error</h1>
          <p className="text-[var(--color-text-muted)] mb-6">{error || 'Unable to load checkout'}</p>
          <Link
            href="/browse"
            className="inline-block px-6 py-3 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90"
          >
            Back to Browse
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/listings/${listing.id}`}
            className="text-sm text-[var(--color-green)] hover:text-[var(--color-green-dark)] mb-2 inline-block"
          >
            <span aria-hidden="true">&larr;</span> Back to Listing
          </Link>
          <h1 className="text-3xl font-bold text-[var(--color-text)]">Checkout</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: pendingOrder.clientSecret,
                appearance: {
                  theme: 'stripe',
                },
              }}
            >
              <CheckoutForm
                listing={listing}
                pendingOrder={pendingOrder}
                selectedService={selectedService}
                shippingQuote={shippingQuote}
                onServiceChange={handleServiceChange}
                onPostcodeChange={handlePostcodeChange}
              />
            </Elements>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 sticky top-4">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Order Summary</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Item:</span>
                  <span className="font-medium text-[var(--color-text)]">{listing.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Brand:</span>
                  <span className="font-medium text-[var(--color-text)]">{listing.brand}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Model:</span>
                  <span className="font-medium text-[var(--color-text)]">{listing.model}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Subtotal:</span>
                  <span className="font-medium">{formatPrice(listing.price, listing.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Shipping:</span>
                  {shippingQuote ? (
                    <span className="font-medium text-[var(--color-text)]">
                      {formatPrice(shippingQuote.totalFee, 'GBP')}
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-muted)] italic">Enter postcode</span>
                  )}
                </div>
                {shippingQuote && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">
                      {formatShippingService(selectedService)}
                    </span>
                    <span className="text-[var(--color-text-muted)]">
                      {shippingQuote.estimate}
                    </span>
                  </div>
                )}
                {shippingQuote && shippingQuote.surcharge > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">Remote area surcharge</span>
                    <span className="text-[var(--color-text-muted)]">
                      {formatPrice(shippingQuote.surcharge, 'GBP')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                  <span>Total:</span>
                  <span className="text-[var(--color-text)]">
                    {formatPrice(totalPrice, listing.currency)}
                  </span>
                </div>
              </div>

              <div className="mt-6 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg p-4 text-sm text-[var(--color-text)]">
                <strong>Buyer Protection</strong>
                <p className="mt-1 text-[var(--color-text-muted)]">Your payment is held in escrow until you confirm receipt of the device.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div role="status" className="text-center">
          <div aria-hidden="true" className="inline-block motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-green)]"></div>
          <span className="sr-only">Loading checkout...</span>
          <p aria-hidden="true" className="mt-4 text-[var(--color-text-muted)]">Loading checkout...</p>
        </div>
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  );
}
