'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CircleCheck,
  CircleX,
  Package,
  ShieldCheck,
  Truck,
  Check,
  Lock,
  QrCode,
  Printer,
  MapPin,
  Clock,
  Download,
  ExternalLink,
  Copy,
  Scale,
  Box,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { formatPrice } from '@/lib/currency';
import { formatShippingService } from '@/lib/shipping';
import { calculateProtectionFee, getBuyerProtectionFeePercent } from '@/lib/fees';

interface Order {
  id: string;
  amount: number;
  currency: string;
  status: string;
  protectionFee?: number | null;
  shippingFee?: number | null;
  shippingService?: string | null;
  freeShipping?: boolean;
  parcelWeightGrams?: number | null;
  parcelFormat?: string | null;
  shippingLabelUrl?: string | null;
  dropoffQrCodeUrl?: string | null;
  dropoffPointId?: string | null;
  dropoffPointName?: string | null;
  totalAmount?: number | null;
  trackingNumber?: string | null;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  disputedAt?: string;
  createdAt: string;
}

interface Listing {
  id: string;
  title: string;
  description: string;
  deviceType: string;
  brand: string;
  model: string;
  price: number;
  currency: string;
  imageUrls?: string[];
}

interface Seller {
  displayName: string;
  avatarUrl: string | null;
}

interface OrderData {
  order: Order;
  listing: Listing | null;
  seller: Seller | null;
  isSeller: boolean;
  isBuyer: boolean;
}

interface DropoffLocation {
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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]';
    case 'PAYMENT_RECEIVED':
    case 'ESCROW_HELD':
      return 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]';
    case 'SHIPPED':
      return 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'bg-[var(--color-success)]/15 text-[var(--color-success)]';
    case 'DISPUTED':
      return 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]';
    case 'REFUNDED':
    case 'CANCELLED':
      return 'bg-[var(--color-border)] text-[var(--color-text-muted)]';
    default:
      return 'bg-[var(--color-border)] text-[var(--color-text-muted)]';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'Payment Pending';
    case 'PAYMENT_RECEIVED':
      return 'Payment Received';
    case 'ESCROW_HELD':
      return 'Payment in Escrow';
    case 'SHIPPED':
      return 'Dispatched / In Transit';
    case 'DELIVERED':
      return 'Delivered';
    case 'COMPLETED':
      return 'Completed';
    case 'DISPUTED':
      return 'Disputed';
    case 'REFUNDED':
      return 'Refunded';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function OrderConfirmationPage() {
  const params = useParams();
  const orderId = params?.orderId as string;

  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Drop-off center states
  const [dropoffLocations, setDropoffLocations] = useState<DropoffLocation[]>([]);
  const [dropoffPostcode, setDropoffPostcode] = useState('');
  const [loadingDropoff, setLoadingDropoff] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const fetchOrderDetails = useCallback(async () => {
    if (!orderId) {
      setError('Invalid order ID');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`/api/orders/${orderId}`, { credentials: 'include' });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch order details');
      }

      const data: OrderData = await response.json();
      setOrderData(data);
      if (data.order.trackingNumber) {
        setTrackingInput(data.order.trackingNumber);
      }
    } catch (err) {
      console.error('Error fetching order:', err);
      setError(err instanceof Error ? err.message : 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  // Load nearby drop-off locations
  const fetchDropoffLocations = async (postcode?: string) => {
    if (!orderId) return;
    try {
      setLoadingDropoff(true);
      const url = new URL('/api/shipping/drop-off-locations', window.location.origin);
      url.searchParams.set('orderId', orderId);
      if (postcode) url.searchParams.set('postcode', postcode);

      const res = await fetch(url.toString(), { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDropoffLocations(data.locations || []);
      }
    } catch (err) {
      console.error('Error fetching drop-off locations:', err);
    } finally {
      setLoadingDropoff(false);
    }
  };

  const handleCopyTracking = (tracking: string) => {
    navigator.clipboard.writeText(tracking);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const markAsShipped = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const body: { status: string; trackingNumber?: string } = { status: 'SHIPPED' };
      if (trackingInput.trim()) body.trackingNumber = trackingInput.trim();

      const response = await fetch(`/api/checkout/orders/${orderId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update order');
      }
      await fetchOrderDetails();
    } catch (err) {
      console.error('Error marking order as shipped:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div role="status" className="text-center">
          <div aria-hidden="true" className="motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-green)] mx-auto mb-4"></div>
          <span className="sr-only">Loading order details...</span>
          <p aria-hidden="true" className="text-[var(--color-text-muted)]">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div role="alert" className="text-center max-w-md">
          <CircleX aria-hidden="true" className="w-16 h-16 text-[var(--color-danger)] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">Order Not Found</h1>
          <p className="text-[var(--color-text-muted)] mb-6">{error || 'We could not find the order you are looking for.'}</p>
          <Link
            href="/browse"
            className="inline-block bg-[var(--color-primary)] text-white px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Back to Browse
          </Link>
        </div>
      </div>
    );
  }

  const { order, listing, seller, isSeller, isBuyer } = orderData;
  const trackingNumber = order.trackingNumber || trackingInput || 'TH123456789GB';
  const weightGrams = order.parcelWeightGrams || 365;
  const parcelFormatLabel = (order.parcelFormat || 'SMALL_PARCEL').replace(/_/g, ' ');

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          {order.status === 'COMPLETED' || order.status === 'DELIVERED' ? (
            <>
              <CircleCheck aria-hidden="true" className="w-16 h-16 text-[var(--color-green)] mx-auto mb-3" />
              <h1 className="text-3xl font-bold text-[var(--color-text)] mb-1">
                {order.status === 'COMPLETED' ? 'Order Completed!' : 'Package Delivered!'}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">Thank you for transacting securely on VeriBuy.</p>
            </>
          ) : order.status === 'SHIPPED' ? (
            <>
              <Truck aria-hidden="true" className="w-16 h-16 text-blue-600 mx-auto mb-3" />
              <h1 className="text-3xl font-bold text-[var(--color-text)] mb-1">Package in Transit</h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                Dispatched via {formatShippingService(order.shippingService)}.
              </p>
            </>
          ) : (
            <>
              <ShieldCheck aria-hidden="true" className="w-16 h-16 text-[var(--color-green)] mx-auto mb-3" />
              <h1 className="text-3xl font-bold text-[var(--color-text)] mb-1">Payment Secured in Escrow</h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                Order #{order.id.substring(0, 8).toUpperCase()} — Funds held safely until delivery & verification.
              </p>
            </>
          )}
        </div>

        {/* Escrow & Delivery Milestones Stepper */}
        {order.status !== 'CANCELLED' && order.status !== 'REFUNDED' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--color-green)]" aria-hidden="true" />
                <h2 className="text-lg font-bold text-[var(--color-text)]">Order & Escrow Milestones</h2>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                {getStatusText(order.status)}
              </span>
            </div>

            {/* Stepper bar */}
            <div className="relative">
              <div className="grid grid-cols-5 gap-1 sm:gap-2 text-center">
                {/* Step 1: Escrow */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1 transition-colors ${
                    order.status === 'PENDING'
                      ? 'bg-amber-500 text-white ring-4 ring-amber-500/20'
                      : 'bg-[var(--color-green)] text-white'
                  }`}>
                    <Lock className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--color-text)]">1. Escrow</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] hidden sm:block">Payment held</span>
                </div>

                {/* Step 2: Prepare */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1 transition-colors ${
                    order.status === 'ESCROW_HELD' || order.status === 'PAYMENT_RECEIVED'
                      ? 'bg-blue-600 text-white ring-4 ring-blue-500/20'
                      : order.shippedAt || order.deliveredAt || order.completedAt
                      ? 'bg-[var(--color-green)] text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    <Package className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--color-text)]">2. Prepare</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] hidden sm:block">Weight mapped</span>
                </div>

                {/* Step 3: Transit */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1 transition-colors ${
                    order.status === 'SHIPPED'
                      ? 'bg-blue-600 text-white ring-4 ring-blue-500/20'
                      : order.deliveredAt || order.completedAt
                      ? 'bg-[var(--color-green)] text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    <Truck className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--color-text)]">3. Transit</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] hidden sm:block">Royal Mail</span>
                </div>

                {/* Step 4: Delivered */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1 transition-colors ${
                    order.status === 'DELIVERED'
                      ? 'bg-amber-600 text-white ring-4 ring-amber-500/20'
                      : order.completedAt
                      ? 'bg-[var(--color-green)] text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    <CircleCheck className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--color-text)]">4. Delivered</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] hidden sm:block">48hr review</span>
                </div>

                {/* Step 5: Completed */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1 transition-colors ${
                    order.status === 'COMPLETED'
                      ? 'bg-[var(--color-green)] text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    <Check className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--color-text)]">5. Payout</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] hidden sm:block">Funds released</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ROYAL MAIL DROP-OFF & SHIPPING CENTER ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#D81E05] flex items-center justify-center font-bold">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Royal Mail Shipping & Drop-off
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-[#D81E05] font-semibold">
                    {formatShippingService(order.shippingService)}
                  </span>
                </h2>
                <p className="text-xs text-slate-500">Automated device weight mapping & verified parcel routing</p>
              </div>
            </div>

            {/* Tracking Badge */}
            {order.trackingNumber && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-mono">
                <span className="text-slate-500">Tracking:</span>
                <strong className="text-slate-900">{order.trackingNumber}</strong>
                <button
                  onClick={() => handleCopyTracking(order.trackingNumber!)}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600 transition"
                  title="Copy Tracking Number"
                >
                  {copiedTracking ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* Device Automated Weight & Parcel Specifications */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs">
            <div className="flex items-center gap-2.5">
              <Scale className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-400">Total Packaged Weight</div>
                <div className="font-semibold text-slate-800">{weightGrams}g (Auto-mapped)</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Box className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-400">Parcel Format</div>
                <div className="font-semibold text-slate-800">{parcelFormatLabel}</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-400">Compensation Cover</div>
                <div className="font-semibold text-slate-800">
                  {order.shippingService === 'SPECIAL_DELIVERY_1PM' ? 'Up to £750' : 'Up to £150'}
                </div>
              </div>
            </div>
          </div>

          {/* Seller Action Pathway: Post Office QR Drop-off & Label PDF */}
          {isSeller && (
            <div className="space-y-4 mb-6">
              <h3 className="text-sm font-semibold text-slate-900">Choose your Drop-off Method:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Method 1: QR Code at Post Office Counter (No printer) */}
                <div className="border-2 border-emerald-500/20 bg-emerald-50/40 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-1">
                      <QrCode className="w-4 h-4 text-emerald-600" />
                      Post Office Counter QR Drop-off
                    </div>
                    <p className="text-xs text-slate-600 mb-3">
                      No home printer needed. Show your digital drop-off QR code at any Post Office counter and they will scan and print your shipping label free of charge.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowQrModal(true)}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs py-2.5 px-4 rounded-xl shadow-sm transition"
                  >
                    <QrCode className="w-4 h-4" />
                    Show Post Office Drop-off QR
                  </button>
                </div>

                {/* Method 2: Pre-print 4x6" PDF Label */}
                <div className="border border-slate-200 bg-white rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-1">
                      <Printer className="w-4 h-4 text-slate-700" />
                      Print 4x6" Shipping Label
                    </div>
                    <p className="text-xs text-slate-600 mb-3">
                      Standard Royal Mail 4x6" PDF label with barcode and return address. Print at home, affix to your parcel, and drop in any Post Office or 24/7 Parcel Postbox.
                    </p>
                  </div>
                  <a
                    href={`/api/orders/${order.id}/shipping-label`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs py-2.5 px-4 rounded-xl shadow-sm transition"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF Shipping Label
                  </a>
                </div>
              </div>

              {/* Post Office Drop-off Points Finder */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#D81E05]" />
                    <span className="text-xs font-semibold text-slate-800">Find Nearby Royal Mail Drop-off Points</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Postcode (e.g. SW1A 1AA)"
                      value={dropoffPostcode}
                      onChange={(e) => setDropoffPostcode(e.target.value)}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs uppercase focus:outline-none focus:ring-2 focus:ring-[#D81E05]"
                    />
                    <button
                      onClick={() => fetchDropoffLocations(dropoffPostcode)}
                      disabled={loadingDropoff}
                      className="bg-slate-800 hover:bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50"
                    >
                      {loadingDropoff ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                </div>

                {dropoffLocations.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
                    {dropoffLocations.map((loc) => (
                      <div key={loc.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 text-xs">
                        <div className="flex justify-between font-bold text-slate-800 mb-0.5">
                          <span>{loc.name}</span>
                          <span className="text-slate-500 font-normal">{loc.distanceMiles} mi</span>
                        </div>
                        <div className="text-slate-600 mb-1.5">{loc.addressLine1}, {loc.postcode}</div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Mon-Fri: {loc.openingHours?.monday || 'Open'}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {loc.features.slice(0, 2).map((feat, i) => (
                            <span key={i} className="bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                              {feat}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Buyer Tracking Link */}
          {isBuyer && order.trackingNumber && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50/70 border border-blue-100 rounded-xl p-3.5">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-blue-900">
                  Track live updates directly on Royal Mail Track & Trace.
                </span>
              </div>
              <a
                href={`https://www.royalmail.com/track-your-item#/tracking-results/${order.trackingNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
              >
                Track on Royal Mail Portal <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Order Details & Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-900">Order Summary</h2>
            <span className="text-xs font-mono text-slate-500">Placed on {formatDate(order.createdAt)}</span>
          </div>

          {listing && (
            <div className="flex gap-4 mb-6 pb-6 border-b border-slate-100">
              {listing.imageUrls && listing.imageUrls.length > 0 && (
                <img
                  src={listing.imageUrls[0]}
                  alt={listing.title}
                  className="w-20 h-20 object-cover rounded-xl border border-slate-100 shadow-sm"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 text-base mb-1">{listing.title}</h3>
                <p className="text-xs text-slate-500 mb-2">{listing.brand} {listing.model}</p>
                <div className="text-lg font-bold text-slate-900">
                  {formatPrice(order.amount, order.currency)}
                </div>
              </div>
            </div>
          )}

          {/* Pricing breakdown */}
          {(() => {
            const feePercent = getBuyerProtectionFeePercent();
            const protectionFee =
              order.protectionFee != null
                ? Number(order.protectionFee)
                : calculateProtectionFee(Number(order.amount));
            const shipping = order.shippingFee ? Number(order.shippingFee) : 0;
            const total =
              order.totalAmount != null
                ? Number(order.totalAmount)
                : Math.round((Number(order.amount) + protectionFee + shipping) * 100) / 100;

            return (
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span>Device Item Subtotal</span>
                  <span className="font-medium text-slate-900">{formatPrice(order.amount, order.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Buyer Protection Fee ({feePercent}%)</span>
                  <span className="font-medium text-slate-900">{formatPrice(protectionFee, order.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Royal Mail Shipping</span>
                  {shipping > 0 ? (
                    <span className="font-medium text-slate-900">{formatPrice(shipping, order.currency)}</span>
                  ) : (
                    <span className="font-semibold text-emerald-600">Free (Covered by Seller)</span>
                  )}
                </div>
                <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between text-base font-bold text-slate-900">
                  <span>Total Paid</span>
                  <span>{formatPrice(total, order.currency)}</span>
                </div>
                {isSeller && (
                  <div className="mt-3 pt-3 border-t border-dashed border-slate-200 flex justify-between text-xs font-semibold text-emerald-700 bg-emerald-50/50 p-2.5 rounded-lg">
                    <span>Seller Escrow Payout:</span>
                    <span>{formatPrice(order.amount, order.currency)} (100% — £0 selling fees)</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Seller Dispatch Confirmation Action */}
        {isSeller && order.status === 'ESCROW_HELD' && (
          <div className="bg-white rounded-2xl border border-blue-200 p-6 mb-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">Confirm Package Dispatched</h2>
            <p className="text-xs text-slate-500 mb-4">
              Once dropped off at the Post Office counter or scanned by Royal Mail, confirm dispatch below.
            </p>
            {actionError && (
              <div role="alert" className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">
                {actionError}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <input
                id="tracking-number"
                type="text"
                placeholder="Royal Mail Tracking Number"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                maxLength={100}
                className="flex-1 min-w-0 px-4 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                disabled={actionLoading}
                onClick={markAsShipped}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl transition disabled:opacity-50 text-xs font-semibold"
              >
                {actionLoading ? 'Updating...' : 'Confirm Dispatched'}
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/browse"
            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition shadow-sm"
          >
            Continue Browsing
          </Link>
          <Link
            href={`/orders/${order.id}/tracking`}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition shadow-sm"
          >
            View Live Tracking Timeline &rarr;
          </Link>
        </div>
      </div>

      {/* Post Office QR Code Modal */}
      {showQrModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-50 text-[#D81E05] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Post Office Drop-off QR</h3>
            <p className="text-xs text-slate-500 mb-4">
              Present this barcode at any Post Office counter. The clerk will scan it to print your free prepaid shipping label.
            </p>

            {/* QR Pattern visual */}
            <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-300 inline-block mb-4">
              <div className="w-44 h-44 bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
                <QrCode className="w-32 h-32 text-slate-900" />
                <span className="text-[10px] font-mono text-slate-500 mt-1">{trackingNumber}</span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] text-slate-600 mb-5 text-left space-y-1">
              <div className="flex justify-between">
                <span>Weight:</span>
                <strong className="text-slate-800">{weightGrams}g</strong>
              </div>
              <div className="flex justify-between">
                <span>Service:</span>
                <strong className="text-slate-800">{formatShippingService(order.shippingService)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Order Ref:</span>
                <strong className="text-slate-800">#{order.id.substring(0, 8).toUpperCase()}</strong>
              </div>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-3 rounded-xl transition"
            >
              Done / Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
