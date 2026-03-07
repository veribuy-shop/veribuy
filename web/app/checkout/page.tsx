'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import Link from 'next/link';
import { formatPrice } from '@/lib/currency';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface Listing {
  id: string;
  sellerId: string;
  title: string;
  price: number | string;
  currency: string;
  brand: string;
  model: string;
}

interface PendingOrder {
  id: string;
  clientSecret: string;
  paymentIntentId: string;
}

interface CheckoutFormProps {
  listing: Listing;
  pendingOrder: PendingOrder;
}

function CheckoutForm({ listing, pendingOrder }: CheckoutFormProps) {
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

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

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
      // Confirm payment with Stripe using PaymentElement
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

      // Confirm payment on backend
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
        <div aria-hidden="true" className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-green-600 mb-2">Payment Successful!</h2>
        <p className="text-gray-600">Redirecting to order confirmation...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Shipping Address */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Shipping Address</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="shipping-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
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
              className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Jane Smith"
            />
            {validationErrors.name && (
              <p id="error-name" className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="shipping-line1" className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
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
              className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.line1 ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="1 Example Street"
            />
            {validationErrors.line1 && (
              <p id="error-line1" className="mt-1 text-sm text-red-600">{validationErrors.line1}</p>
            )}
          </div>

          <div>
            <label htmlFor="shipping-line2" className="block text-sm font-medium text-gray-700 mb-1">Address Line 2 (Optional)</label>
            <input
              id="shipping-line2"
              type="text"
              name="line2"
              autoComplete="address-line2"
              value={shippingAddress.line2}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Flat 4B"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="shipping-city" className="block text-sm font-medium text-gray-700 mb-1">City</label>
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
                className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.city ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="London"
              />
              {validationErrors.city && (
                <p id="error-city" className="mt-1 text-sm text-red-600">{validationErrors.city}</p>
              )}
            </div>

            <div>
              <label htmlFor="shipping-state" className="block text-sm font-medium text-gray-700 mb-1">County / State</label>
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
                className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.state ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Greater London"
              />
              {validationErrors.state && (
                <p id="error-state" className="mt-1 text-sm text-red-600">{validationErrors.state}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="shipping-postal" className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
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
                className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.postal_code ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="SW1A 1AA"
              />
              {validationErrors.postal_code && (
                <p id="error-postal" className="mt-1 text-sm text-red-600">{validationErrors.postal_code}</p>
              )}
            </div>

            <div>
              <label htmlFor="shipping-country" className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <select
                id="shipping-country"
                name="country"
                required
                autoComplete="country"
                value={shippingAddress.country}
                onChange={handleCountryChange}
                aria-describedby={validationErrors.country ? 'error-country' : undefined}
                aria-invalid={!!validationErrors.country}
                className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white ${
                  validationErrors.country ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="GB">United Kingdom</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="AU">Australia</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="IT">Italy</option>
                <option value="ES">Spain</option>
                <option value="NL">Netherlands</option>
                <option value="SE">Sweden</option>
                <option value="NO">Norway</option>
                <option value="DK">Denmark</option>
                <option value="FI">Finland</option>
                <option value="IE">Ireland</option>
                <option value="BE">Belgium</option>
                <option value="AT">Austria</option>
                <option value="CH">Switzerland</option>
                <option value="NZ">New Zealand</option>
                <option value="SG">Singapore</option>
                <option value="HK">Hong Kong</option>
                <option value="JP">Japan</option>
                <option value="KR">South Korea</option>
                <option value="AE">United Arab Emirates</option>
                <option value="SA">Saudi Arabia</option>
                <option value="ZA">South Africa</option>
                <option value="BR">Brazil</option>
                <option value="MX">Mexico</option>
                <option value="AR">Argentina</option>
                <option value="CL">Chile</option>
                <option value="CO">Colombia</option>
                <option value="PE">Peru</option>
                <option value="IN">India</option>
                <option value="PK">Pakistan</option>
                <option value="BD">Bangladesh</option>
                <option value="NG">Nigeria</option>
                <option value="KE">Kenya</option>
                <option value="GH">Ghana</option>
                <option value="EG">Egypt</option>
                <option value="MA">Morocco</option>
                <option value="TN">Tunisia</option>
                <option value="IL">Israel</option>
                <option value="TR">Turkey</option>
                <option value="PL">Poland</option>
                <option value="CZ">Czech Republic</option>
                <option value="HU">Hungary</option>
                <option value="RO">Romania</option>
                <option value="GR">Greece</option>
                <option value="PT">Portugal</option>
                <option value="MY">Malaysia</option>
                <option value="TH">Thailand</option>
                <option value="VN">Vietnam</option>
                <option value="PH">Philippines</option>
                <option value="ID">Indonesia</option>
              </select>
              {validationErrors.country && (
                <p id="error-country" className="mt-1 text-sm text-red-600">{validationErrors.country}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Information */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Payment Information</h2>

        <div className="border border-gray-300 rounded-md p-4">
          <PaymentElement
            options={{
              layout: 'tabs',
            }}
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || processing}
        className={`w-full px-6 py-3 rounded-md font-semibold text-white ${
          !stripe || processing
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-[var(--color-accent)] hover:opacity-90'
        }`}
      >
        {processing ? 'Processing...' : `Pay ${formatPrice(listing.price, listing.currency)}`}
      </button>
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

  const listingId = searchParams.get('listingId');

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

    initCheckout();
  }, [listingId, user]);

  const initCheckout = async () => {
    try {
      // Step 1: Fetch listing details
      const listingResponse = await fetch(`/api/listings/${listingId}`);
      if (!listingResponse.ok) {
        throw new Error('Failed to fetch listing');
      }
      const listingData = await listingResponse.json();
      setListing(listingData);

      // Step 2: Pre-create the order to get a clientSecret for PaymentElement
      const createOrderResponse = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          buyerId: user!.id,
          sellerId: listingData.sellerId,
          listingId: listingData.id,
          amount:
            typeof listingData.price === 'string'
              ? parseFloat(listingData.price)
              : listingData.price,
          currency: listingData.currency,
          // shippingAddress will be collected from the form; this is the initial order creation
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div role="status" className="text-center">
          <div aria-hidden="true" className="inline-block motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
          <span className="sr-only">Loading checkout...</span>
          <p aria-hidden="true" className="mt-4 text-gray-600">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (error || !listing || !pendingOrder) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-4">
        <div role="alert" className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div aria-hidden="true" className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-4">Checkout Error</h1>
          <p className="text-gray-600 mb-6">{error || 'Unable to load checkout'}</p>
          <Link
            href="/browse"
            className="inline-block px-6 py-3 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90"
          >
            Back to Browse
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/listings/${listing.id}`}
            className="text-sm text-[var(--color-primary)] hover:underline mb-2 inline-block"
          >
            <span aria-hidden="true">←</span> Back to Listing
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
              <CheckoutForm listing={listing} pendingOrder={pendingOrder} />
            </Elements>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Order Summary</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Item:</span>
                  <span className="font-medium text-[var(--color-text)]">{listing.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Brand:</span>
                  <span className="font-medium text-[var(--color-text)]">{listing.brand}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Model:</span>
                  <span className="font-medium text-[var(--color-text)]">{listing.model}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatPrice(listing.price, listing.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping:</span>
                  <span className="font-medium text-green-600">FREE</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                  <span>Total:</span>
                  <span className="text-[var(--color-primary)]">
                    {formatPrice(listing.price, listing.currency)}
                  </span>
                </div>
              </div>

              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                <strong>Buyer Protection</strong>
                <p className="mt-1">Your payment is held in escrow until you confirm receipt of the device.</p>
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
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div role="status" className="text-center">
          <div aria-hidden="true" className="inline-block motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
          <span className="sr-only">Loading checkout...</span>
          <p aria-hidden="true" className="mt-4 text-gray-600">Loading checkout...</p>
        </div>
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  );
}
