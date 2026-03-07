'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'PAYMENT_RECEIVED':
    case 'ESCROW_HELD':
      return 'bg-blue-100 text-blue-800';
    case 'SHIPPED':
      return 'bg-purple-100 text-purple-800';
    case 'DELIVERED':
      return 'bg-green-100 text-green-800';
    case 'COMPLETED':
      return 'bg-green-200 text-green-900';
    case 'DISPUTED':
      return 'bg-red-100 text-red-800';
    case 'REFUNDED':
      return 'bg-gray-100 text-gray-800';
    case 'CANCELLED':
      return 'bg-gray-200 text-gray-900';
    default:
      return 'bg-gray-100 text-gray-800';
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
      return 'Shipped';
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

const formatCurrency = (amount: string | number, currency: string) => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(numAmount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function OrderConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.orderId as string;

  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState('');
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
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div role="status" className="text-center">
          <div aria-hidden="true" className="motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
          <span className="sr-only">Loading order details...</span>
          <p aria-hidden="true" className="text-[var(--color-text-secondary)]">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div role="alert" className="text-center max-w-md">
          <div aria-hidden="true" className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Order Not Found
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            {error || 'We could not find the order you are looking for.'}
          </p>
          <Link
            href="/browse"
            className="inline-block bg-[var(--color-primary)] text-white px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
          >
            Back to Browse
          </Link>
        </div>
      </div>
    );
  }

  const { order, listing, seller, isSeller } = orderData;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          {order.status === 'COMPLETED' || order.status === 'DELIVERED' ? (
            <>
              <div aria-hidden="true" className="text-6xl mb-4">✅</div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                Order Confirmed!
              </h1>
              <p className="text-[var(--color-text-secondary)]">
                Your order has been placed successfully.
              </p>
            </>
          ) : order.status === 'CANCELLED' || order.status === 'REFUNDED' ? (
            <>
              <div aria-hidden="true" className="text-6xl mb-4">📋</div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                Order Details
              </h1>
              <p className="text-[var(--color-text-secondary)]">
                Order #{order.id.slice(0, 8).toUpperCase()}
              </p>
            </>
          ) : (
            <>
              <div aria-hidden="true" className="text-6xl mb-4">📦</div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                Order Details
              </h1>
              <p className="text-[var(--color-text-secondary)]">
                Order #{order.id.slice(0, 8).toUpperCase()}
              </p>
            </>
          )}
        </div>

        {/* Order Status */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
              Order Status
            </h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
              {getStatusText(order.status)}
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[var(--color-text-secondary)] mb-1">Order ID</p>
              <p className="font-mono text-[var(--color-text-primary)] break-all">{order.id}</p>
            </div>
            <div>
              <p className="text-[var(--color-text-secondary)] mb-1">Order Date</p>
              <p className="text-[var(--color-text-primary)]">{formatDate(order.createdAt)}</p>
            </div>
            {order.paidAt && (
              <div>
                <p className="text-[var(--color-text-secondary)] mb-1">Payment Date</p>
                <p className="text-[var(--color-text-primary)]">{formatDate(order.paidAt)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Item Details */}
        {listing && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">
              Item Details
            </h2>
            <div className="flex gap-4">
              {listing.imageUrls && listing.imageUrls.length > 0 && (
                <img
                  src={listing.imageUrls[0]}
                  alt={listing.title}
                  className="w-24 h-24 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
                  {listing.title}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                  {listing.brand} {listing.model}
                </p>
                <p className="text-lg font-bold text-[var(--color-primary)]">
                  {formatCurrency(order.amount, order.currency)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Seller Information */}
        {seller && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">
              Seller Information
            </h2>
            <div className="text-[var(--color-text-primary)]">
              <p className="font-semibold mb-1">{seller.displayName}</p>
            </div>
          </div>
        )}

        {/* Payment Summary */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">
            Payment Summary
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between text-[var(--color-text-primary)]">
              <span>Subtotal</span>
              <span>{formatCurrency(order.amount, order.currency)}</span>
            </div>
            <div className="flex justify-between text-[var(--color-text-primary)]">
              <span>Shipping</span>
              <span>Free</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between text-lg font-bold text-[var(--color-text-primary)]">
                <span>Total</span>
                <span>{formatCurrency(order.amount, order.currency)}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Buyer Protection:</strong> Your payment is held securely in escrow until you confirm receipt of the item.
            </p>
          </div>
        </div>

        {/* Seller: Mark as Shipped Panel */}
        {isSeller && order.status === 'ESCROW_HELD' && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-blue-200">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              Ship this Order
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Once you have dispatched the item, mark it as shipped. The buyer will be notified and can track progress.
            </p>
            {actionError && (
              <div role="alert" className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {actionError}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <label htmlFor="tracking-number" className="sr-only">
                Tracking number (optional)
              </label>
              <input
                id="tracking-number"
                type="text"
                placeholder="Tracking number (optional)"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                maxLength={100}
                className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <button
                disabled={actionLoading}
                onClick={markAsShipped}
                className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold whitespace-nowrap"
              >
                {actionLoading ? 'Marking as Shipped...' : 'Mark as Shipped'}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/browse"
            className="px-6 py-3 bg-gray-100 text-[var(--color-text-primary)] rounded-lg hover:bg-gray-200 transition-colors"
          >
            Continue Shopping
          </Link>
          <Link
            href={`/orders/${order.id}/tracking`}
            className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Track Order
          </Link>
        </div>
      </div>
    </div>
  );
}
