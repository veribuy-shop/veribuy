'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { formatPrice } from '@/lib/currency';

type OrderStatus = 'PENDING' | 'PAYMENT_RECEIVED' | 'ESCROW_HELD' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'DISPUTED';

interface Order {
  id: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  trackingNumber?: string;
  createdAt: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'buying' | 'selling'>('buying');
  const [buyingOrders, setBuyingOrders] = useState<Order[]>([]);
  const [sellingOrders, setSellingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // PERF-09: Track whether selling orders have been fetched yet so we only
  // hit the API when the user first switches to the 'Selling' tab.
  const sellingOrdersFetched = useRef(false);

  // On mount: redirect if unauthenticated, otherwise fetch buying orders only.
  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/orders');
      return;
    }
    fetchBuyingOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // PERF-09: Lazy-fetch selling orders the first time the 'Selling' tab is clicked.
  useEffect(() => {
    if (activeTab === 'selling' && !sellingOrdersFetched.current && user) {
      fetchSellingOrders();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchBuyingOrders = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      // Fetch buying orders — BFF returns { data: Order[], pagination: {} }
      const buyingResponse = await fetch(`/api/checkout/orders/buyer/${user.id}`, { credentials: 'include' });
      if (buyingResponse.ok) {
        const buyingData = await buyingResponse.json();
        setBuyingOrders(Array.isArray(buyingData) ? buyingData : (buyingData.data ?? []));
      }
    } catch (err: any) {
      console.error('Error fetching buying orders:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchSellingOrders = async () => {
    if (!user) return;
    sellingOrdersFetched.current = true;
    setLoading(true);
    setError('');
    try {
      // Fetch selling orders — BFF returns { data: Order[], pagination: {} }
      const sellingResponse = await fetch(`/api/checkout/orders/seller/${user.id}`, { credentials: 'include' });
      if (sellingResponse.ok) {
        const sellingData = await sellingResponse.json();
        setSellingOrders(Array.isArray(sellingData) ? sellingData : (sellingData.data ?? []));
      }
    } catch (err: any) {
      console.error('Error fetching selling orders:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    const colors: Record<OrderStatus, string> = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      PAYMENT_RECEIVED: 'bg-blue-100 text-blue-700',
      ESCROW_HELD: 'bg-blue-100 text-blue-700',
      SHIPPED: 'bg-purple-100 text-purple-700',
      DELIVERED: 'bg-indigo-100 text-indigo-700',
      COMPLETED: 'bg-green-100 text-green-700',
      CANCELLED: 'bg-red-100 text-red-700',
      REFUNDED: 'bg-gray-100 text-gray-700',
      DISPUTED: 'bg-orange-100 text-orange-700',
    };
    return colors[status] ?? 'bg-gray-100 text-gray-700';
  };

  const OrderCard = ({ order, isSeller }: { order: Order; isSeller: boolean }) => (
    <Link
      href={`/orders/${order.id}`}
      className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm text-gray-600">Order #{order.id.substring(0, 8)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className={`${getStatusColor(order.status)} px-3 py-1 rounded-full text-xs font-medium`}>
          {order.status.replace('_', ' ')}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Amount:</span>
          <span className="font-semibold text-[var(--color-primary)]">
            {formatPrice(order.amount, order.currency)}
          </span>
        </div>

        {order.trackingNumber && (
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Tracking:</span>
            <span className="font-mono text-xs">{order.trackingNumber}</span>
          </div>
        )}

        {isSeller && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-600">You are selling this item</p>
          </div>
        )}

        {!isSeller && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-600">You purchased this item</p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <span className="text-sm text-[var(--color-primary)] hover:underline">
          View Details <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div role="status" className="text-center">
          <div aria-hidden="true" className="inline-block motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
          <span className="sr-only">Loading orders...</span>
          <p aria-hidden="true" className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  const orders = activeTab === 'buying' ? buyingOrders : sellingOrders;

  return (
    <div className="min-h-screen bg-[var(--color-background)] py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">My Orders</h1>
          <p className="text-gray-600">Manage your purchases and sales</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div
            role="tablist"
            aria-label="Order type"
            className="flex border-b"
          >
            <button
              role="tab"
              id="tab-buying"
              aria-selected={activeTab === 'buying'}
              aria-controls="tabpanel-buying"
              onClick={() => setActiveTab('buying')}
              className={`flex-1 px-6 py-4 font-semibold ${
                activeTab === 'buying'
                  ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Buying{' '}
              <span aria-hidden="true">({buyingOrders.length})</span>
              <span className="sr-only">, {buyingOrders.length} order{buyingOrders.length !== 1 ? 's' : ''}</span>
            </button>
            <button
              role="tab"
              id="tab-selling"
              aria-selected={activeTab === 'selling'}
              aria-controls="tabpanel-selling"
              onClick={() => setActiveTab('selling')}
              className={`flex-1 px-6 py-4 font-semibold ${
                activeTab === 'selling'
                  ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Selling{' '}
              <span aria-hidden="true">({sellingOrders.length})</span>
              <span className="sr-only">, {sellingOrders.length} order{sellingOrders.length !== 1 ? 's' : ''}</span>
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Orders List */}
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {orders.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div aria-hidden="true" className="text-6xl mb-4">📦</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {activeTab === 'buying' ? 'No Purchases Yet' : 'No Sales Yet'}
              </h2>
              <p className="text-gray-600 mb-6">
                {activeTab === 'buying'
                  ? 'Start browsing verified listings to make your first purchase!'
                  : 'List your first device to start selling!'}
              </p>
              <Link
                href={activeTab === 'buying' ? '/browse' : '/dashboard'}
                className="inline-block px-6 py-3 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90"
              >
                {activeTab === 'buying' ? 'Browse Listings' : 'Create Listing'}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} isSeller={activeTab === 'selling'} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
