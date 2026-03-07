'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/auth-context';
import { formatPrice } from '@/lib/currency';

// Types
interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  createdAt: string;
  updatedAt: string;
}

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  status: string;
  deviceType: string;
  brand: string;
  model: string;
  conditionGrade: string;
  trustLensStatus: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

type OrderStatus = 'PENDING' | 'PAYMENT_RECEIVED' | 'ESCROW_HELD' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'DISPUTED';

interface Order {
  id: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  trackingNumber?: string;
  createdAt: string;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
}

type TabType = 'overview' | 'listings' | 'orders' | 'profile';

// ---------------------------------------------------------------------------
// Trust Lens verification badge shown on each seller listing card
// ---------------------------------------------------------------------------

function TrustLensBadge({ status }: { status: string }) {
  if (!status) return null;

  const configs: Record<string, { label: string; className: string; icon: string }> = {
    PASSED: {
      label: 'Verification Passed',
      className: 'bg-green-50 text-green-700 border border-green-200',
      icon: '✓',
    },
    REQUIRES_REVIEW: {
      label: 'Under Review',
      className: 'bg-amber-50 text-amber-700 border border-amber-200',
      icon: '⏳',
    },
    FAILED: {
      label: 'Verification Failed',
      className: 'bg-red-50 text-red-700 border border-red-200',
      icon: '✕',
    },
    PENDING: {
      label: 'Verification Pending',
      className: 'bg-gray-50 text-gray-600 border border-gray-200',
      icon: '○',
    },
  };

  const config = configs[status] ?? {
    label: status,
    className: 'bg-gray-50 text-gray-500 border border-gray-200',
    icon: '○',
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-3 ${config.className}`}>
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </div>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // State
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [buyingOrders, setBuyingOrders] = useState<Order[]>([]);
  const [sellingOrders, setSellingOrders] = useState<Order[]>([]);
  const [ordersTab, setOrdersTab] = useState<'buying' | 'selling'>('buying');
  
  // Loading states
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingListings, setLoadingListings] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [deletingListingId, setDeletingListingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // DATA-05: Consolidated mount effect — run fetchProfile and fetchOverviewData
  // in parallel on first load so a single network round-trip latency doesn't
  // serialise the two independent requests.
  useEffect(() => {
    if (!user?.id) return;
    Promise.all([fetchProfile(), fetchOverviewData()]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Fetch data on tab change (skip overview — already fetched on mount)
  useEffect(() => {
    if (!user?.id) return;

    if (activeTab === 'listings') {
      fetchListings();
    } else if (activeTab === 'orders') {
      fetchOrders();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id]);

  const fetchOverviewData = async () => {
    // Fetch basic stats for overview
    if (user?.id) {
      setLoadingListings(true);
      setLoadingOrders(true);
      
      try {
        // Fetch listings count
        const listingsRes = await fetch(`/api/listings?sellerId=${user.id}`, { credentials: 'include' });
        if (listingsRes.ok) {
          const data = await listingsRes.json();
          setListings(Array.isArray(data) ? data : (data.data || []));
        }
      } catch (error) {
        console.error('Error fetching listings:', error);
      } finally {
        setLoadingListings(false);
      }

      try {
        // Fetch orders count — BFF returns { data: Order[], pagination: {} }
        const buyingRes = await fetch(`/api/checkout/orders/buyer/${user.id}`, { credentials: 'include' });
        if (buyingRes.ok) {
          const buyingData = await buyingRes.json();
          setBuyingOrders(Array.isArray(buyingData) ? buyingData : (buyingData.data ?? []));
        }

        const sellingRes = await fetch(`/api/checkout/orders/seller/${user.id}`, { credentials: 'include' });
        if (sellingRes.ok) {
          const sellingData = await sellingRes.json();
          setSellingOrders(Array.isArray(sellingData) ? sellingData : (sellingData.data ?? []));
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoadingOrders(false);
      }
    }
  };

  const fetchProfile = async () => {
    if (!user?.id) return;
    setLoadingProfile(true);
    try {
      const response = await fetch(`/api/users/${user.id}/profile`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchListings = async () => {
    if (!user?.id) return;
    setLoadingListings(true);
    try {
      const response = await fetch(`/api/listings?sellerId=${user.id}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setListings(Array.isArray(data) ? data : (data.data || []));
      }
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoadingListings(false);
    }
  };

  const fetchOrders = async () => {
    if (!user?.id) return;
    setLoadingOrders(true);
    try {
      const buyingRes = await fetch(`/api/checkout/orders/buyer/${user.id}`, { credentials: 'include' });
      if (buyingRes.ok) {
        const buyingData = await buyingRes.json();
        // Handle paginated response (backend returns { data: [], pagination: {} })
        setBuyingOrders(Array.isArray(buyingData) ? buyingData : (buyingData.data || []));
      }

      const sellingRes = await fetch(`/api/checkout/orders/seller/${user.id}`, { credentials: 'include' });
      if (sellingRes.ok) {
        const sellingData = await sellingRes.json();
        // Handle paginated response (backend returns { data: [], pagination: {} })
        setSellingOrders(Array.isArray(sellingData) ? sellingData : (sellingData.data || []));
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Computed stats
  const activeListings = listings.filter(l => l.status === 'ACTIVE').length;
  const pendingOrders = [...buyingOrders, ...sellingOrders].filter(o => o.status === 'PENDING' || o.status === 'PAYMENT_RECEIVED' || o.status === 'ESCROW_HELD').length;
  const completedOrders = [...buyingOrders, ...sellingOrders].filter(o => o.status === 'COMPLETED').length;
  
  // Display name priority: profile.displayName > first word of user.name (excluding common titles) > 'User'
  const getDisplayName = () => {
    if (profile?.displayName) return profile.displayName;
    if (user?.name) {
      // Extract first name, filtering out common titles/roles
      const firstName = user.name.split(' ')[0];
      const commonTitles = ['Admin', 'User', 'Test', 'Demo'];
      // If first word is a common title and there's a second word, use the second word
      if (commonTitles.includes(firstName) && user.name.split(' ').length > 1) {
        return user.name.split(' ')[1];
      }
      return firstName;
    }
    return 'User';
  };
  const displayName = getDisplayName();

  const handleDeleteListing = async (listingId: string) => {
    setDeleteError(null);
    if (!window.confirm('Are you sure you want to delete this listing? This action cannot be undone.')) {
      return;
    }

    setDeletingListingId(listingId);
    try {
      const response = await fetch(`/api/listings/${listingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        setDeleteError(data.error || 'Failed to delete listing. Please try again.');
        return;
      }

      setListings(prev => prev.filter(l => l.id !== listingId));
    } catch (error) {
      console.error('Error deleting listing:', error);
      setDeleteError('An error occurred while deleting the listing. Please try again.');
    } finally {
      setDeletingListingId(null);
    }
  };

  // Tab rendering functions
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] rounded-xl shadow-sm p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {displayName}!</h1>
        <p className="text-white/90">
          Here's what's happening with your account
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[var(--color-text-muted)]">Active Listings</p>
            <span aria-hidden="true" className="text-2xl">📦</span>
          </div>
          <p className="text-3xl font-bold text-[var(--color-primary)]">{activeListings}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {activeListings === 0 ? 'Create your first listing' : `${listings.length} total listings`}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[var(--color-text-muted)]">Pending Orders</p>
            <span aria-hidden="true" className="text-2xl">⏳</span>
          </div>
          <p className="text-3xl font-bold text-orange-600">{pendingOrders}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {pendingOrders === 0 ? 'No pending orders' : 'Awaiting action'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[var(--color-text-muted)]">Completed Orders</p>
            <span aria-hidden="true" className="text-2xl">✅</span>
          </div>
          <p className="text-3xl font-bold text-green-600">{completedOrders}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {completedOrders === 0 ? 'No completed orders yet' : 'Successfully completed'}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] rounded-xl shadow-sm p-8 text-white">
          <h2 className="font-bold text-2xl mb-3">Browse Devices</h2>
          <p className="mb-6 text-white/90">Find verified electronics from trusted sellers</p>
          <Link
            href="/browse"
            className="inline-block bg-white text-[var(--color-accent-dark)] hover:bg-[var(--color-warm-beige)] px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Start Shopping
          </Link>
        </div>

        <div className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] rounded-xl shadow-sm p-8 text-white">
          <h2 className="font-bold text-2xl mb-3">Sell Your Device</h2>
          <p className="mb-6 text-white/90">List your device and reach thousands of verified buyers</p>
          <Link
            href="/listings/create"
            className="inline-block bg-white text-[var(--color-primary)] hover:bg-[var(--color-warm-beige)] px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Create Listing
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-[var(--color-border)]">
        <h2 className="font-bold text-xl mb-4">Recent Activity</h2>
        {buyingOrders.length === 0 && sellingOrders.length === 0 && listings.length === 0 ? (
          <div className="text-center py-8">
            <div aria-hidden="true" className="text-6xl mb-4">📊</div>
            <p className="text-[var(--color-text-muted)]">No recent activity to show</p>
          </div>
        ) : (
          <div className="space-y-3">
            {buyingOrders.slice(0, 3).map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Purchase Order #{order.id.substring(0, 8)}</p>
                  <p className="text-xs text-gray-600">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[var(--color-primary)]">
                  {formatPrice(order.amount, order.currency)}
                </span>
              </div>
            ))}
            {sellingOrders.slice(0, 3).map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Sale Order #{order.id.substring(0, 8)}</p>
                  <p className="text-xs text-gray-600">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-sm font-semibold text-green-600">
                  {formatPrice(order.amount, order.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderListings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Listings</h2>
        <Link
          href="/listings/create"
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-6 py-2.5 rounded-lg font-semibold transition-colors"
        >
          + Create Listing
        </Link>
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div
          role="alert"
          className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm"
        >
          <span aria-hidden="true" className="mt-0.5 shrink-0">&#9888;</span>
          <span className="flex-1">{deleteError}</span>
          <button
            onClick={() => setDeleteError(null)}
            aria-label="Dismiss error"
            className="shrink-0 text-red-500 hover:text-red-700 font-bold leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {loadingListings ? (
        <div role="status" className="text-center py-12">
          <div aria-hidden="true" className="inline-block motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
          <span className="sr-only">Loading listings...</span>
          <p aria-hidden="true" className="mt-4 text-gray-600">Loading listings...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div aria-hidden="true" className="text-6xl mb-4">📦</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">No Listings Yet</h3>
          <p className="text-gray-600 mb-6">Create your first listing to start selling!</p>
          <Link
            href="/listings/create"
            className="inline-block bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Create Your First Listing
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map(listing => (
            <div key={listing.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-lg line-clamp-2 pr-2">{listing.title}</h3>
                  <span className={`shrink-0 px-2 py-1 text-xs rounded-full ${
                    listing.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                    listing.status === 'PENDING_VERIFICATION' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {listing.status === 'PENDING_VERIFICATION' ? 'Pending' : listing.status}
                  </span>
                </div>

                {/* Trust Lens verification badge */}
                <TrustLensBadge status={listing.trustLensStatus} />

                <p className="text-2xl font-bold text-[var(--color-primary)] mb-2">
                  {formatPrice(listing.price, listing.currency)}
                </p>
                
                <div className="text-sm text-gray-600 space-y-1 mb-4">
                  <p>{listing.brand} {listing.model}</p>
                  <p className="text-xs">Condition: Grade {listing.conditionGrade}</p>
                  <p className="text-xs">Views: {listing.viewCount}</p>
                </div>
                
                <div className="space-y-2">
                  <Link
                    href={`/listings/${listing.id}`}
                    className="block text-center bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    View Listing
                  </Link>
                  <Link
                    href={`/listings/${listing.id}/edit`}
                    className="block text-center border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDeleteListing(listing.id)}
                    disabled={deletingListingId === listing.id}
                    className="w-full text-center border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingListingId === listing.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

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
    return colors[status];
  };

  // Human-readable status label
  const getStatusLabel = (status: OrderStatus): string => {
    const labels: Record<OrderStatus, string> = {
      PENDING: 'Pending',
      PAYMENT_RECEIVED: 'Payment Received',
      ESCROW_HELD: 'Payment in Escrow',
      SHIPPED: 'Shipped',
      DELIVERED: 'Delivered',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
      REFUNDED: 'Refunded',
      DISPUTED: 'Disputed',
    };
    return labels[status];
  };

  // Contextual CTA link label + destination based on role and status
  const getOrderAction = (
    order: Order,
    role: 'buying' | 'selling',
  ): { label: string; href: string } => {
    const base = `/orders/${order.id}`;
    if (role === 'selling' && order.status === 'ESCROW_HELD') {
      return { label: 'Mark as Shipped', href: base };
    }
    if (order.status === 'SHIPPED' || order.status === 'DELIVERED') {
      return { label: 'Track Order', href: `${base}/tracking` };
    }
    return { label: 'View Details', href: base };
  };

  // Latest meaningful timestamp for the order
  const getOrderTimestamp = (order: Order): string => {
    const ts = order.completedAt ?? order.deliveredAt ?? order.shippedAt ?? order.paidAt ?? order.createdAt;
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderOrders = () => {
    const orders = ordersTab === 'buying' ? buyingOrders : sellingOrders;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">My Orders</h2>
          <Link
            href="/orders"
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            View all orders <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* Sub-tab switcher */}
        <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)]">
          <div role="tablist" aria-label="Order type" className="flex">
            <button
              role="tab"
              id="orders-tab-buying"
              aria-selected={ordersTab === 'buying'}
              aria-controls="orders-panel-buying"
              onClick={() => setOrdersTab('buying')}
              className={`flex-1 px-6 py-4 font-semibold rounded-tl-xl rounded-bl-xl transition-colors ${
                ordersTab === 'buying'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Purchases
              <span aria-hidden="true" className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                ordersTab === 'buying' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {buyingOrders.length}
              </span>
              <span className="sr-only">({buyingOrders.length})</span>
            </button>
            <button
              role="tab"
              id="orders-tab-selling"
              aria-selected={ordersTab === 'selling'}
              aria-controls="orders-panel-selling"
              onClick={() => setOrdersTab('selling')}
              className={`flex-1 px-6 py-4 font-semibold rounded-tr-xl rounded-br-xl transition-colors ${
                ordersTab === 'selling'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Sales
              <span aria-hidden="true" className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                ordersTab === 'selling' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {sellingOrders.length}
              </span>
              <span className="sr-only">({sellingOrders.length})</span>
            </button>
          </div>
        </div>

        {loadingOrders ? (
          <div role="status" className="text-center py-12">
            <div aria-hidden="true" className="inline-block motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
            <span className="sr-only">Loading orders...</span>
            <p aria-hidden="true" className="mt-4 text-gray-600">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-12 text-center">
            <div aria-hidden="true" className="text-6xl mb-4">{ordersTab === 'buying' ? '🛒' : '📦'}</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              {ordersTab === 'buying' ? 'No Purchases Yet' : 'No Sales Yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {ordersTab === 'buying'
                ? 'Start browsing verified listings to make your first purchase.'
                : 'List your first device to start receiving orders.'}
            </p>
            <Link
              href={ordersTab === 'buying' ? '/browse' : '/listings/create'}
              className="inline-block px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 font-semibold"
            >
              {ordersTab === 'buying' ? 'Browse Listings' : 'Create Listing'}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {orders.map(order => {
              const action = getOrderAction(order, ordersTab);
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Card top — status bar */}
                  <div className={`h-1.5 w-full ${
                    order.status === 'COMPLETED' ? 'bg-green-500' :
                    order.status === 'CANCELLED' || order.status === 'REFUNDED' ? 'bg-red-400' :
                    order.status === 'DISPUTED' ? 'bg-orange-400' :
                    order.status === 'SHIPPED' || order.status === 'DELIVERED' ? 'bg-purple-500' :
                    'bg-[var(--color-primary)]'
                  }`} />

                  <div className="p-5">
                    {/* Header row */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                          {ordersTab === 'buying' ? 'Purchase' : 'Sale'}
                        </p>
                        <p className="text-sm font-mono font-semibold text-[var(--color-text)]">
                          #{order.id.substring(0, 8).toUpperCase()}
                        </p>
                      </div>
                      <span className={`${getStatusColor(order.status)} px-2.5 py-1 rounded-full text-xs font-semibold`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>

                    {/* Amount */}
                    <p className="text-2xl font-bold text-[var(--color-primary)] mb-3">
                      {formatPrice(order.amount, order.currency)}
                    </p>

                    {/* Meta row */}
                    <div className="space-y-1.5 text-sm text-gray-500 mb-4">
                      <div className="flex items-center gap-2">
                        <span aria-hidden="true" className="text-base">📅</span>
                        <span>{getOrderTimestamp(order)}</span>
                      </div>
                      {order.trackingNumber && (
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true" className="text-base">🚚</span>
                          <span className="font-mono text-xs truncate">{order.trackingNumber}</span>
                        </div>
                      )}
                      {ordersTab === 'selling' && order.status === 'ESCROW_HELD' && (
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true" className="text-base">💡</span>
                          <span className="text-amber-600 font-medium text-xs">Ready to ship</span>
                        </div>
                      )}
                      {order.status === 'DISPUTED' && (
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true" className="text-base">⚠️</span>
                          <span className="text-orange-600 font-medium text-xs">Under dispute review</span>
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <Link
                      href={action.href}
                      className="block w-full text-center px-4 py-2 rounded-lg text-sm font-semibold border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors"
                    >
                      {action.label} <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderProfile = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Profile Settings</h2>

      {loadingProfile ? (
        <div role="status" className="text-center py-12">
          <div aria-hidden="true" className="inline-block motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
          <span className="sr-only">Loading profile...</span>
          <p aria-hidden="true" className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-24 h-24 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-3xl font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-2xl font-bold">{displayName}</h3>
                <p className="text-gray-600">{user?.email}</p>
                <span className="inline-block mt-2 text-xs bg-[var(--color-primary)] text-white px-3 py-1 rounded-full">
                  {user?.role}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="profile-display-name" className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                <input
                  id="profile-display-name"
                  type="text"
                  value={profile?.displayName || ''}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="profile-first-name" className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input
                    id="profile-first-name"
                    type="text"
                    value={profile?.firstName || ''}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label htmlFor="profile-last-name" className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <input
                    id="profile-last-name"
                    type="text"
                    value={profile?.lastName || ''}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
              </div>

              {profile?.bio && (
                <div>
                  <label htmlFor="profile-bio" className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                  <textarea
                    id="profile-bio"
                    value={profile.bio}
                    readOnly
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>

              <div className="pt-4">
                <Link
                  href="/settings"
                  className="inline-block bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Edit Profile
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm mb-6 sticky top-20 z-40">
        <div role="tablist" aria-label="Dashboard sections" className="flex border-b overflow-x-auto">
          {(['overview', 'listings', 'orders', 'profile'] as TabType[]).map((tab) => {
            const labels: Record<TabType, string> = { overview: 'Overview', listings: 'My Listings', orders: 'Orders', profile: 'Profile' };
            return (
              <button
                key={tab}
                role="tab"
                id={`tab-${tab}`}
                aria-selected={activeTab === tab}
                aria-controls={`tabpanel-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-semibold whitespace-nowrap ${
                  activeTab === tab
                    ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="transition-all duration-200">
        <div role="tabpanel" id="tabpanel-overview" aria-labelledby="tab-overview" hidden={activeTab !== 'overview'}>
          {activeTab === 'overview' && renderOverview()}
        </div>
        <div role="tabpanel" id="tabpanel-listings" aria-labelledby="tab-listings" hidden={activeTab !== 'listings'}>
          {activeTab === 'listings' && renderListings()}
        </div>
        <div role="tabpanel" id="tabpanel-orders" aria-labelledby="tab-orders" hidden={activeTab !== 'orders'}>
          {activeTab === 'orders' && renderOrders()}
        </div>
        <div role="tabpanel" id="tabpanel-profile" aria-labelledby="tab-profile" hidden={activeTab !== 'profile'}>
          {activeTab === 'profile' && renderProfile()}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
