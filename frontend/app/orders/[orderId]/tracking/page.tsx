'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Check,
  CircleX,
  ShieldCheck,
  Truck,
  Package,
  Clock,
  ArrowLeft,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { formatPrice } from '@/lib/currency';

interface Order {
  id: string;
  listingId?: string | null;
  amount: number;
  currency: string;
  status: string;
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
  brand: string;
  model: string;
  imageUrls?: string[];
}

interface OrderData {
  order: Order;
  listing: Listing | null;
  isBuyer: boolean;
  isSeller: boolean;
}

interface TimelineStep {
  title: string;
  description: string;
  status: 'completed' | 'current' | 'upcoming';
  timestamp?: string;
}

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.orderId as string;

  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

      const data = await response.json();
      setOrderData(data);
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

  const updateOrderStatus = async (newStatus: string) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/checkout/orders/${orderId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update order');
      }
      await fetchOrderDetails();
    } catch (err) {
      console.error('Error updating order:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyTracking = (tracking: string) => {
    navigator.clipboard.writeText(tracking);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeline = (order: Order): TimelineStep[] => {
    const steps: TimelineStep[] = [];

    // Cancelled state
    if (order.status === 'CANCELLED') {
      steps.push({
        title: 'Checkout Cancelled',
        description: 'This checkout attempt was cancelled. No payment was charged and the listing was returned to the active queue.',
        status: 'completed',
        timestamp: order.createdAt,
      });
      return steps;
    }

    // Step 1: Placed / Paid
    if (order.status === 'PENDING') {
      steps.push({
        title: 'Checkout Initialized (Unpaid)',
        description: 'Checkout was initiated — awaiting payment clearance from buyer',
        status: 'current',
        timestamp: order.createdAt,
      });
      steps.push({
        title: 'Payment Secured in Escrow',
        description: 'Funds will be safely vaulted in VeriBuy Escrow once payment completes',
        status: 'upcoming',
      });
    } else {
      steps.push({
        title: 'Order Placed & Escrow Secured',
        description: 'Payment was verified and vaulted in VeriBuy Escrow protection',
        status: 'completed',
        timestamp: order.paidAt || order.createdAt,
      });
    }

    // Processing/Preparing
    if (order.status === 'ESCROW_HELD' || order.status === 'PAYMENT_RECEIVED') {
      steps.push({
        title: 'Seller Preparing Device',
        description: 'Seller is packing the verified device for dispatch',
        status: 'current',
      });
    } else if (order.shippedAt) {
      steps.push({
        title: 'Device Packaged & Dispatched',
        description: 'Device handed over to tracked courier service',
        status: 'completed',
      });
    } else {
      steps.push({
        title: 'Device Preparation',
        description: 'Waiting for seller to package item',
        status: 'upcoming',
      });
    }

    // Shipped
    if (order.shippedAt) {
      steps.push({
        title: 'In Transit with Courier',
        description: 'Package is en route to your delivery address',
        status: order.deliveredAt ? 'completed' : 'current',
        timestamp: order.shippedAt,
      });
    } else {
      steps.push({
        title: 'Courier Dispatch',
        description: 'Waiting for courier pickup and tracking scan',
        status: 'upcoming',
      });
    }

    // Delivered
    if (order.deliveredAt) {
      steps.push({
        title: 'Package Delivered',
        description: 'Courier confirmed delivery to destination',
        status: order.completedAt ? 'completed' : 'current',
        timestamp: order.deliveredAt,
      });
    } else {
      steps.push({
        title: 'Delivery Confirmation',
        description: 'Awaiting courier delivery drop-off',
        status: 'upcoming',
      });
    }

    // Completed
    if (order.completedAt) {
      steps.push({
        title: 'Order Complete & Escrow Released',
        description: 'Buyer verified device satisfaction; escrow released to seller',
        status: 'completed',
        timestamp: order.completedAt,
      });
    } else if (order.deliveredAt) {
      steps.push({
        title: 'Buyer Inspection & Escrow Release',
        description: 'Verify your device and confirm satisfaction to release escrow',
        status: 'current',
      });
    } else {
      steps.push({
        title: 'Escrow Release',
        description: 'Final funds release upon buyer satisfaction confirmation',
        status: 'upcoming',
      });
    }

    return steps;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div role="status" className="text-center">
          <div
            aria-hidden="true"
            className="inline-block motion-safe:animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent mb-4"
          ></div>
          <span className="sr-only">Loading order tracking...</span>
          <p className="text-slate-500 text-sm font-medium">Loading order timeline...</p>
        </div>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div role="alert" className="text-center max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <div aria-hidden="true" className="mb-4 flex justify-center">
            <CircleX className="h-14 w-14 text-red-500" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">Order Not Found</h1>
          <p className="text-slate-500 text-sm mb-6">
            {error || 'We could not locate this order in our records.'}
          </p>
          <Link
            href="/orders"
            className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors shadow-sm"
          >
            Return to Orders
          </Link>
        </div>
      </div>
    );
  }

  const { order, listing, isBuyer } = orderData;
  const timeline = getTimeline(order);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-8 md:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation & Title */}
        <div className="mb-8">
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-semibold mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to My Orders
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Order Tracking & Escrow</h1>
              <p className="text-slate-500 text-sm mt-1">
                Order <span className="font-mono text-slate-700 font-semibold">#{order.id}</span>
              </p>
            </div>
            {order.status === 'CANCELLED' ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Checkout Cancelled
              </div>
            ) : order.status === 'PENDING' ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                <Clock className="w-4 h-4 shrink-0" />
                Awaiting Payment
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                Escrow Protection Active
              </div>
            )}
          </div>
        </div>

        {/* Device Summary Card */}
        {listing && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-4">
              {listing.imageUrls && listing.imageUrls.length > 0 ? (
                <img
                  src={listing.imageUrls[0]}
                  alt={listing.title}
                  className="w-16 h-16 object-cover rounded-xl border border-slate-200 bg-slate-100 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                  <Package className="w-6 h-6 text-slate-400" />
                </div>
              )}
              <div>
                <h3 className="font-bold text-slate-900 text-base leading-tight mb-1">{listing.title}</h3>
                <p className="text-xs text-slate-500">
                  {listing.brand} &bull; {listing.model}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 w-full sm:w-auto">
              <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">Order Value</span>
              <span className="text-lg font-bold text-emerald-600">
                {formatPrice(order.amount, order.currency)}
              </span>
            </div>
          </div>
        )}

        {/* Tracking Number Card */}
        {order.trackingNumber && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Courier Tracking Number</span>
                <p className="font-mono text-sm font-bold text-slate-900">{order.trackingNumber}</p>
              </div>
            </div>

            <button
              onClick={() => handleCopyTracking(order.trackingNumber!)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Tracking ID
                </>
              )}
            </button>
          </div>
        )}

        {/* Timeline Stepper */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" /> Escrow & Fulfillment Timeline
          </h2>

          <ol className="space-y-6 md:space-y-8">
            {timeline.map((step, index) => {
              const isDone = step.status === 'completed';
              const isCurrent = step.status === 'current';

              return (
                <li key={index} className="flex items-start gap-4 md:gap-6">
                  {/* Step Marker */}
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      aria-hidden="true"
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isDone
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : isCurrent
                          ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-600 motion-safe:animate-pulse'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : index + 1}
                    </div>
                    {index < timeline.length - 1 && (
                      <div
                        aria-hidden="true"
                        className={`w-0.5 min-h-[48px] mt-2 ${
                          isDone ? 'bg-emerald-600' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </div>

                  {/* Step Description */}
                  <div className="flex-1 pt-0.5">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                      <h3
                        className={`text-sm md:text-base font-bold ${
                          isDone ? 'text-slate-900' : isCurrent ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {step.title}
                      </h3>
                      {step.timestamp && (
                        <span className="text-xs text-slate-500 font-mono">
                          {formatDate(step.timestamp)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs md:text-sm text-slate-500 mt-1 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Action Notifications & Buttons */}
        {actionError && (
          <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-center gap-3 mb-6">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Cancelled Banner */}
        {order.status === 'CANCELLED' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm mb-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base md:text-lg font-bold text-slate-900 mb-1">Checkout Attempt Cancelled</h3>
                <p className="text-xs md:text-sm text-slate-500 mb-4 leading-relaxed">
                  This checkout session was cancelled. No payment was charged, and the device has been made available again in the marketplace.
                </p>
                <Link
                  href="/browse"
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-sm"
                >
                  Browse Available Devices
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Pending Checkout Actions */}
        {order.status === 'PENDING' && (() => {
          const createdAtMs = new Date(order.createdAt).getTime();
          const elapsedMinutes = Math.floor((Date.now() - createdAtMs) / (1000 * 60));
          const remainingMinutes = Math.max(0, 30 - elapsedMinutes);
          const isExpired = remainingMinutes <= 0;

          if (isExpired) {
            return (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm mb-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base md:text-lg font-bold text-slate-900 mb-1">Checkout Session Expired</h3>
                    <p className="text-xs md:text-sm text-slate-500 mb-4 leading-relaxed">
                      This checkout attempt was held for 30 minutes and has now expired. The device has been returned to the marketplace.
                    </p>
                    <Link
                      href="/browse"
                      className="inline-flex items-center justify-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-sm"
                    >
                      Browse Available Devices
                    </Link>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="bg-gradient-to-br from-amber-50 via-white to-white border border-amber-200 rounded-3xl p-6 md:p-8 shadow-sm mb-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-base md:text-lg font-bold text-slate-900">Checkout Pending Payment</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                      {remainingMinutes}m remaining
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-slate-600 mb-5 leading-relaxed">
                    This order is reserved for your checkout session. You have {remainingMinutes} minutes to complete secure payment before the item is released back to the marketplace.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    {(listing?.id || order.listingId) && (
                      <Link
                        href={`/checkout/${listing?.id || order.listingId}`}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-sm inline-flex items-center gap-2"
                      >
                        Complete Checkout
                      </Link>
                    )}
                    <button
                      disabled={actionLoading}
                      onClick={async () => {
                        if (!confirm('Are you sure you want to cancel this checkout attempt?')) return;
                        setActionLoading(true);
                        try {
                          const res = await fetch(`/api/checkout/orders/${orderId}`, {
                            method: 'DELETE',
                            credentials: 'include',
                          });
                          if (res.ok) {
                            await fetchOrderDetails();
                          } else {
                            const data = await res.json();
                            setActionError(data.error || 'Failed to cancel checkout');
                          }
                        } catch (err: any) {
                          setActionError(err.message || 'Failed to cancel checkout');
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl border border-slate-200 transition-all disabled:opacity-50"
                    >
                      {actionLoading ? 'Cancelling...' : 'Cancel Checkout Attempt'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {isBuyer && order.status === 'SHIPPED' && (
          <div className="bg-gradient-to-br from-blue-50 via-white to-white border border-blue-200 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base md:text-lg font-bold text-slate-900 mb-1">Has your parcel arrived?</h3>
                <p className="text-xs md:text-sm text-slate-600 mb-5 leading-relaxed">
                  Click below once you have physically received the package from the courier. Your 48-hour (2 days) inspection window will commence.
                </p>
                <button
                  disabled={actionLoading}
                  onClick={() => updateOrderStatus('DELIVERED')}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Updating Status...' : 'Confirm Delivery Received'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isBuyer && order.status === 'DELIVERED' && (
          <div className="bg-gradient-to-br from-emerald-50 via-white to-white border border-emerald-200 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base md:text-lg font-bold text-slate-900 mb-1">Device Inspected & Satisfied?</h3>
                <p className="text-xs md:text-sm text-slate-600 mb-5 leading-relaxed">
                  Releasing escrow signifies that the hardware condition matches the Trust Lens™ certificate. Once confirmed, funds will be immediately disbursed to the seller.
                </p>
                <button
                  disabled={actionLoading}
                  onClick={() => updateOrderStatus('COMPLETED')}
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Processing Escrow Release...' : 'Confirm Receipt & Release Escrow'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
