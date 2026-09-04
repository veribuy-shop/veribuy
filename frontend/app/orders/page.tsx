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
        setBuyingOrders(Array.isArray(buyingData) ? buyingData : buyingData.data ?? []);
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
        setSellingOrders(Array.isArray(sellingData) ? sellingData : sellingData.data ?? []);
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
          className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        };
      case 'SHIPPED':
        return {
          label: 'In Transit',
          icon: Truck,
          className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        };
      case 'ESCROW_HELD':
      case 'PAYMENT_RECEIVED':
        return {
          label: 'Escrow Secured',
          icon: ShieldCheck,
          className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
        };
      case 'PENDING':
        return {
          label: 'Pending Payment',
          icon: Clock,
          className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        };
      case 'DISPUTED':
        return {
          label: 'In Dispute',
          icon: AlertCircle,
          className: 'bg-red-500/10 text-red-400 border-red-500/20',
        };
      case 'REFUNDED':
      case 'CANCELLED':
        return {
          label: status === 'REFUNDED' ? 'Refunded' : 'Cancelled',
          icon: RotateCcw,
          className: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
        };
      default:
        return {
          label: (status as string).replace('_', ' '),
          icon: Clock,
          className: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
        };
    }
  };

  const OrderCard = ({ order, isSeller }: { order: Order; isSeller: boolean }) => {
    const badge = getStatusBadge(order.status);
    const BadgeIcon = badge.icon;

    return (
      <Link
        href={`/orders/${order.id}`}
        className="group relative bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-emerald-500/40 rounded-2xl p-5 md:p-6 transition-all duration-200 flex flex-col justify-between"
      >
        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-neutral-400 bg-neutral-800/80 px-2 py-0.5 rounded border border-neutral-700/50">
                  #{order.id.substring(0, 8)}
                </span>
                <span className="text-xs text-neutral-500">
                  {new Date(order.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badge.className}`}
            >
              <BadgeIcon className="w-3.5 h-3.5 shrink-0" />
              {badge.label}
            </span>
          </div>

          {/* Amount & Details */}
          <div className="space-y-3 py-2 border-y border-neutral-800/60 my-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase font-medium tracking-wider text-neutral-400">Total Price</span>
              <span className="text-lg font-bold text-white tracking-tight">
                {formatPrice(order.amount, order.currency)}
              </span>
            </div>

            {order.trackingNumber && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-neutral-500" /> Courier Tracking
                </span>
                <span className="font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                  {order.trackingNumber}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-2 flex items-center justify-between text-xs">
          <span className="text-neutral-400">
            {isSeller ? (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <Sparkles className="w-3.5 h-3.5" /> Outgoing Sale
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-blue-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> Protected Purchase
              </span>
            )}
          </span>

          <span className="inline-flex items-center gap-1 text-emerald-400 group-hover:text-emerald-300 font-medium transition-colors">
            View Details <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </Link>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div role="status" className="text-center">
          <div
            aria-hidden="true"
            className="inline-block motion-safe:animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent mb-4"
          ></div>
          <span className="sr-only">Loading orders...</span>
          <p className="text-neutral-400 text-sm">Loading your orders...</p>
        </div>
      </div>
    );
  }

  const orders = activeTab === 'buying' ? buyingOrders : sellingOrders;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 py-8 md:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Escrow badge */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-3.5 h-3.5" /> VeriBuy Escrow Protected
            </div>
            <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight">Order Management</h1>
            <p className="text-neutral-400 text-sm md:text-base mt-1">
              Track real-time delivery status, escrow releases, and order receipts
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 p-2 rounded-xl text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300">
              <span className="font-bold text-white">{buyingOrders.length}</span> Purchases
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300">
              <span className="font-bold text-white">{sellingOrders.length}</span> Sales
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="bg-neutral-900/80 border border-neutral-800 p-1.5 rounded-2xl mb-8 flex gap-2">
          <button
            role="tab"
            id="tab-buying"
            aria-selected={activeTab === 'buying'}
            aria-controls="tabpanel-buying"
            onClick={() => setActiveTab('buying')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 ${
              activeTab === 'buying'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
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
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 ${
              activeTab === 'selling'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <Package className="w-4 h-4" />
            Sales ({sellingOrders.length})
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6 flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Orders Grid / Empty State */}
        <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
          {orders.length === 0 ? (
            <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-10 md:p-16 text-center max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-neutral-800/80 border border-neutral-700/50 flex items-center justify-center mx-auto mb-5 text-neutral-400">
                {activeTab === 'buying' ? <ShoppingBag className="w-8 h-8" /> : <Package className="w-8 h-8" />}
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                {activeTab === 'buying' ? 'No Purchases Found' : 'No Sales Found'}
              </h2>
              <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
                {activeTab === 'buying'
                  ? 'All devices purchased with Trust Lens™ verification and escrow security will be tracked here.'
                  : 'List your electronics with verified IMEI and instant escrow payouts to start selling.'}
              </p>
              <Link
                href={activeTab === 'buying' ? '/browse' : '/sell'}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-950 transition-colors"
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
