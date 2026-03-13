'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, CircleX } from 'lucide-react';

interface Order {
  id: string;
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
      // Re-fetch order to get updated state
      await fetchOrderDetails();
    } catch (err) {
      console.error('Error updating order:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getTimeline = (order: Order): TimelineStep[] => {
    const steps: TimelineStep[] = [];

    // Order Placed
    steps.push({
      title: 'Order Placed',
      description: 'Your order has been received',
      status: 'completed',
      timestamp: order.createdAt,
    });

    // Payment Received
    if (order.paidAt) {
      steps.push({
        title: 'Payment Secured',
        description: 'Payment held safely in escrow',
        status: 'completed',
        timestamp: order.paidAt,
      });
    } else {
      steps.push({
        title: 'Awaiting Payment',
        description: 'Waiting for payment confirmation',
        status: order.status === 'PENDING' ? 'current' : 'upcoming',
      });
    }

    // Processing/Preparing
    if (order.status === 'ESCROW_HELD' || order.status === 'PAYMENT_RECEIVED') {
      steps.push({
        title: 'Being Prepared',
        description: 'Seller is preparing your item for shipment',
        status: 'current',
      });
    } else if (order.shippedAt) {
      steps.push({
        title: 'Prepared',
        description: 'Item prepared and ready for shipping',
        status: 'completed',
      });
    } else {
      steps.push({
        title: 'Being Prepared',
        description: 'Waiting for seller to prepare item',
        status: 'upcoming',
      });
    }

    // Shipped
    if (order.shippedAt) {
      steps.push({
        title: 'Shipped',
        description: 'Package is on its way to you',
        status: order.deliveredAt ? 'completed' : 'current',
        timestamp: order.shippedAt,
      });
    } else {
      steps.push({
        title: 'Shipping',
        description: 'Awaiting shipment',
        status: 'upcoming',
      });
    }

    // Delivered
    if (order.deliveredAt) {
      steps.push({
        title: 'Delivered',
        description: 'Package delivered successfully',
        status: order.completedAt ? 'completed' : 'current',
        timestamp: order.deliveredAt,
      });
    } else {
      steps.push({
        title: 'Delivery',
        description: 'Awaiting delivery',
        status: 'upcoming',
      });
    }

    // Completed
    if (order.completedAt) {
      steps.push({
        title: 'Completed',
        description: 'Order completed and escrow released',
        status: 'completed',
        timestamp: order.completedAt,
      });
    } else if (order.deliveredAt) {
      steps.push({
        title: 'Confirm Receipt',
        description: 'Please confirm you received the item',
        status: 'current',
      });
    } else {
      steps.push({
        title: 'Complete',
        description: 'Waiting for delivery confirmation',
        status: 'upcoming',
      });
    }

    return steps;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div role="status" className="text-center">
          <div aria-hidden="true" className="motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-green)] mx-auto mb-4"></div>
          <span className="sr-only">Loading order tracking...</span>
          <p aria-hidden="true" className="text-[var(--color-text-muted)]">Loading order tracking...</p>
        </div>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div role="alert" className="text-center max-w-md">
          <div aria-hidden="true" className="mb-4 flex justify-center">
            <CircleX className="h-14 w-14 text-[var(--color-danger)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">
            Order Not Found
          </h1>
          <p className="text-[var(--color-text-muted)] mb-6">
            {error || 'We could not find the order you are looking for.'}
          </p>
          <Link
            href="/browse"
            className="inline-block bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Back to Browse
          </Link>
        </div>
      </div>
    );
  }

  const { order, listing, isBuyer } = orderData;
  const timeline = getTimeline(order);

  return (
    <div className="min-h-screen bg-white py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/orders/${orderId}`}
            className="text-[var(--color-green)] hover:text-[var(--color-green-dark)] mb-2 inline-block"
          >
            <span aria-hidden="true">&larr;</span> Back to Order Details
          </Link>
          <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">
            Track Your Order
          </h1>
          <p className="text-[var(--color-text-muted)]">
            Order #{orderId.slice(0, 8)}...
          </p>
        </div>

        {/* Item Info */}
        {listing && (
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 mb-6">
            <div className="flex gap-4">
              {listing.imageUrls && listing.imageUrls.length > 0 && (
                <img
                  src={listing.imageUrls[0]}
                  alt={listing.title}
                  className="w-20 h-20 object-cover rounded-xl"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--color-text)] mb-1">
                  {listing.title}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {listing.brand} {listing.model}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Order Timeline */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
          <h2 className="text-xl font-semibold text-[var(--color-text)] mb-6">
            Order Progress
          </h2>

          <ol className="space-y-6">
            {timeline.map((step, index) => (
              <li key={index} className="flex gap-4">
                {/* Icon */}
                <div className="flex flex-col items-center">
                  <div
                    aria-hidden="true"
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      step.status === 'completed'
                        ? 'bg-[var(--color-green)] text-white'
                        : step.status === 'current'
                        ? 'bg-[var(--color-accent)] text-white motion-safe:animate-pulse'
                        : 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {step.status === 'completed' ? <Check className="h-5 w-5" /> : <span className="text-sm">&#9675;</span>}
                  </div>
                  {index < timeline.length - 1 && (
                    <div
                      aria-hidden="true"
                      className={`w-0.5 flex-1 min-h-[40px] ${
                        step.status === 'completed' ? 'bg-[var(--color-green)]' : 'bg-[var(--color-border)]'
                      }`}
                    ></div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  <p
                    className={`font-semibold ${
                      step.status === 'upcoming'
                        ? 'text-[var(--color-text-muted)]'
                        : 'text-[var(--color-text)]'
                    }`}
                  >
                    {step.title}
                    <span className="sr-only">
                      {step.status === 'completed' ? ' — completed' : step.status === 'current' ? ' — in progress' : ' — upcoming'}
                    </span>
                  </p>
                  <p
                    className={`text-sm ${
                      step.status === 'upcoming' ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-muted)]'
                    }`}
                  >
                    {step.description}
                  </p>
                  {step.timestamp && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      {formatDate(step.timestamp)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Tracking Number */}
        {order.trackingNumber && (
          <div className="mt-6 bg-white rounded-xl border border-[var(--color-border)] p-6">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">
              Tracking Number
            </h3>
            <p className="font-mono text-[var(--color-text)] bg-[var(--color-surface-alt)] px-4 py-2 rounded border border-[var(--color-border)] inline-block">
              {order.trackingNumber}
            </p>
          </div>
        )}

        {/* Actions */}
        {actionError && (
          <div role="alert" className="mt-4 p-3 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-xl text-[var(--color-danger)] text-sm">
            {actionError}
          </div>
        )}

        {isBuyer && order.status === 'SHIPPED' && (
          <div className="mt-6 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl p-6">
            <h3 id="confirm-delivery-heading" className="text-lg font-semibold text-[var(--color-text)] mb-2">
              Has your order arrived?
            </h3>
            <p id="confirm-delivery-desc" className="text-[var(--color-text-muted)] mb-4">
              Confirm that you have received the item. This will notify the seller and move the order to delivered status.
            </p>
            <button
              disabled={actionLoading}
              aria-describedby="confirm-delivery-desc"
              className="bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => updateOrderStatus('DELIVERED')}
            >
              {actionLoading ? 'Confirming...' : 'Confirm Delivery'}
            </button>
          </div>
        )}

        {isBuyer && order.status === 'DELIVERED' && (
          <div className="mt-6 bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 rounded-xl p-6">
            <h3 id="release-escrow-heading" className="text-lg font-semibold text-[var(--color-text)] mb-2">
              Everything as expected?
            </h3>
            <p id="release-escrow-desc" className="text-[var(--color-text-muted)] mb-4">
              Confirm receipt to complete the order and release escrow funds to the seller. Only do this once you are satisfied with the item.
            </p>
            <button
              disabled={actionLoading}
              aria-describedby="release-escrow-desc"
              className="bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => updateOrderStatus('COMPLETED')}
            >
              {actionLoading ? 'Processing...' : 'Confirm Receipt & Release Escrow'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
