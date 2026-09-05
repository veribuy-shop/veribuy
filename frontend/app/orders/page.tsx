'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { formatPrice } from '@/lib/currency';
import {
  Package,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  Store,
} from 'lucide-react';

type OrderStatus =
  | 'PENDING'
  | 'PAYMENT_RECEIVED'
  | 'ESCROW_HELD'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'DISPUTED';

interface Order {
  id: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  trackingNumber?: string;
  createdAt: string;
  listingId?: string;
  listingTitle?: string;
}

const STATUS_PRIORITY: Record<string, number> = {
  COMPLETED: 10,
  DELIVERED: 9,
  SHIPPED: 8,
  ESCROW_HELD: 7,
  PAYMENT_RECEIVED: 6,
  DISPUTED: 5,
  PENDING: 4,
  REFUNDED: 2,
  CANCELLED: 1,
};

/**
 * Filter and deduplicate orders so exactly 1 canonical order record is shown per unique listing.
 */
function deduplicateOrders(orders: Order[]): Order[] {
  const groups = new Map<string, Order[]>();

  for (const order of orders) {
    const key =
      order.listingId ||
      (order.listingTitle ? `title:${order.listingTitle.trim().toLowerCase()}` : order.id);
    const existing = groups.get(key) || [];
    existing.push(order);
    groups.set(key, existing);
  }

  const result: Order[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => {
      const pA = STATUS_PRIORITY[a.status] || 0;
      const pB = STATUS_PRIORITY[b.status] || 0;
      if (pA !== pB) return pB - pA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    result.push(group[0]);
  }

  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'buying' | 'selling'>('buying');
  const [buyingOrders, setBuyingOrders] = useState<Order[]>([]);
  const [sellingOrders, setSellingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sellingOrdersFetched = useRef(false);

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/orders');
      return;
    }
    fetchBuyingOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
      const buyingResponse = await fetch(`/api/checkout/orders/buyer/${user.id}`, { credentials: 'include' });
      if (buyingResponse.ok) {
        const buyingData = await buyingResponse.json();
        const rawOrders: Order[] = Array.isArray(buyingData) ? buyingData : buyingData.data ?? [];
        setBuyingOrders(deduplicateOrders(rawOrders));
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
      const sellingResponse = await fetch(`/api/checkout/orders/seller/${user.id}`, { credentials: 'include' });
      if (sellingResponse.ok) {
        const sellingData = await sellingResponse.json();
        const rawOrders: Order[] = Array.isArray(sellingData) ? sellingData : sellingData.data ?? [];
        setSellingOrders(deduplicateOrders(rawOrders));
      }
    } catch (err: any) {
      console.error('Error fetching selling orders:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'COMPLETED':
      case 'DELIVERED':
        return {
          label: status === 'COMPLETED' ? 'Completed' : 'Delivered',
          icon: CheckCircle2,
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        };
      case 'SHIPPED':
        return {
          label: 'In Transit',
          icon: Truck,
          className: 'bg-purple-50 text-purple-800 border-purple-200',
        };
      case 'ESCROW_HELD':
      case 'PAYMENT_RECEIVED':
        return {
          label: 'Escrow Secured',
          icon: ShieldCheck,
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'PENDING':
        return {
          label: 'Pending Payment',
          icon: Clock,
          className: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'DISPUTED':
        return {
          label: 'In Dispute',
          icon: AlertCircle,
          className: 'bg-red-50 text-red-800 border-red-200',
        };
      case 'REFUNDED':
      case 'CANCELLED':
        return {
          label: status === 'REFUNDED' ? 'Refunded' : 'Cancelled',
          icon: RotateCcw,
          className: 'bg-slate-100 text-slate-700 border-slate-200',
        };
      default:
        return {
          label: (status as string).replace('_', ' '),
          icon: Clock,
          className: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  const OrderCard = ({ order, isSeller }: { order: Order; isSeller: boolean }) => {
    const badge = getStatusBadge(order.status);
    const BadgeIcon = badge.icon;

    return (
      <Link
        href={`/orders/${order.id}`}
        className="group relative bg-white hover:border-emerald-300 border border-slate-200 rounded-2xl p-5 md:p-6 transition-all duration-200 flex flex-col justify-between shadow-sm hover:shadow-md"
      >
        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  #{order.id.substring(0, 8)}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(order.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.className}`}
            >
              <BadgeIcon className="w-3.5 h-3.5 shrink-0" />
              {badge.label}
            </span>
          </div>

          {/* Amount & Details */}
          <div className="space-y-3 py-2 border-y border-slate-100 my-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase font-semibold tracking-wider text-slate-500">Total Price</span>
              <span className="text-lg font-bold text-slate-900 tracking-tight">
                {formatPrice(order.amount, order.currency)}
              </span>
            </div>

            {order.trackingNumber && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-slate-500" /> Courier Tracking
                </span>
                <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                  {order.trackingNumber}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-2 flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-500">
            {isSeller ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Sparkles className="w-3.5 h-3.5" /> Outgoing Sale
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-blue-600">
                <ShieldCheck className="w-3.5 h-3.5" /> Protected Purchase
              </span>
            )}
          </span>

          <span className="inline-flex items-center gap-1 text-emerald-600 group-hover:text-emerald-700 transition-colors">
            View Details <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </Link>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div role="status" className="text-center">
          <div
            aria-hidden="true"
            className="inline-block motion-safe:animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent mb-4"
          ></div>
          <span className="sr-only">Loading orders...</span>
          <p className="text-slate-500 text-sm font-medium">Loading your orders...</p>
        </div>
      </div>
    );
  }

  const orders = activeTab === 'buying' ? buyingOrders : sellingOrders;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-8 md:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation back */}
        <div className="mb-4">
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Marketplace
          </Link>
        </div>

        {/* Header with Escrow badge */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-3.5 h-3.5" /> VeriBuy Escrow Protected
            </div>
            <h1 className="text-2xl md:text-4xl font-bold text-slate-900 tracking-tight">Order Management</h1>
            <p className="text-slate-500 text-sm md:text-base mt-1">
              Track real-time delivery status, escrow releases, and order receipts
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 p-2 rounded-xl text-xs shadow-sm">
            <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">
              <span className="font-bold text-slate-900">{buyingOrders.length}</span> Purchases
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">
              <span className="font-bold text-slate-900">{sellingOrders.length}</span> Sales
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="bg-white border border-slate-200 p-1.5 rounded-2xl mb-8 flex gap-2 shadow-sm">
          <button
            role="tab"
            id="tab-buying"
            aria-selected={activeTab === 'buying'}
            aria-controls="tabpanel-buying"
            onClick={() => setActiveTab('buying')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-150 ${
              activeTab === 'buying'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Purchases ({buyingOrders.length})
          </button>
          <button
            role="tab"
            id="tab-selling"
            aria-selected={activeTab === 'selling'}
            aria-controls="tabpanel-selling"
            onClick={() => setActiveTab('selling')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-150 ${
              activeTab === 'selling'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Package className="w-4 h-4" />
            Sales ({sellingOrders.length})
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Orders Grid / Empty State */}
        <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
          {orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 md:p-16 text-center max-w-xl mx-auto shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-5 text-slate-500">
                {activeTab === 'buying' ? <ShoppingBag className="w-8 h-8" /> : <Package className="w-8 h-8" />}
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
                {activeTab === 'buying' ? 'No Purchases Found' : 'No Sales Found'}
              </h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                {activeTab === 'buying'
                  ? 'All devices purchased with Trust Lens™ verification and escrow security will be tracked here.'
                  : 'List your electronics with verified IMEI and instant escrow payouts to start selling.'}
              </p>
              <Link
                href={activeTab === 'buying' ? '/browse' : '/sell'}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors"
              >
                {activeTab === 'buying' ? 'Browse Verified Devices' : 'Create a Listing'}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
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
