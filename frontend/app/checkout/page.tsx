'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import Link from 'next/link';
import { formatPrice } from '@/lib/currency';
import { CircleCheck, CircleX, Truck, Clock, ShieldCheck, Lock, RotateCcw, Award, CheckCircle, Store, MapPin, Heart, CreditCard, Search, Building2 } from 'lucide-react';
import {
  calculateShippingFee,
  formatShippingService,
  type ShippingService,
  type ShippingQuote,
} from '@/lib/shipping';
import { calculateProtectionFee, getBuyerProtectionFeePercent, fetchBuyerProtectionFeePercent } from '@/lib/fees';

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
  freeShipping?: boolean;
  isBulkListing?: boolean;
  quantity?: number;
}

interface PendingOrder {
  id: string;
  clientSecret: string;
  paymentIntentId: string;
  protectionFee?: number | null;
  amount?: number | null;
  totalAmount?: number | null;
}

interface CollectionPoint {
  id: string;
  name: string;
  type: string;
  addressLine1: string;
  town: string;
  postcode: string;
  distanceMiles: number;
  openingHours: Record<string, string>;
  features: string[];
}

interface CheckoutFormProps {
  listing: Listing;
  pendingOrder: PendingOrder;
  selectedService: ShippingService;
  shippingQuote: ShippingQuote | null;
  feePercentFallback: number;
  deliveryMethod: 'HOME' | 'CLICK_AND_COLLECT';
  onDeliveryMethodChange: (method: 'HOME' | 'CLICK_AND_COLLECT') => void;
  selectedCollectionPoint: CollectionPoint | null;
  onCollectionPointChange: (point: CollectionPoint | null) => void;
  donateToCharity: boolean;
  onDonateToCharityChange: (donate: boolean) => void;
  onServiceChange: (service: ShippingService) => void;
  onPostcodeChange: (postcode: string) => void;
}

function CheckoutForm({
  listing,
  pendingOrder,
  selectedService,
  shippingQuote,
  feePercentFallback,
  deliveryMethod,
  onDeliveryMethodChange,
  selectedCollectionPoint,
  onCollectionPointChange,
  donateToCharity,
  onDonateToCharityChange,
  onServiceChange,
  onPostcodeChange,
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { user } = useAuth();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [succeeded, setSucceeded] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Shipping address form state
  const [shippingAddress, setShippingAddress] = useState({
    name: user?.name || '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'GB',
  });

  // Cardholder name state
  const [cardholderName, setCardholderName] = useState(user?.name || '');

  // Click & Collect lookup state
  const [lookupPostcode, setLookupPostcode] = useState(shippingAddress.postal_code || 'SW1A 1AA');
  const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [pointsError, setPointsError] = useState('');

  const fetchCollectionPoints = async (pc: string) => {
    const cleanPc = pc.trim();
    if (!cleanPc) return;
    setLoadingPoints(true);
    setPointsError('');
    try {
      const res = await fetch(`/api/shipping/collection-points?postcode=${encodeURIComponent(cleanPc)}`);
      if (!res.ok) throw new Error('Could not find collection points for this postcode.');
      const data = await res.json();
      const locations: CollectionPoint[] = data.locations || [];
      setCollectionPoints(locations);
      if (locations.length > 0 && !selectedCollectionPoint) {
        handleSelectCollectionPoint(locations[0]);
      }
    } catch (err: any) {
      setPointsError(err.message || 'Error loading collection points');
    } finally {
      setLoadingPoints(false);
    }
  };

  const handleSelectCollectionPoint = (point: CollectionPoint) => {
    onCollectionPointChange(point);
    onPostcodeChange(point.postcode);
    setShippingAddress(prev => ({
      ...prev,
      line1: `${point.name}, ${point.addressLine1}`,
      city: point.town,
      state: point.town,
      postal_code: point.postcode,
    }));
    if (validationErrors.collectionPoint) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next.collectionPoint;
        return next;
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setShippingAddress(prev => {
      if (name === 'name' && (!cardholderName || cardholderName === prev.name)) {
        setCardholderName(value);
      }
      return { ...prev, [name]: value };
    });
    if (name === 'postal_code') {
      onPostcodeChange(value);
      setLookupPostcode(value);
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

    if (deliveryMethod === 'CLICK_AND_COLLECT') {
      if (!selectedCollectionPoint) {
        errors.collectionPoint = 'Please select a Click & Collect pickup point';
      }
    } else {
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
    }

    if (!shippingQuote && !listing.freeShipping) {
      errors.postal_code = 'Enter a valid UK postcode to calculate shipping';
    }

    if (!cardholderName || cardholderName.trim().length < 2) {
      errors.cardholderName = 'Name on card is required and must match your payment card';
    } else if (!/^[a-zA-Z\s\-'.]+$/.test(cardholderName.trim())) {
      errors.cardholderName = 'Please enter a valid cardholder name (letters, spaces, and hyphens only)';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const itemPrice = typeof listing.price === 'string' ? parseFloat(listing.price) : listing.price;
  const protectionFee =
    pendingOrder.protectionFee != null
      ? Number(pendingOrder.protectionFee)
      : calculateProtectionFee(itemPrice);
  const effectiveShippingFee = listing.freeShipping
    ? 0
    : (shippingQuote ? shippingQuote.totalFee : 0);
  const donationAmount = donateToCharity ? 1.00 : 0;
  const totalPrice = Math.round((itemPrice + protectionFee + effectiveShippingFee + donationAmount) * 100) / 100;
  const klarnaInstallment = (totalPrice / 3).toFixed(2);
  const clearpayInstallment = (totalPrice / 4).toFixed(2);

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
      const resolvedAddress = deliveryMethod === 'CLICK_AND_COLLECT' && selectedCollectionPoint ? {
        ...shippingAddress,
        line1: `${selectedCollectionPoint.name}, ${selectedCollectionPoint.addressLine1}`,
        city: selectedCollectionPoint.town,
        state: selectedCollectionPoint.town,
        postal_code: selectedCollectionPoint.postcode,
      } : shippingAddress;

      const updateRes = await fetch('/api/checkout/update-shipping', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId: pendingOrder.id,
          shippingFee: listing.freeShipping ? 0 : (shippingQuote?.totalFee || 0),
          shippingService: selectedService,
          deliveryMethod,
          collectionPoint: deliveryMethod === 'CLICK_AND_COLLECT' ? selectedCollectionPoint : undefined,
          donationAmount: donateToCharity ? 1.00 : 0,
          shippingAddress: {
            ...resolvedAddress,
            deliveryMethod,
            collectionPoint: deliveryMethod === 'CLICK_AND_COLLECT' ? selectedCollectionPoint : undefined,
          },
        }),
      });

      if (!updateRes.ok) {
        const errData = await updateRes.json();
        throw new Error(errData.error || 'Failed to update shipping details');
      }

      // Step 2: Confirm payment with Stripe using PaymentElement and verified cardholder billing details
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders/${pendingOrder.id}`,
          payment_method_data: {
            billing_details: {
              name: cardholderName.trim(),
              email: user?.email || undefined,
              phone: (user as any)?.phone || undefined,
              address: {
                line1: resolvedAddress.line1,
                line2: resolvedAddress.line2 || undefined,
                city: resolvedAddress.city,
                state: resolvedAddress.state,
                postal_code: resolvedAddress.postal_code,
                country: resolvedAddress.country,
              },
            },
          },
        },
        redirect: 'if_required',
      });

      if (stripeError) {
        throw new Error(stripeError.message || 'Payment failed. Please check your card or BNPL details.');
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
        <h2 className="text-2xl font-bold text-[var(--color-success)] mb-2">Payment Authorized into Escrow!</h2>
        <p className="text-[var(--color-text-muted)]">Redirecting to order confirmation...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Delivery Mode Choice (Home Delivery vs Click & Collect) */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Delivery Option</h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            Royal Mail UK Network
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => onDeliveryMethodChange('HOME')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
              deliveryMethod === 'HOME'
                ? 'border-[var(--color-green)] bg-[var(--color-green)]/5 ring-1 ring-[var(--color-green)]'
                : 'border-[var(--color-border)] hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Truck className={`w-5 h-5 ${deliveryMethod === 'HOME' ? 'text-[var(--color-green)]' : 'text-slate-500'}`} />
                <span className="font-bold text-sm text-[var(--color-text)]">Home Delivery</span>
              </div>
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                deliveryMethod === 'HOME' ? 'border-[var(--color-green)] bg-[var(--color-green)]' : 'border-slate-300'
              }`}>
                {deliveryMethod === 'HOME' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Direct tracked delivery to your home or office address.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              onDeliveryMethodChange('CLICK_AND_COLLECT');
              if (collectionPoints.length === 0) {
                fetchCollectionPoints(shippingAddress.postal_code || lookupPostcode);
              }
            }}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
              deliveryMethod === 'CLICK_AND_COLLECT'
                ? 'border-[var(--color-green)] bg-[var(--color-green)]/5 ring-1 ring-[var(--color-green)]'
                : 'border-[var(--color-border)] hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Store className={`w-5 h-5 ${deliveryMethod === 'CLICK_AND_COLLECT' ? 'text-[var(--color-green)]' : 'text-slate-500'}`} />
                <span className="font-bold text-sm text-[var(--color-text)]">Click &amp; Collect</span>
              </div>
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                deliveryMethod === 'CLICK_AND_COLLECT' ? 'border-[var(--color-green)] bg-[var(--color-green)]' : 'border-slate-300'
              }`}>
                {deliveryMethod === 'CLICK_AND_COLLECT' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Pick up at a local Post Office, Royal Mail CSP, or ParcelShop.
            </p>
          </button>
        </div>

        {deliveryMethod === 'CLICK_AND_COLLECT' ? (
          <div className="space-y-4 pt-2 border-t border-[var(--color-border)]/60">
            <div>
              <label htmlFor="collector-name" className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Recipient Full Name <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                id="collector-name"
                type="text"
                name="name"
                required
                value={shippingAddress.name}
                onChange={handleInputChange}
                aria-describedby={validationErrors.name ? 'error-name' : undefined}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-green)] ${
                  validationErrors.name ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
                }`}
                placeholder="Must match your official photo ID for pickup"
              />
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                You must present government ID matching this name when collecting.
              </p>
              {validationErrors.name && (
                <p id="error-name" className="mt-1 text-sm text-[var(--color-danger)]">{validationErrors.name}</p>
              )}
            </div>

            {/* Postcode lookup for Click & Collect */}
            <div>
              <label htmlFor="collection-postcode" className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Find Collection Points Near You
              </label>
              <div className="flex gap-2">
                <input
                  id="collection-postcode"
                  type="text"
                  value={lookupPostcode}
                  onChange={(e) => setLookupPostcode(e.target.value.toUpperCase())}
                  placeholder="e.g. SW1A 1AA"
                  className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm uppercase focus:ring-2 focus:ring-[var(--color-green)]"
                />
                <button
                  type="button"
                  onClick={() => fetchCollectionPoints(lookupPostcode)}
                  disabled={loadingPoints}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                  {loadingPoints ? 'Searching...' : 'Search'}
                </button>
              </div>
              {pointsError && <p className="text-xs text-[var(--color-danger)] mt-1">{pointsError}</p>}
              {validationErrors.collectionPoint && (
                <p className="text-xs text-[var(--color-danger)] mt-1">{validationErrors.collectionPoint}</p>
              )}
            </div>

            {/* Locations List */}
            {collectionPoints.length > 0 && (
              <div className="space-y-2 mt-3">
                <span className="text-xs font-semibold text-slate-700">Choose your pickup point:</span>
                <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {collectionPoints.map((point) => {
                    const isSelected = selectedCollectionPoint?.id === point.id;
                    return (
                      <div
                        key={point.id}
                        onClick={() => handleSelectCollectionPoint(point)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[var(--color-green)] bg-[var(--color-green)]/5 ring-1 ring-[var(--color-green)]'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2.5">
                            <Store className={`w-4 h-4 mt-0.5 ${isSelected ? 'text-[var(--color-green)]' : 'text-slate-400'}`} />
                            <div>
                              <span className="font-bold text-xs text-slate-900 block">{point.name}</span>
                              <span className="text-[11px] text-slate-600 block">{point.addressLine1}, {point.town} {point.postcode}</span>
                              <span className="text-[10px] text-slate-500 mt-0.5 block">
                                Mon-Fri: {point.openingHours?.monday || 'Open'} • Sat: {point.openingHours?.saturday || 'Open'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {point.distanceMiles} mi
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Automated Collection Pass:</strong> Once your seller dispatches the item, VeriBuy will send you an SMS and email with your 6-digit Collection PIN and secure QR code to show at the counter.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2 border-t border-[var(--color-border)]/60">
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
        )}
      </div>

      {/* Shipping Service */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Shipping Service</h2>
          {listing.freeShipping && (
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full">
              Covered by Seller
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          {listing.freeShipping
            ? 'The seller is covering standard UK tracked shipping. You pay £0.00 for delivery at checkout.'
            : 'All orders are shipped via Royal Mail with tracking and photo on delivery.'}
        </p>

        {shippingQuote ? (
          <div className="space-y-3">
            {(['TRACKED_48', 'TRACKED_24'] as ShippingService[]).map((svc) => {
              const quote = calculateShippingFee(listing.deviceType, shippingAddress.postal_code || 'SW1A 1AA', svc, {
                brand: listing.brand,
                model: listing.model,
                quantity: listing.quantity,
              });
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
                    {quote.surcharge > 0 && !listing.freeShipping && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        Includes {formatPrice(quote.surcharge, 'GBP')} remote area surcharge
                      </p>
                    )}
                  </div>
                  <span className="font-semibold text-[var(--color-text)]">
                    {listing.freeShipping ? (
                      <span className="text-emerald-700 font-bold">FREE (£0.00)</span>
                    ) : (
                      formatPrice(quote.totalFee, 'GBP')
                    )}
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

      {/* BNPL (Klarna / Clearpay) & Payment Information */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Payment Method</h2>
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 font-medium px-2.5 py-1 rounded-full">
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>256-Bit Escrow Security</span>
          </div>
        </div>

        {/* BNPL Options Banner */}
        <div className="bg-gradient-to-r from-purple-50 via-emerald-50 to-blue-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Buy Now, Pay Later (0% APR)
            </span>
            <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
              Escrow Deferred Capture
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-white/80 p-2.5 rounded-lg border border-purple-100 flex items-center gap-2">
              <span className="bg-[#FFB3C7] text-black font-black text-[10px] px-1.5 py-0.5 rounded">
                Klarna.
              </span>
              <span className="text-slate-800">
                <strong>3 payments of £{klarnaInstallment}</strong> (No fees)
              </span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 flex items-center gap-2">
              <span className="bg-[#B2FCE4] text-black font-black text-[10px] px-1.5 py-0.5 rounded">
                clearpay
              </span>
              <span className="text-slate-800">
                <strong>4 payments of £{clearpayInstallment}</strong> (Bi-weekly)
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-600 mt-2">
            Select Card, Klarna, or Clearpay in the secure Stripe portal below. Funds remain safely vaulted in escrow until you verify your device.
          </p>
        </div>

        {/* Name on Card Input */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label htmlFor="cardholder-name" className="block text-sm font-medium text-[var(--color-text)]">
              Cardholder / Payer Name <span className="text-[var(--color-danger)]">*</span>
            </label>
            <span className="text-xs text-[var(--color-text-muted)]">Exact name on payment method</span>
          </div>
          <input
            id="cardholder-name"
            type="text"
            name="cardholderName"
            required
            autoComplete="cc-name"
            value={cardholderName}
            onChange={(e) => {
              setCardholderName(e.target.value);
              if (validationErrors.cardholderName) {
                setValidationErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors.cardholderName;
                  return newErrors;
                });
              }
            }}
            aria-describedby={validationErrors.cardholderName ? 'error-cardholder' : 'cardholder-hint'}
            aria-invalid={!!validationErrors.cardholderName}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent ${
              validationErrors.cardholderName ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
            }`}
            placeholder="e.g. JANE SMITH"
          />
          {validationErrors.cardholderName ? (
            <p id="error-cardholder" className="mt-1 text-sm text-[var(--color-danger)]">
              {validationErrors.cardholderName}
            </p>
          ) : (
            <p id="cardholder-hint" className="mt-1.5 text-xs text-[var(--color-text-muted)] flex items-start gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" aria-hidden="true" />
              <span>Please ensure the name matches your payment method for 3D Secure fraud prevention.</span>
            </p>
          )}
        </div>

        {/* Stripe Payment Element (Supports Card, Klarna, Clearpay) */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
            Secure Payment Details
          </label>
          <div className="border border-[var(--color-border)] rounded-lg p-4 bg-white shadow-xs">
            <PaymentElement
              options={{
                layout: 'tabs',
                wallets: { applePay: 'never', googlePay: 'never', link: 'never' },
                fields: {
                  billingDetails: {
                    name: 'never',
                    address: 'never',
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 text-xs text-[var(--color-text-muted)]">
          <Lock className="w-3.5 h-3.5 text-[var(--color-green)] shrink-0" aria-hidden="true" />
          <span>Processed securely via Stripe Payments UK. Escrow funds are held safely under hold authorization until delivery.</span>
        </div>
      </div>

      {/* Charity Donation Toggle (Good Things Foundation / Digital Inclusion) */}
      <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={donateToCharity}
            onChange={(e) => onDonateToCharityChange(e.target.checked)}
            className="mt-1 w-4 h-4 text-rose-600 rounded border-rose-300 focus:ring-rose-500 accent-rose-600"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-600 fill-rose-600" />
              <span className="font-bold text-sm text-slate-900">
                Donate £1.00 to Good Things Foundation (Digital Inclusion UK)
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Help bridge the UK digital divide. 100% of collected donations supply refurbished devices, free connectivity, and vital digital skills to low-income families and pensioners.
              <span className="block text-[11px] text-slate-500 mt-0.5">Registered Charity No. 1165209.</span>
            </p>
          </div>
          <span className="font-bold text-sm text-rose-700 shrink-0">+£1.00</span>
        </label>
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
        disabled={!stripe || processing || (!shippingQuote && !listing.freeShipping)}
        className={`w-full px-6 py-3.5 rounded-xl font-bold text-white transition-all text-base shadow-sm ${
          !stripe || processing || (!shippingQuote && !listing.freeShipping)
            ? 'bg-[var(--color-border)] cursor-not-allowed'
            : 'bg-[var(--color-accent)] hover:opacity-95 cursor-pointer hover:shadow'
        }`}
      >
        {processing
          ? 'Authorizing Secure Escrow Hold...'
          : `Authorize ${formatPrice(totalPrice, listing.currency)} & Protect Order`
        }
      </button>
      {!shippingQuote && !listing.freeShipping && (
        <p className="text-xs text-center text-[var(--color-text-muted)]">
          Enter a valid UK postcode above to calculate shipping and enable payment.
        </p>
      )}

      {/* Trust & Buyer Guarantee Bar */}
      <div className="bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
          <ShieldCheck className="w-5 h-5 text-[var(--color-green)]" aria-hidden="true" />
          <span>VeriBuy Complete Buyer Guarantee</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-[var(--color-border)]/60 text-xs text-[var(--color-text-muted)]">
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong className="text-[var(--color-text)] block">Escrow Protected</strong>
              Funds released to seller only after you inspect the device.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <RotateCcw className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong className="text-[var(--color-text)] block">48-Hour Refund</strong>
              Full protection if the device doesn&apos;t match verification.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Truck className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong className="text-[var(--color-text)] block">Tracked Dispatch</strong>
              Tracked Royal Mail delivery or Click &amp; Collect pickup with PIN.
            </div>
          </div>
        </div>
      </div>
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

  // Server-owned fee rate for display fallback (fetched at runtime)
  const [serverFeePercent, setServerFeePercent] = useState<number>(getBuyerProtectionFeePercent());

  useEffect(() => {
    fetchBuyerProtectionFeePercent()
      .then(setServerFeePercent)
      .catch(() => {});
  }, []);

  // Shipping state
  const [selectedService, setSelectedService] = useState<ShippingService>('TRACKED_48');
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null);
  const [postcode, setPostcode] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'HOME' | 'CLICK_AND_COLLECT'>('HOME');
  const [selectedCollectionPoint, setSelectedCollectionPoint] = useState<CollectionPoint | null>(null);
  const [donateToCharity, setDonateToCharity] = useState(false);

  const listingId = searchParams.get('listingId');

  // Guard against double order creation (React 18 Strict Mode runs effects twice)
  const initRef = useRef(false);

  useEffect(() => {
    if (!user) {
      router.push(`/login?redirect=/checkout?listingId=${listingId}`);
      return;
    }

    if (user.role === 'ADMIN') {
      setError('Administrator accounts are for management only and cannot checkout or purchase listings. Please sign in with a buyer account.');
      setLoading(false);
      return;
    }

    if (!listingId || listingId === 'undefined' || listingId === 'null') {
      setError('No listing ID provided. Please select an item to purchase.');
      setLoading(false);
      return;
    }

    if (initRef.current) return;
    initRef.current = true;

    initCheckout();
  }, [listingId, user?.id, user?.role]); // PERF-07: depend on user?.id and user?.role to avoid stale-closure re-runs

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
        {
          brand: listingData.brand,
          model: listingData.model,
          quantity: listingData.quantity,
        },
      );
      const initialShippingFee = listingData.freeShipping ? 0 : defaultQuote.totalFee;

      // Step 2: Pre-create the order to get a clientSecret for PaymentElement.
      // The shipping fee is set to 0 if seller covers delivery, or default mainland TRACKED_48 rate.
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
          shippingFee: initialShippingFee,
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
        protectionFee: orderWithPayment.protectionFee != null ? Number(orderWithPayment.protectionFee) : null,
        amount: orderWithPayment.amount != null ? Number(orderWithPayment.amount) : null,
        totalAmount: orderWithPayment.totalAmount != null ? Number(orderWithPayment.totalAmount) : null,
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
      const quote = calculateShippingFee(listing.deviceType, newPostcode, selectedService, {
        brand: listing.brand,
        model: listing.model,
        quantity: listing.quantity,
      });
      setShippingQuote(quote);
    } else {
      setShippingQuote(null);
    }
  };

  const handleServiceChange = (service: ShippingService) => {
    setSelectedService(service);
    if (postcode.trim().length >= 2 && listing) {
      const quote = calculateShippingFee(listing.deviceType, postcode, service, {
        brand: listing.brand,
        model: listing.model,
        quantity: listing.quantity,
      });
      setShippingQuote(quote);
    }
  };

  const itemPrice = listing
    ? typeof listing.price === 'string' ? parseFloat(listing.price) : listing.price
    : 0;
  const protectionFee =
    pendingOrder?.protectionFee != null
      ? Number(pendingOrder.protectionFee)
      : calculateProtectionFee(itemPrice);
  const feePercent =
    itemPrice > 0 && protectionFee > 0
      ? Math.round((protectionFee / itemPrice) * 100)
      : serverFeePercent;
  const effectiveShippingFee = listing?.freeShipping
    ? 0
    : (shippingQuote ? shippingQuote.totalFee : 0);
  const donationAmount = donateToCharity ? 1.00 : 0;
  const totalPrice = Math.round((itemPrice + protectionFee + effectiveShippingFee + donationAmount) * 100) / 100;

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
                feePercentFallback={serverFeePercent}
                deliveryMethod={deliveryMethod}
                onDeliveryMethodChange={setDeliveryMethod}
                selectedCollectionPoint={selectedCollectionPoint}
                onCollectionPointChange={setSelectedCollectionPoint}
                donateToCharity={donateToCharity}
                onDonateToCharityChange={setDonateToCharity}
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
                  <span className="text-[var(--color-text-muted)]">Buyer Protection Fee:</span>
                  <span className="font-medium text-[var(--color-text)]">
                    {formatPrice(protectionFee, listing.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Shipping:</span>
                  {listing.freeShipping ? (
                    <span className="font-semibold text-emerald-700">
                      FREE (Covered by Seller)
                    </span>
                  ) : shippingQuote ? (
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

                {/* Delivery Option row */}
                <div className="flex justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-[var(--color-text-muted)]">Delivery Option:</span>
                  <span className="font-medium text-[var(--color-text)]">
                    {deliveryMethod === 'CLICK_AND_COLLECT' ? '🏪 Click & Collect' : '🚚 Home Delivery'}
                  </span>
                </div>

                {deliveryMethod === 'CLICK_AND_COLLECT' && selectedCollectionPoint && (
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs space-y-0.5">
                    <span className="font-bold text-slate-900 block">{selectedCollectionPoint.name}</span>
                    <span className="text-slate-600 block">{selectedCollectionPoint.addressLine1}, {selectedCollectionPoint.postcode}</span>
                    <span className="text-[11px] text-emerald-700 font-medium block">
                      📍 {selectedCollectionPoint.distanceMiles} miles away
                    </span>
                  </div>
                )}

                {/* Charity donation row */}
                {donateToCharity && (
                  <div className="flex justify-between items-center text-xs bg-rose-50/80 border border-rose-200/70 p-2 rounded-lg">
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
                      <span className="font-semibold text-rose-900">Digital Inclusion UK</span>
                    </div>
                    <span className="font-bold text-rose-800">+£1.00</span>
                  </div>
                )}

                <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                  <span>Total:</span>
                  <span className="text-[var(--color-text)]">
                    {formatPrice(totalPrice, listing.currency)}
                  </span>
                </div>
              </div>

              <div className="mt-6 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl p-4 text-sm text-[var(--color-text)]">
                <div className="flex items-center gap-2 font-semibold text-[var(--color-green)] mb-1">
                  <CircleCheck className="w-4 h-4" />
                  <span>Buyer Protection Included</span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  The {feePercent}% protection fee secures your payment in escrow, covers Trust Lens verification, and guarantees a 48-hour (2 days) refund if the device does not match.
                </p>
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
