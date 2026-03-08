'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/auth-context';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatPrice } from '@/lib/currency';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Listing {
  id: string;
  title: string;
  deviceType: string;
  brand: string;
  model: string;
  price: number;
  currency: string;
  status: string;
  trustLensStatus: string;
  conditionGrade: string | null;
  createdAt: string;
  publishedAt: string | null;
}

interface Order {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  sellerId?: string;
  buyerId?: string;
  buyer?: { displayName: string; avatarUrl: string | null; email: string } | null;
  seller?: { displayName: string; avatarUrl: string | null; email: string } | null;
  listing?: { title: string; brand: string; model: string } | null;
}

interface VerificationRequest {
  id: string;
  listingId: string;
  sellerId: string;
  status: string;
  conditionGrade: string | null;
  integrityFlags: string[];
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DashboardStats {
  totalUsers: number;
  totalListings: number;
  activeListings: number;
  pendingVerification: number;
  totalOrders: number;
  totalRevenue: number;
  byStatus: Record<string, number>;
}

interface AnalyticsData {
  revenueByDay: { date: string; revenue: number; orders: number }[];
  ordersByStatus: { status: string; count: number; value: number }[];
  deviceTypes: { type: string; count: number }[];
  userGrowth: { date: string; users: number }[];
  topSellers: { seller: string; revenue: number; orders: number }[];
}

type TabId = 'overview' | 'analytics' | 'users' | 'listings' | 'orders' | 'verification';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface UserProfile {
  displayName: string;
  firstName?: string;
  lastName?: string;
}

function AdminDashboardContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'overview';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [tabLoading, setTabLoading] = useState<Record<TabId, boolean>>({
    overview: false,
    analytics: false,
    users: false,
    listings: false,
    orders: false,
    verification: false,
  });
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Data state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);

  // Cache flags to prevent unnecessary re-fetching
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [listingsLoaded, setListingsLoaded] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [verificationsLoaded, setVerificationsLoaded] = useState(false);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // Fetch admin's own profile for display name
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/users/${user.id}/profile`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setProfile(data); })
      .catch(() => {});
  }, [user?.id]);

  // Load data based on active tab (lazy loading)
  const loadTabData = useCallback(async () => {
    setTabLoading(prev => ({ ...prev, [activeTab]: true }));
    try {
      if (activeTab === 'overview' && !statsLoaded) {
        await loadStats();
        setStatsLoaded(true);
      } else if (activeTab === 'analytics' && !analyticsLoaded) {
        await loadAnalytics();
        setAnalyticsLoaded(true);
      } else if (activeTab === 'users' && !usersLoaded) {
        await loadUsers();
        setUsersLoaded(true);
      } else if (activeTab === 'listings' && !listingsLoaded) {
        await loadListings();
        setListingsLoaded(true);
      } else if (activeTab === 'orders' && !ordersLoaded) {
        await loadOrders();
        setOrdersLoaded(true);
      } else if (activeTab === 'verification' && !verificationsLoaded) {
        await loadVerifications();
        setVerificationsLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load tab data:', error);
    } finally {
      setTabLoading(prev => ({ ...prev, [activeTab]: false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, statsLoaded, analyticsLoaded, usersLoaded, listingsLoaded, ordersLoaded, verificationsLoaded]);

  useEffect(() => {
    if (!user) return;
    loadTabData();
  }, [user, loadTabData]);

  const loadStats = async () => {
    try {
      const [usersRes, listingsRes, ordersRes, verificationsRes] = await Promise.all([
        fetch('/api/admin/users', { credentials: 'include' }),
        fetch('/api/admin/listings', { credentials: 'include' }),
        fetch('/api/admin/orders?limit=100&enrich=false', { credentials: 'include' }),
        fetch('/api/trust-lens?limit=1000', { credentials: 'include' }),
      ]);

      const usersData = usersRes.ok ? await usersRes.json() : { data: [] };
      const listingsData = listingsRes.ok ? await listingsRes.json() : { data: [] };
      const ordersData = ordersRes.ok ? await ordersRes.json() : { data: [] };
      const verificationsData = verificationsRes.ok ? await verificationsRes.json() : { data: [] };

      const totalUsers = Array.isArray(usersData) ? usersData.length : (usersData.data?.length || 0);
      const allListings = Array.isArray(listingsData) ? listingsData : (listingsData.data || []);
      const allOrders = Array.isArray(ordersData.orders) ? ordersData.orders : [];
      const allVerifications: Array<{ status: string }> = Array.isArray(verificationsData)
        ? verificationsData
        : (verificationsData.data || []);

      // Count actionable verification requests from the trust-lens service (the source of truth)
      const ACTIONABLE_STATUSES = ['PENDING', 'IN_PROGRESS', 'REQUIRES_REVIEW'];
      const pendingVerification = allVerifications.filter(v =>
        ACTIONABLE_STATUSES.includes(v.status)
      ).length;

      setStats({
        totalUsers,
        totalListings: allListings.length,
        activeListings: allListings.filter((l: Listing) => l.status === 'ACTIVE').length,
        pendingVerification,
        totalOrders: ordersData.stats?.totalOrders || allOrders.length,
        totalRevenue: ordersData.stats?.totalRevenue || 0,
        byStatus: ordersData.stats?.byStatus || {},
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
      setStats(null);
    }
  };

  const loadAnalytics = async () => {
    try {
      const ordersRes = await fetch('/api/admin/orders?limit=100&enrich=false', { credentials: 'include' });
      if (!ordersRes.ok) return;
      const ordersData = await ordersRes.json();
      const allOrders: Order[] = ordersData.orders ?? [];

      const listingsRes = await fetch('/api/admin/listings', { credentials: 'include' });
      const listingsData = listingsRes.ok ? await listingsRes.json() : { data: [] };
      const allListings = Array.isArray(listingsData) ? listingsData : (listingsData.data || []);

      const usersRes = await fetch('/api/admin/users', { credentials: 'include' });
      const usersData = usersRes.ok ? await usersRes.json() : { data: [] };
      const allUsers = Array.isArray(usersData) ? usersData : (usersData.data || []);

      setAnalytics({
        revenueByDay: generateRevenueByDay(allOrders),
        ordersByStatus: generateOrdersByStatus(allOrders),
        deviceTypes: generateDeviceTypes(allListings),
        userGrowth: generateUserGrowth(allUsers),
        topSellers: generateTopSellers(allOrders),
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
      setAnalytics(null);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : (data.data || []));
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
    }
  };

  const loadListings = async () => {
    try {
      const res = await fetch('/api/admin/listings', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setListings(Array.isArray(data) ? data : (data.data || []));
    } catch (error) {
      console.error('Failed to load listings:', error);
      setListings([]);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await fetch('/api/admin/orders?limit=1000', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch (error) {
      console.error('Failed to load orders:', error);
      setOrders([]);
    }
  };

  const loadVerifications = async () => {
    try {
      const res = await fetch('/api/trust-lens?limit=100', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setVerifications(Array.isArray(data) ? data : (data.data || []));
    } catch (error) {
      console.error('Failed to load verifications:', error);
      setVerifications([]);
    }
  };

  // ============================================================================
  // ANALYTICS HELPERS
  // ============================================================================

  const generateRevenueByDay = (orders: Order[]) => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    const revenueMap = new Map<string, { revenue: number; orders: number }>();
    last30Days.forEach(date => revenueMap.set(date, { revenue: 0, orders: 0 }));

    // Count all revenue-generating statuses (same as stats route)
    const REVENUE_STATUSES = ['COMPLETED', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'PAYMENT_RECEIVED'];
    orders.filter(o => REVENUE_STATUSES.includes(o.status)).forEach(order => {
      const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
      if (revenueMap.has(orderDate)) {
        const current = revenueMap.get(orderDate)!;
        revenueMap.set(orderDate, {
          revenue: current.revenue + Number(order.amount) * 0.05,
          orders: current.orders + 1,
        });
      }
    });

    return Array.from(revenueMap.entries()).map(([date, data]) => ({
      date: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
      revenue: Math.round(data.revenue * 100) / 100,
      orders: data.orders,
    }));
  };

  const generateOrdersByStatus = (orders: Order[]) => {
    const statusMap = new Map<string, { count: number; value: number }>();
    orders.forEach(order => {
      const current = statusMap.get(order.status) || { count: 0, value: 0 };
      statusMap.set(order.status, { count: current.count + 1, value: current.value + Number(order.amount) });
    });
    return Array.from(statusMap.entries()).map(([status, data]) => ({
      status: status.replace('_', ' '),
      count: data.count,
      value: Math.round(data.value * 100) / 100,
    }));
  };

  const generateDeviceTypes = (listings: Listing[]) => {
    const typeMap = new Map<string, number>();
    listings.forEach(listing => {
      const type = listing.deviceType || 'OTHER';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });
    return Array.from(typeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  };

  const generateUserGrowth = (users: User[]) => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });
    return last30Days.map(date => ({
      date: new Date(date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
      users: users.filter(u => new Date(u.createdAt).toISOString().split('T')[0] <= date).length,
    }));
  };

  const generateTopSellers = (orders: Order[]) => {
    const REVENUE_STATUSES = ['COMPLETED', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'PAYMENT_RECEIVED'];
    const sellerMap = new Map<string, { label: string; revenue: number; orders: number }>();
    orders.filter(o => REVENUE_STATUSES.includes(o.status)).forEach(order => {
      // Use displayName if enriched, fall back to truncated sellerId
      const key = order.seller?.displayName
        || (order.sellerId ? `Seller …${order.sellerId.slice(-6)}` : 'Unknown');
      const current = sellerMap.get(key) || { label: key, revenue: 0, orders: 0 };
      sellerMap.set(key, {
        label: key,
        revenue: current.revenue + Number(order.amount) * 0.05,
        orders: current.orders + 1,
      });
    });
    return Array.from(sellerMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(s => ({ seller: s.label, revenue: Math.round(s.revenue * 100) / 100, orders: s.orders }));
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const getDisplayName = () => {
    if (profile?.displayName) return profile.displayName;
    if (user?.name) {
      const firstName = user.name.split(' ')[0];
      if (['Admin', 'User', 'Test', 'Demo'].includes(firstName) && user.name.split(' ').length > 1) {
        return user.name.split(' ')[1];
      }
      return firstName;
    }
    return user?.email ?? 'Admin';
  };

  const pendingVerificationCount = verifications.filter(v => v.status === 'PENDING' || v.status === 'IN_PROGRESS').length;

  const TabSpinner = () => (
    <div className="flex items-center justify-center py-24" role="status">
      <div className="motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
      <span className="sr-only">Loading...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome back, {getDisplayName()}</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 border-b border-gray-200 -mb-px overflow-x-auto">
            {([
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'analytics', label: 'Analytics', icon: '📈' },
              { id: 'verification', label: 'Verification', icon: '🔍', badge: stats?.pendingVerification },
              { id: 'users', label: 'Users', icon: '👥' },
              { id: 'listings', label: 'Listings', icon: '📦' },
              { id: 'orders', label: 'Orders', icon: '💳' },
            ] as { id: TabId; label: string; icon: string; badge?: number }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span className="ml-1 bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (tabLoading.overview ? <TabSpinner /> : <OverviewTab stats={stats} onTabChange={setActiveTab} />)}
        {activeTab === 'analytics' && (tabLoading.analytics ? <TabSpinner /> : <AnalyticsTab analytics={analytics} />)}
        {activeTab === 'verification' && (tabLoading.verification ? <TabSpinner /> : (
          <VerificationTab
            verifications={verifications}
            onRefresh={() => { setVerificationsLoaded(false); loadVerifications().then(() => setVerificationsLoaded(true)); }}
          />
        ))}
        {activeTab === 'users' && (tabLoading.users ? <TabSpinner /> : <UsersTab users={users} />)}
        {activeTab === 'listings' && (tabLoading.listings ? <TabSpinner /> : <ListingsTab listings={listings} />)}
        {activeTab === 'orders' && (tabLoading.orders ? <TabSpinner /> : (
          <OrdersTab
            orders={orders}
            stats={stats}
            onOrderUpdate={(updatedOrder) => setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o))}
            onOrderRemove={(orderId) => setOrders(prev => prev.filter(o => o.id !== orderId))}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================

function OverviewTab({ stats, onTabChange }: { stats: DashboardStats | null; onTabChange: (tab: TabId) => void }) {
  if (!stats) return <div className="text-center py-12 text-gray-500">Loading overview...</div>;

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: 'bg-blue-500', tab: 'users' as TabId },
    { label: 'Total Listings', value: stats.totalListings, icon: '📦', color: 'bg-green-500', tab: 'listings' as TabId },
    { label: 'Active Listings', value: stats.activeListings, icon: '✅', color: 'bg-emerald-500', tab: 'listings' as TabId },
    { label: 'Pending Verification', value: stats.pendingVerification, icon: '⏳', color: 'bg-yellow-500', tab: 'verification' as TabId },
    { label: 'Total Orders', value: stats.totalOrders, icon: '💳', color: 'bg-purple-500', tab: 'orders' as TabId },
    { label: 'Platform Revenue (5%)', value: formatPrice(stats.totalRevenue, 'GBP'), icon: '💷', color: 'bg-pink-500', tab: 'analytics' as TabId },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, idx) => (
          <button
            key={idx}
            onClick={() => onTabChange(stat.tab)}
            className="bg-white rounded-lg shadow p-6 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center text-2xl`}>
                {stat.icon}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Orders by Status */}
      {Object.keys(stats.byStatus).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Orders by Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <div key={status} className="border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{status.replace(/_/g, ' ')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => onTabChange('verification')}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[var(--color-primary)] hover:bg-blue-50 transition-colors text-left"
          >
            <div className="text-2xl mb-2">🔍</div>
            <h3 className="font-semibold text-gray-900">Review Verifications</h3>
            <p className="text-sm text-gray-600 mt-1">
              {stats.pendingVerification > 0
                ? `${stats.pendingVerification} pending review`
                : 'Queue is clear'}
            </p>
          </button>
          <button
            onClick={() => onTabChange('orders')}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[var(--color-primary)] hover:bg-blue-50 transition-colors text-left"
          >
            <div className="text-2xl mb-2">💳</div>
            <h3 className="font-semibold text-gray-900">Manage Orders</h3>
            <p className="text-sm text-gray-600 mt-1">Update status, issue refunds</p>
          </button>
          <button
            onClick={() => onTabChange('users')}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-[var(--color-primary)] hover:bg-blue-50 transition-colors text-left"
          >
            <div className="text-2xl mb-2">👥</div>
            <h3 className="font-semibold text-gray-900">Manage Users</h3>
            <p className="text-sm text-gray-600 mt-1">{stats.totalUsers} registered users</p>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ANALYTICS TAB
// ============================================================================

function AnalyticsTab({ analytics }: { analytics: AnalyticsData | null }) {
  if (!analytics) {
    return (
      <div className="text-center py-12 text-gray-500">No analytics data available.</div>
    );
  }

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics.revenueByDay} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={(v: number) => `£${v.toFixed(0)}`} width={55} />
            <Tooltip formatter={(value: number | undefined) => [`£${Number(value ?? 0).toFixed(2)}`]} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} name="Revenue (£)" />
            <Line type="monotone" dataKey="orders" stroke="#10B981" strokeWidth={2} name="Orders" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Device Types</h2>
          {analytics.deviceTypes.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={analytics.deviceTypes} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={100} label>
                  {analytics.deviceTypes.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">No device data</div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Orders by Status</h2>
          {analytics.ordersByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={analytics.ordersByStatus} margin={{ top: 5, right: 20, left: 0, bottom: 70 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value: number | undefined, name: string | undefined) => [value ?? 0, name === 'count' ? 'Orders' : (name ?? '')]} />
                <Bar dataKey="count" fill="#3B82F6" name="Orders" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-gray-400 text-sm">No order data</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">User Growth (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics.userGrowth}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="users" stroke="#10B981" strokeWidth={2} name="Total Users" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Sellers by Revenue</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seller</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue (5%)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.topSellers.map((seller, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">#{idx + 1}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{seller.seller}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-green-600">{formatPrice(seller.revenue, 'GBP')}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{seller.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// VERIFICATION TAB
// ============================================================================

function VerificationTab({
  verifications,
  onRefresh,
}: {
  verifications: VerificationRequest[];
  onRefresh: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = verifications.filter(v => {
    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    const matchesSearch =
      !searchTerm ||
      v.listingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusColor = (status: string) => {
    switch (status) {
      case 'PASSED': return 'bg-green-100 text-green-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'REQUIRES_REVIEW': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const pending = verifications.filter(v => v.status === 'PENDING' || v.status === 'IN_PROGRESS').length;

  return (
    <div className="space-y-6">
      {pending > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-yellow-800 text-sm font-medium">
            {pending} listing{pending > 1 ? 's' : ''} awaiting verification review
          </span>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className="text-xs px-3 py-1 bg-yellow-500 text-white rounded-full hover:bg-yellow-600"
          >
            Show pending
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by listing ID or request ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REQUIRES_REVIEW">Requires Review</option>
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors whitespace-nowrap"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listing ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flags</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-sm">
                    No verification requests found
                  </td>
                </tr>
              ) : (
                filtered.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-mono text-gray-600">{v.listingId.slice(0, 12)}...</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${statusColor(v.status)}`}>
                        {v.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {v.conditionGrade ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Grade {v.conditionGrade}</span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 max-w-xs">
                      {(v.integrityFlags ?? []).length > 0
                        ? (v.integrityFlags ?? []).map(f => f.replace(/_/g, ' ')).join(', ')
                        : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/admin/review/${v.listingId}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-md text-xs hover:opacity-90 transition-opacity"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-gray-500 text-center">
        Showing {filtered.length} of {verifications.length} requests
      </p>
    </div>
  );
}

// ============================================================================
// USERS TAB
// ============================================================================

function UsersTab({ users }: { users: User[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [localUsers, setLocalUsers] = useState(users);
  const [actionError, setActionError] = useState('');

  const filteredUsers = localUsers.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    setActionError('');
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setLocalUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || 'Failed to delete user');
      }
    } catch {
      setActionError('Failed to delete user');
    }
  };

  const handleSaveUser = async (updated: User) => {
    setActionError('');
    try {
      const res = await fetch(`/api/admin/users/${updated.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: updated.name, role: updated.role }),
      });
      if (res.ok) {
        const data = await res.json();
        setLocalUsers(prev => prev.map(u => u.id === updated.id ? data : u));
        setEditingUser(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || 'Failed to update user');
      }
    } catch {
      setActionError('Failed to update user');
    }
  };

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {actionError}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">User</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{u.name || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                      {u.role === 'ADMIN' ? 'ADMIN' : 'USER'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">{u.isEmailVerified ? '✅' : '❌'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <button onClick={() => setEditingUser(u)} className="text-blue-600 hover:text-blue-900 mr-4">
                      Edit
                    </button>
                    <button onClick={() => handleDeleteUser(u.id)} className="text-red-600 hover:text-red-900">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-sm text-gray-500 text-center">Showing {filteredUsers.length} of {localUsers.length} users</p>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit User</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingUser.name || ''}
                  onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={editingUser.email} disabled className="w-full px-3 py-2 border rounded-lg bg-gray-100 cursor-not-allowed text-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editingUser.role}
                  onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">
                Cancel
              </button>
              <button onClick={() => handleSaveUser(editingUser)} className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LISTINGS TAB
// ============================================================================

function ListingsTab({ listings }: { listings: Listing[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [trustFilter, setTrustFilter] = useState<string>('ALL');
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [localListings, setLocalListings] = useState(listings);
  const [actionError, setActionError] = useState('');

  const filtered = localListings.filter(l => {
    const matchesSearch = l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.model.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;
    const matchesTrust = trustFilter === 'ALL' || l.trustLensStatus === trustFilter;
    return matchesSearch && matchesStatus && matchesTrust;
  });

  const handleChangeStatus = async (listingId: string, newStatus: string) => {
    setActionError('');
    try {
      const res = await fetch(`/api/admin/listings/${listingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setLocalListings(prev => prev.map(l => l.id === listingId ? { ...l, status: newStatus } : l));
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || 'Failed to update status');
      }
    } catch {
      setActionError('Failed to update status');
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    if (!confirm('Delete this listing permanently?')) return;
    setActionError('');
    try {
      const res = await fetch(`/api/admin/listings/${listingId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setLocalListings(prev => prev.filter(l => l.id !== listingId));
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || 'Failed to delete listing');
      }
    } catch {
      setActionError('Failed to delete listing');
    }
  };

  const handleSaveListing = async (updated: Listing) => {
    setActionError('');
    try {
      const res = await fetch(`/api/admin/listings/${updated.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: updated.title, price: updated.price, status: updated.status }),
      });
      if (res.ok) {
        const data = await res.json();
        setLocalListings(prev => prev.map(l => l.id === updated.id ? data : l));
        setEditingListing(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || 'Failed to update listing');
      }
    } catch {
      setActionError('Failed to update listing');
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800',
      SOLD: 'bg-blue-100 text-blue-800',
      DELISTED: 'bg-red-100 text-red-800',
      DRAFT: 'bg-gray-100 text-gray-800',
      SUBMITTED: 'bg-indigo-100 text-indigo-800',
      UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-teal-100 text-teal-800',
      REJECTED: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const trustBadge = (status: string) => {
    const colors: Record<string, string> = {
      PASSED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      REQUIRES_REVIEW: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{actionError}</div>
      )}

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap">
          <input
            type="text"
            placeholder="Search listings..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[180px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="ACTIVE">Active</option>
            <option value="SOLD">Sold</option>
            <option value="DELISTED">Delisted</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select
            value={trustFilter}
            onChange={e => setTrustFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Verification</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REQUIRES_REVIEW">Requires Review</option>
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listing</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verification</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 max-w-xs">
                    <div className="text-sm font-medium text-gray-900 truncate">{l.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{l.brand} {l.model}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">{formatPrice(l.price, l.currency)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${statusBadge(l.status)}`}>{l.status}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${trustBadge(l.trustLensStatus)}`}>
                      {l.trustLensStatus.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {l.conditionGrade
                      ? <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Grade {l.conditionGrade}</span>
                      : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(l.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => setEditingListing(l)} className="text-blue-600 hover:text-blue-900 text-left text-xs">
                        Edit
                      </button>
                      {l.status === 'ACTIVE' && (
                        <button onClick={() => handleChangeStatus(l.id, 'DELISTED')} className="text-yellow-600 hover:text-yellow-900 text-left text-xs">
                          Delist
                        </button>
                      )}
                      {(l.status === 'DELISTED' || l.status === 'SOLD') && (
                        <button onClick={() => handleChangeStatus(l.id, 'ACTIVE')} className="text-green-600 hover:text-green-900 text-left text-xs">
                          Activate
                        </button>
                      )}
                      <Link
                        href={`/admin/review/${l.id}`}
                        className="text-purple-600 hover:text-purple-900 text-xs"
                      >
                        Review
                      </Link>
                      <button onClick={() => handleDeleteListing(l.id)} className="text-red-600 hover:text-red-900 text-left text-xs">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-gray-500 text-center">Showing {filtered.length} of {localListings.length} listings</p>

      {/* Edit Modal */}
      {editingListing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit Listing</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editingListing.title}
                  onChange={e => setEditingListing({ ...editingListing, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingListing.price}
                  onChange={e => setEditingListing({ ...editingListing, price: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editingListing.status}
                  onChange={e => setEditingListing({ ...editingListing, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SOLD">Sold</option>
                  <option value="DELISTED">Delisted</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingListing(null)} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">
                Cancel
              </button>
              <button onClick={() => handleSaveListing(editingListing)} className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ORDERS TAB
// ============================================================================

const ORDER_STATUSES = [
  'PENDING', 'PAYMENT_RECEIVED', 'ESCROW_HELD', 'SHIPPED',
  'DELIVERED', 'COMPLETED', 'DISPUTED', 'REFUNDED', 'CANCELLED',
];

function OrdersTab({
  orders,
  stats,
  onOrderUpdate,
  onOrderRemove,
}: {
  orders: Order[];
  stats: DashboardStats | null;
  onOrderUpdate: (order: Order) => void;
  onOrderRemove: (orderId: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [actionError, setActionError] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [statusEditId, setStatusEditId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');

  const filtered = orders.filter(o => {
    const matchesSearch =
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.buyer?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.seller?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.listing?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUpdateStatus = async (orderId: string, status: string) => {
    setActionError('');
    setPendingAction(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        onOrderUpdate({ ...orders.find(o => o.id === orderId)!, status: data.status || status });
        setStatusEditId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || 'Failed to update order status');
      }
    } catch {
      setActionError('Failed to update order status');
    } finally {
      setPendingAction(null);
    }
  };

  const handleRefund = async (orderId: string) => {
    if (!confirm('Issue a refund for this order? This will reverse payment via Stripe and mark the listing as Active again.')) return;
    setActionError('');
    setPendingAction(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        onOrderUpdate({ ...orders.find(o => o.id === orderId)!, status: 'REFUNDED' });
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || 'Failed to issue refund');
      }
    } catch {
      setActionError('Failed to issue refund');
    } finally {
      setPendingAction(null);
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!confirm('Cancel this order?')) return;
    await handleUpdateStatus(orderId, 'CANCELLED');
  };

  const statusBadgeColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'SHIPPED':
      case 'DELIVERED': return 'bg-blue-100 text-blue-800';
      case 'DISPUTED':
      case 'REFUNDED': return 'bg-red-100 text-red-800';
      case 'CANCELLED': return 'bg-gray-100 text-gray-800';
      case 'ESCROW_HELD':
      case 'PAYMENT_RECEIVED': return 'bg-teal-100 text-teal-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const canRefund = (status: string) => ['ESCROW_HELD', 'PAYMENT_RECEIVED', 'SHIPPED', 'DELIVERED', 'DISPUTED'].includes(status);
  const canCancel = (status: string) => !['COMPLETED', 'REFUNDED', 'CANCELLED'].includes(status);

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Orders</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalOrders}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Platform Revenue (5%)</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{formatPrice(stats.totalRevenue, 'GBP')}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Average Order Value</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {stats.totalOrders > 0 ? formatPrice((stats.totalRevenue / stats.totalOrders) / 0.05, 'GBP') : '£0.00'}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by order ID, buyer, seller or listing..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="ALL">All Statuses</option>
            {ORDER_STATUSES.map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Buyer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seller</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listing</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 text-sm">No orders found</td>
                </tr>
              ) : (
                filtered.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-xs font-mono text-gray-500">{order.id.slice(0, 8)}...</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {order.buyer ? (
                        <>
                          <div className="font-medium text-gray-900">{order.buyer.displayName}</div>
                          <div className="text-gray-400 text-xs">{order.buyer.email}</div>
                        </>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {order.seller ? (
                        <>
                          <div className="font-medium text-gray-900">{order.seller.displayName}</div>
                          <div className="text-gray-400 text-xs">{order.seller.email}</div>
                        </>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-4 max-w-[160px]">
                      {order.listing ? (
                        <div className="truncate text-sm">
                          <div className="font-medium text-gray-900 truncate">{order.listing.title}</div>
                          <div className="text-gray-400 text-xs">{order.listing.brand} {order.listing.model}</div>
                        </div>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatPrice(order.amount, order.currency)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {statusEditId === order.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={newStatus}
                            onChange={e => setNewStatus(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-1 py-1"
                          >
                            {ORDER_STATUSES.map(s => (
                              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleUpdateStatus(order.id, newStatus)}
                            disabled={pendingAction === order.id}
                            className="text-xs text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {pendingAction === order.id ? '...' : '✓'}
                          </button>
                          <button onClick={() => setStatusEditId(null)} className="text-xs text-gray-500 hover:text-gray-700">✕</button>
                        </div>
                      ) : (
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${statusBadgeColor(order.status)}`}>
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => { setStatusEditId(order.id); setNewStatus(order.status); }}
                          className="text-blue-600 hover:text-blue-900 text-xs text-left"
                        >
                          Change status
                        </button>
                        {canRefund(order.status) && (
                          <button
                            onClick={() => handleRefund(order.id)}
                            disabled={pendingAction === order.id}
                            className="text-amber-600 hover:text-amber-800 text-xs text-left disabled:opacity-50"
                          >
                            {pendingAction === order.id ? 'Processing...' : 'Refund'}
                          </button>
                        )}
                        {canCancel(order.status) && (
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={pendingAction === order.id}
                            className="text-red-600 hover:text-red-900 text-xs text-left disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-gray-500 text-center">Showing {filtered.length} of {orders.length} orders</p>
    </div>
  );
}

// ============================================================================
// EXPORT
// ============================================================================

export default function AdminDashboard() {
  return (
    <ProtectedRoute requireAdmin>
      <Suspense fallback={
        <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
        </div>
      }>
        <AdminDashboardContent />
      </Suspense>
    </ProtectedRoute>
  );
}
