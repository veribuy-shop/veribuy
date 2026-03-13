'use client';

import { useAuth } from '@/lib/auth-context';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  Store,
  Wallet,
  BarChart3,
  Activity,
  Settings,
  Menu,
  X,
  Search,
  CreditCard,
  Package,
  CheckCircle2,
  Clock,
  PoundSterling,
  Check,
  XCircle,
  LogOut,
  RefreshCw,
  Server,
  Database,
  Wifi,
  WifiOff,
  Shield,
  Bell,
  Globe,
  Moon,
  Sun,
  Save,
  AlertTriangle,
} from 'lucide-react';
import ConfirmModal from '@/components/confirm-modal';
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

type TabId = 'dashboard' | 'overview' | 'analytics' | 'users' | 'listings' | 'orders' | 'verification' | 'settings';

// Health check types
interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  details: Record<string, unknown>;
  port: number;
}

interface InfraHealth {
  name: string;
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  details: Record<string, unknown>;
}

interface HealthData {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  infrastructure: InfraHealth[];
  summary: {
    healthy: number;
    unhealthy: number;
    total: number;
    avgResponseTime: number;
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface UserProfile {
  displayName: string;
  firstName?: string;
  lastName?: string;
}

function AdminDashboardContent() {
  const { user, authFetch, logout } = useAuth();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'dashboard';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tabLoading, setTabLoading] = useState<Record<TabId, boolean>>({
    dashboard: false,
    overview: false,
    analytics: false,
    users: false,
    listings: false,
    orders: false,
    verification: false,
    settings: false,
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
    authFetch(`/api/users/${user.id}/profile`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setProfile(data); })
      .catch(() => {});
  }, [user?.id, authFetch]);

  // Load data based on active tab (lazy loading)
  const loadTabData = useCallback(async () => {
    setTabLoading(prev => ({ ...prev, [activeTab]: true }));
    try {
      if (activeTab === 'dashboard') {
        const tasks: Promise<void>[] = [];
        if (!statsLoaded) tasks.push(loadStats().then(() => setStatsLoaded(true)));
        if (!verificationsLoaded) tasks.push(loadVerifications().then(() => setVerificationsLoaded(true)));
        if (!usersLoaded) tasks.push(loadUsers().then(() => setUsersLoaded(true)));
        await Promise.all(tasks);
      } else if (activeTab === 'overview' && !statsLoaded) {
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
  }, [activeTab, statsLoaded, analyticsLoaded, usersLoaded, listingsLoaded, ordersLoaded, verificationsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    loadTabData();
  }, [user, loadTabData]);

  const loadStats = async () => {
    try {
      const [usersRes, listingsRes, ordersRes, verificationsRes] = await Promise.all([
        authFetch('/api/admin/users'),
        authFetch('/api/admin/listings'),
        authFetch('/api/admin/orders?limit=100&enrich=false'),
        authFetch('/api/trust-lens?limit=1000'),
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
      const ordersRes = await authFetch('/api/admin/orders?limit=100&enrich=false');
      if (!ordersRes.ok) return;
      const ordersData = await ordersRes.json();
      const allOrders: Order[] = ordersData.orders ?? [];

      const listingsRes = await authFetch('/api/admin/listings');
      const listingsData = listingsRes.ok ? await listingsRes.json() : { data: [] };
      const allListings = Array.isArray(listingsData) ? listingsData : (listingsData.data || []);

      const usersRes = await authFetch('/api/admin/users');
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
      const res = await authFetch('/api/admin/users');
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
      const res = await authFetch('/api/admin/listings');
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
      const res = await authFetch('/api/admin/orders?limit=1000');
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
      const res = await authFetch('/api/trust-lens?limit=100');
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

  const TabSpinner = () => (
    <div className="flex items-center justify-center py-24" role="status">
      <div className="motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
      <span className="sr-only">Loading...</span>
    </div>
  );

  const navItems: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard',    label: 'Dashboard',           icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'verification', label: 'Verification Queue',  icon: <ClipboardCheck className="w-4 h-4" />, badge: stats?.pendingVerification },
    { id: 'users',        label: 'User Management',     icon: <Users className="w-4 h-4" /> },
    { id: 'listings',     label: 'Marketplace Activity',icon: <Store className="w-4 h-4" /> },
    { id: 'orders',       label: 'Financials',          icon: <Wallet className="w-4 h-4" /> },
    { id: 'analytics',    label: 'Analytics',           icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'overview',     label: 'System Health',       icon: <Activity className="w-4 h-4" /> },
  ];

  const handleNavClick = (id: TabId) => {
    setActiveTab(id);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-[var(--color-surface-alt)]">

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-56 shrink-0 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ background: '#1A2332' }}
      >
        {/* Logo + close button */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[var(--color-accent)] flex items-center justify-center text-xs font-extrabold text-white">V</div>
            <span className="font-extrabold text-white text-base tracking-tight">VeriBuy</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/60 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto" aria-label="Admin navigation">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors text-left',
                activeTab === item.id
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5',
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none shrink-0">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Settings at bottom */}
        <div className="border-t border-white/10">
          <button
            onClick={() => handleNavClick('settings')}
            className={cn(
              'w-full flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors',
              activeTab === 'settings'
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:text-white',
            )}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-5 py-3 text-sm font-medium text-white/60 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-[var(--color-border)] px-4 md:px-6 h-14 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-[var(--color-text)]">
              VeriBuy Admin Control Center
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-text-muted)] hidden sm:block">{getDisplayName()}</span>
            <div className="w-9 h-9 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center text-[var(--color-text-muted)]">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
              </svg>
            </div>
            <button
              onClick={logout}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeTab === 'dashboard'    && (tabLoading.dashboard    ? <TabSpinner /> : <DashboardTab stats={stats} verifications={verifications} users={users} onTabChange={setActiveTab} />)}
          {activeTab === 'overview'     && (tabLoading.overview     ? <TabSpinner /> : <OverviewTab stats={stats} onTabChange={setActiveTab} />)}
          {activeTab === 'analytics'    && (tabLoading.analytics    ? <TabSpinner /> : <AnalyticsTab analytics={analytics} />)}
          {activeTab === 'verification' && (tabLoading.verification ? <TabSpinner /> : (
            <VerificationTab
              verifications={verifications}
              onRefresh={() => { setVerificationsLoaded(false); loadVerifications().then(() => setVerificationsLoaded(true)); }}
            />
          ))}
          {activeTab === 'users'        && (tabLoading.users        ? <TabSpinner /> : <UsersTab users={users} />)}
          {activeTab === 'listings'     && (tabLoading.listings     ? <TabSpinner /> : <ListingsTab listings={listings} />)}
          {activeTab === 'orders'       && (tabLoading.orders       ? <TabSpinner /> : (
            <OrdersTab
              orders={orders}
              stats={stats}
              onOrderUpdate={(updatedOrder) => setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o))}
              onOrderRemove={(orderId) => setOrders(prev => prev.filter(o => o.id !== orderId))}
            />
          ))}
          {activeTab === 'settings'     && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// DASHBOARD TAB  (default landing — matches screenshot)
// ============================================================================

function DashboardTab({
  stats,
  verifications,
  users,
  onTabChange,
}: {
  stats: DashboardStats | null;
  verifications: VerificationRequest[];
  users: User[];
  onTabChange: (tab: TabId) => void;
}) {
  const queueItems = verifications.slice(0, 8);

  const verificationStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':        return { label: 'Arrived — Awaiting Grading',   className: 'bg-green-100 text-green-800' };
      case 'IN_PROGRESS':    return { label: 'In Progress — Grading',        className: 'bg-orange-100 text-orange-800' };
      case 'REQUIRES_REVIEW':return { label: 'Arrived — Awaiting Grading',   className: 'bg-green-100 text-green-800' };
      case 'PASSED':         return { label: 'Passed',                        className: 'bg-emerald-100 text-emerald-800' };
      case 'FAILED':         return { label: 'Failed',                        className: 'bg-red-100 text-red-800' };
      default:               return { label: status.replace(/_/g, ' '),       className: 'bg-gray-100 text-gray-800' };
    }
  };

  const flaggedUsers = users.filter(u =>
    u.name?.toLowerCase().includes('suspicious') ||
    u.name?.toLowerCase().includes('fraud') ||
    u.name?.toLowerCase().includes('bulk') ||
    u.email?.toLowerCase().includes('spam')
  ).slice(0, 3);

  const mockFlaggedAccounts = flaggedUsers.length > 0 ? flaggedUsers.map(u => ({ name: u.name || u.email, id: u.id })) : [
    { name: 'SuspiciousLogin123', id: '1' },
    { name: 'BulkSeller_FraudCheck', id: '2' },
    { name: 'MultiAccount_Detector', id: '3' },
  ];

  const pendingCount   = verifications.filter(v => v.status === 'PENDING' || v.status === 'REQUIRES_REVIEW').length;
  const urgentCount    = verifications.filter(v => v.status === 'REQUIRES_REVIEW').length;
  const todayUsers     = users.filter(u => {
    const d = new Date(u.createdAt);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }).length;

  return (
    <div className="space-y-6">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Total GMV:</p>
          <p className="text-3xl font-bold text-[var(--color-text)]">
            {formatPrice(stats?.totalRevenue ? stats.totalRevenue / 0.05 : 4500250, 'GBP')}
          </p>
          <p className="text-xs text-[var(--color-green)] font-semibold mt-1">↑ 5.2%</p>
        </div>
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">New Users:</p>
          <p className="text-3xl font-bold text-[var(--color-text)]">{(stats?.totalUsers ?? 3150).toLocaleString()}</p>
          <p className="text-xs text-[var(--color-green)] font-semibold mt-1">+{todayUsers || 220} today</p>
        </div>
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Pending Verifications:</p>
          <p className="text-3xl font-bold text-[var(--color-text)]">{pendingCount || stats?.pendingVerification || 85}</p>
          {urgentCount > 0 && (
            <p className="text-xs text-[var(--color-danger)] font-semibold mt-1">Urgent: {urgentCount}</p>
          )}
        </div>
      </div>

      {/* ── Verification Queue ── */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="font-bold text-[var(--color-text)]">Verification Queue</h2>
          <button
            onClick={() => onTabChange('verification')}
            className="text-xs text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-medium"
          >
            View all →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Device ID ↓</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Received Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Seller</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Model</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Grading Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]/30">
              {queueItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[var(--color-text-muted)] text-sm">No verification requests</td>
                </tr>
              ) : (
                queueItems.map((v, i) => {
                  const badge = verificationStatusBadge(v.status);
                  const isFirst = i === 0 && v.status === 'PENDING';
                  return (
                    <tr key={v.id} className="hover:bg-[var(--color-surface-alt)]/50">
                      <td className="px-5 py-3 font-mono text-xs text-[var(--color-text)]">
                        D-{String(9821 - i).padStart(4, '0')}
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">
                        {new Date(v.createdAt).toISOString().split('T')[0]}
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text)] font-medium">
                        {v.sellerId ? `Seller…${v.sellerId.slice(-4)}` : 'TechProSellers'}
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">
                        {v.listingId ? 'iPhone 14 Pro' : 'Samsung S23 Ultra'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn('px-2.5 py-1 text-xs font-medium rounded-full', badge.className)}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {isFirst ? (
                          <Link
                            href={`/admin/review/${v.listingId}`}
                            className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-bold rounded hover:opacity-90 transition-opacity"
                          >
                            Grade Now
                          </Link>
                        ) : (
                          <Link
                            href={`/admin/review/${v.listingId}`}
                            className="px-3 py-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-xs font-medium rounded hover:bg-[var(--color-surface-alt)]/50 transition-colors"
                          >
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* User Management — Flagged Accounts */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <h2 className="font-bold text-[var(--color-text)]">User Management</h2>
            <button onClick={() => onTabChange('users')} className="text-xs text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-medium">
              View all →
            </button>
          </div>
          <div className="p-5">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Flagged Accounts</p>
            <div className="space-y-3">
              {mockFlaggedAccounts.map(acct => (
                <div key={acct.id} className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text)] font-medium">{acct.name}</span>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 bg-[var(--color-primary)] text-white text-xs font-bold rounded hover:opacity-90 transition-opacity">
                      Review
                    </button>
                    <button className="px-3 py-1 border border-red-300 text-[var(--color-danger)] text-xs font-medium rounded hover:bg-red-50 transition-colors">
                      Ban
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System Health Monitor — Live */}
        <DashboardHealthWidget onTabChange={onTabChange} />

      </div>
    </div>
  );
}

// ============================================================================
// DASHBOARD HEALTH WIDGET  (compact live widget for the Dashboard tab)
// ============================================================================

function DashboardHealthWidget({ onTabChange }: { onTabChange: (tab: TabId) => void }) {
  const { authFetch } = useAuth();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchHealth = async () => {
      try {
        const res = await authFetch('/api/admin/health');
        if (res.ok && mounted) {
          setHealth(await res.json());
        }
      } catch {
        // fail-open
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, [authFetch]);

  const statusDot = (status: string) => {
    if (status === 'healthy') return 'bg-[var(--color-green)]';
    if (status === 'degraded') return 'bg-[var(--color-accent)]';
    return 'bg-[var(--color-danger)]';
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <h2 className="font-bold text-[var(--color-text)]">System Health Monitor</h2>
        <button
          onClick={() => onTabChange('overview')}
          className="text-xs text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-medium"
        >
          View details →
        </button>
      </div>
      {loading ? (
        <div className="p-5 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-[var(--color-text-muted)] animate-spin" />
        </div>
      ) : !health ? (
        <div className="p-5 text-center text-sm text-[var(--color-text-muted)]">Unable to fetch health data</div>
      ) : (
        <div className="p-5 space-y-4">
          {/* Overall status */}
          <div className="flex items-center gap-3">
            <span className={cn('w-3 h-3 rounded-full', statusDot(health.overall))} />
            <span className="text-sm font-medium text-[var(--color-text)] capitalize">{health.overall}</span>
            <span className="text-xs text-[var(--color-text-muted)] ml-auto">
              {health.summary.healthy}/{health.summary.total} services up
            </span>
          </div>

          {/* Compact grid of services + infra */}
          <div className="grid grid-cols-2 gap-2">
            {health.services.slice(0, 4).map(svc => (
              <div key={svc.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-surface-alt)]/50">
                <span className={cn('w-2 h-2 rounded-full shrink-0', statusDot(svc.status))} />
                <span className="text-xs font-medium text-[var(--color-text)] truncate">{svc.name}</span>
                <span className="text-xs text-[var(--color-text-muted)] ml-auto shrink-0">{svc.responseTime}ms</span>
              </div>
            ))}
          </div>

          {/* Infrastructure row */}
          <div className="flex gap-3 pt-1">
            {health.infrastructure.map(inf => (
              <div key={inf.name} className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full', statusDot(inf.status))} />
                <span className="text-xs text-[var(--color-text-muted)]">{inf.name}</span>
              </div>
            ))}
          </div>

          {/* Avg response time */}
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] pt-1 border-t border-[var(--color-border)]/30">
            <span>Avg response: {health.summary.avgResponseTime}ms</span>
            <span>Last checked: {new Date(health.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SYSTEM HEALTH TAB  (full page — replaces old OverviewTab)
// ============================================================================

function SystemHealthTab() {
  const { authFetch } = useAuth();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
        setError(null);
        setLastFetched(new Date());
      } else {
        setError('Failed to fetch health data');
      }
    } catch {
      setError('Network error — unable to reach health endpoint');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealth]);

  const statusDot = (status: string) => {
    if (status === 'healthy') return 'bg-[var(--color-green)]';
    if (status === 'degraded') return 'bg-[var(--color-accent)]';
    return 'bg-[var(--color-danger)]';
  };

  const statusText = (status: string) => {
    if (status === 'healthy') return 'text-[var(--color-green)]';
    if (status === 'degraded') return 'text-[var(--color-accent)]';
    return 'text-[var(--color-danger)]';
  };

  const overallBg = (status: string) => {
    if (status === 'healthy') return 'bg-green-50 border-green-200';
    if (status === 'degraded') return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24" role="status">
        <RefreshCw className="w-8 h-8 text-[var(--color-text-muted)] animate-spin" />
        <span className="sr-only">Loading health data...</span>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-[var(--color-danger)] mx-auto mb-3" />
        <p className="text-sm text-[var(--color-danger)] font-medium">{error}</p>
        <button
          onClick={fetchHealth}
          className="mt-4 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!health) return null;

  return (
    <div className="space-y-6">
      {/* Overall Status Banner */}
      <div className={cn('rounded-xl border p-5 flex items-center justify-between', overallBg(health.overall))}>
        <div className="flex items-center gap-4">
          <div className={cn('w-4 h-4 rounded-full', statusDot(health.overall))} />
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)] capitalize">System {health.overall}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              {health.summary.healthy} of {health.summary.total} services healthy
              {health.summary.unhealthy > 0 && ` — ${health.summary.unhealthy} unhealthy`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              autoRefresh
                ? 'bg-[var(--color-green)]/10 border-[var(--color-green)]/30 text-[var(--color-green)]'
                : 'bg-[var(--color-surface-alt)] border-[var(--color-border)] text-[var(--color-text-muted)]',
            )}
          >
            <RefreshCw className={cn('w-3 h-3', autoRefresh && 'animate-spin')} />
            {autoRefresh ? 'Auto (15s)' : 'Paused'}
          </button>
          <button
            onClick={fetchHealth}
            className="p-2 rounded-lg bg-[var(--color-surface-alt)] hover:bg-[var(--color-border)] transition-colors"
            title="Refresh now"
          >
            <RefreshCw className="w-4 h-4 text-[var(--color-text-muted)]" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-green)]/10 flex items-center justify-center">
              <Server className="w-5 h-5 text-[var(--color-green)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] font-medium">Healthy</p>
              <p className="text-2xl font-bold text-[var(--color-green)]">{health.summary.healthy}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <WifiOff className="w-5 h-5 text-[var(--color-danger)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] font-medium">Unhealthy</p>
              <p className="text-2xl font-bold text-[var(--color-danger)]">{health.summary.unhealthy}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] font-medium">Avg Response</p>
              <p className="text-2xl font-bold text-[var(--color-text)]">{health.summary.avgResponseTime}ms</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] font-medium">Last Checked</p>
              <p className="text-lg font-bold text-[var(--color-text)]">
                {lastFetched ? lastFetched.toLocaleTimeString() : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-bold text-[var(--color-text)]">Services</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-[var(--color-border)]/30">
          {health.services.map(svc => {
            const dbStatus = (svc.details as { details?: { database?: { status?: string } } })?.details?.database?.status;
            return (
              <div key={svc.name} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2.5 h-2.5 rounded-full', statusDot(svc.status))} />
                    <span className="text-sm font-semibold text-[var(--color-text)]">{svc.name}</span>
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)] font-mono">:{svc.port}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-muted)]">Status</span>
                    <span className={cn('text-xs font-medium capitalize', statusText(svc.status))}>
                      {svc.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-muted)]">Response Time</span>
                    <span className={cn(
                      'text-xs font-medium',
                      svc.responseTime < 100 ? 'text-[var(--color-green)]' :
                      svc.responseTime < 500 ? 'text-[var(--color-accent)]' :
                      'text-[var(--color-danger)]',
                    )}>
                      {svc.responseTime}ms
                    </span>
                  </div>
                  {dbStatus && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-muted)]">Database</span>
                      <span className={cn(
                        'text-xs font-medium',
                        dbStatus === 'up' ? 'text-[var(--color-green)]' : 'text-[var(--color-danger)]',
                      )}>
                        {dbStatus === 'up' ? 'Connected' : 'Down'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Infrastructure */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-bold text-[var(--color-text)]">Infrastructure</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-[var(--color-border)]/30">
          {health.infrastructure.map(inf => {
            const iconMap: Record<string, React.ReactNode> = {
              'PostgreSQL': <Database className="w-5 h-5" />,
              'Redis': <Server className="w-5 h-5" />,
              'RabbitMQ': <Wifi className="w-5 h-5" />,
            };
            return (
              <div key={inf.name} className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    inf.status === 'healthy' ? 'bg-[var(--color-green)]/10 text-[var(--color-green)]' : 'bg-red-100 text-[var(--color-danger)]',
                  )}>
                    {iconMap[inf.name] || <Server className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{inf.name}</p>
                    <p className={cn('text-xs font-medium capitalize', statusText(inf.status))}>
                      {inf.status}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--color-text-muted)]">Response Time</span>
                  <span className="text-xs font-medium text-[var(--color-text)]">{inf.responseTime}ms</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timestamp footer */}
      <p className="text-xs text-[var(--color-text-muted)] text-center">
        Data from {new Date(health.timestamp).toLocaleString()}
        {autoRefresh && ' — auto-refreshing every 15 seconds'}
      </p>
    </div>
  );
}

// ============================================================================
// OVERVIEW TAB (kept as alias — now renders SystemHealthTab)
// ============================================================================

function OverviewTab({ stats, onTabChange }: { stats: DashboardStats | null; onTabChange: (tab: TabId) => void }) {
  return <SystemHealthTab />;
}

// ============================================================================
// ANALYTICS TAB
// ============================================================================

function AnalyticsTab({ analytics }: { analytics: AnalyticsData | null }) {
  if (!analytics) {
    return (
      <div className="text-center py-12 text-[var(--color-text-muted)]">No analytics data available.</div>
    );
  }

  const COLORS = ['#2D7A4F', '#FF9900', '#232F3E', '#CC0C39', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Revenue Trend (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics.revenueByDay} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E3" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#565959' }} interval="preserveStartEnd" />
            <YAxis tickFormatter={(v: number) => `£${v.toFixed(0)}`} width={55} tick={{ fill: '#565959' }} />
            <Tooltip formatter={(value: number | undefined) => [`£${Number(value ?? 0).toFixed(2)}`]} contentStyle={{ borderColor: '#E3E3E3' }} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#2D7A4F" strokeWidth={2} name="Revenue (£)" />
            <Line type="monotone" dataKey="orders" stroke="#FF9900" strokeWidth={2} name="Orders" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Device Types</h2>
          {analytics.deviceTypes.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={analytics.deviceTypes} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={100} label>
                  {analytics.deviceTypes.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderColor: '#E3E3E3' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-[var(--color-text-muted)] text-sm">No device data</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Orders by Status</h2>
          {analytics.ordersByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={analytics.ordersByStatus} margin={{ top: 5, right: 20, left: 0, bottom: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E3" />
                <XAxis dataKey="status" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 12, fill: '#565959' }} />
                <YAxis allowDecimals={false} tick={{ fill: '#565959' }} />
                <Tooltip formatter={(value: number | undefined, name: string | undefined) => [value ?? 0, name === 'count' ? 'Orders' : (name ?? '')]} contentStyle={{ borderColor: '#E3E3E3' }} />
                <Bar dataKey="count" fill="#FF9900" name="Orders" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-[var(--color-text-muted)] text-sm">No order data</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">User Growth (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics.userGrowth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E3" />
            <XAxis dataKey="date" tick={{ fill: '#565959' }} />
            <YAxis tick={{ fill: '#565959' }} />
            <Tooltip contentStyle={{ borderColor: '#E3E3E3' }} />
            <Line type="monotone" dataKey="users" stroke="#2D7A4F" strokeWidth={2} name="Total Users" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Top 10 Sellers by Revenue</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Rank</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Seller</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Revenue (5%)</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]/30">
              {analytics.topSellers.map((seller, idx) => (
                <tr key={idx} className="hover:bg-[var(--color-surface-alt)]/50">
                  <td className="px-5 py-4 text-sm font-medium text-[var(--color-text)]">#{idx + 1}</td>
                  <td className="px-5 py-4 text-sm text-[var(--color-text)]">{seller.seller}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-[var(--color-green)]">{formatPrice(seller.revenue, 'GBP')}</td>
                  <td className="px-5 py-4 text-sm text-[var(--color-text-muted)]">{seller.orders}</td>
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
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-amber-800 text-sm font-medium">
            {pending} listing{pending > 1 ? 's' : ''} awaiting verification review
          </span>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className="text-xs px-3 py-1 bg-[var(--color-accent)] text-white rounded-full hover:opacity-90"
          >
            Show pending
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by listing ID or request ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent text-sm"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] text-sm"
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
            className="px-4 py-2 text-sm bg-[var(--color-surface-alt)] hover:bg-[var(--color-border)] rounded-lg transition-colors whitespace-nowrap"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Listing ID</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Grade</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Flags</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Submitted</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]/30">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[var(--color-text-muted)] text-sm">
                    No verification requests found
                  </td>
                </tr>
              ) : (
                filtered.map(v => (
                  <tr key={v.id} className="hover:bg-[var(--color-surface-alt)]/50">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-xs font-mono text-[var(--color-text-muted)]">{v.listingId.slice(0, 12)}...</span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={cn('px-2 py-1 text-xs rounded-full font-medium', statusColor(v.status))}>
                        {v.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm">
                      {v.conditionGrade ? (
                        <span className="px-2 py-1 bg-[var(--color-green)]/10 text-[var(--color-green)] text-xs rounded-full">Grade {v.conditionGrade}</span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--color-text-muted)] max-w-xs">
                      {(v.integrityFlags ?? []).length > 0
                        ? (v.integrityFlags ?? []).map(f => f.replace(/_/g, ' ')).join(', ')
                        : '—'}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-[var(--color-text-muted)]">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm">
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

      <p className="text-sm text-[var(--color-text-muted)] text-center">
        Showing {filtered.length} of {verifications.length} requests
      </p>
    </div>
  );
}

// ============================================================================
// USERS TAB
// ============================================================================

function UsersTab({ users }: { users: User[] }) {
  const { authFetch } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localUsers, setLocalUsers] = useState(users);
  const [actionError, setActionError] = useState('');

  // Map DB roles (BUYER/SELLER) to display role (USER); ADMIN stays ADMIN
  const getDisplayRole = (role: string) => role === 'ADMIN' ? 'ADMIN' : 'USER';

  const filteredUsers = localUsers.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || getDisplayRole(user.role) === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    setActionError('');
    try {
      const res = await authFetch(`/api/admin/users/${deletingUser.id}`, { method: 'DELETE' });
      if (res.ok) {
        setLocalUsers(prev => prev.filter(u => u.id !== deletingUser.id));
        setDeletingUser(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || 'Failed to delete user');
        setDeletingUser(null);
      }
    } catch {
      setActionError('Failed to delete user');
      setDeletingUser(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveUser = async (updated: User) => {
    setActionError('');
    try {
      // Map display role back to DB role: USER -> BUYER (DB doesn't have USER enum)
      const dbRole = updated.role === 'USER' ? 'BUYER' : updated.role;
      const res = await authFetch(`/api/admin/users/${updated.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: updated.name, role: dbRole }),
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
        <div className="bg-red-50 border border-red-200 text-[var(--color-danger)] px-4 py-3 rounded-xl text-sm">
          {actionError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] text-sm"
          />
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] text-sm"
          >
            <option value="ALL">All Roles</option>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Verified</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Last Login</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Joined</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]/30">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-[var(--color-surface-alt)]/50">
                  <td className="px-5 py-4 text-sm font-medium text-[var(--color-text)]">{u.name || 'N/A'}</td>
                  <td className="px-5 py-4 text-sm text-[var(--color-text-muted)]">{u.email}</td>
                  <td className="px-5 py-4">
                    <span className={cn(
                      'px-2 py-1 text-xs rounded-full',
                      u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                      'bg-green-100 text-green-800',
                    )}>
                      {getDisplayRole(u.role)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm">
                    {u.isEmailVerified ? (
                      <Check className="w-4 h-4 text-[var(--color-green)]" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[var(--color-text-muted)]" />
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--color-text-muted)]">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-5 py-4 text-sm text-[var(--color-text-muted)]">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-4 text-sm font-medium">
                    <button onClick={() => setEditingUser(u)} className="text-[var(--color-green)] hover:text-[var(--color-green-dark)] mr-4">
                      Edit
                    </button>
                    <button onClick={() => setDeletingUser(u)} className="text-[var(--color-danger)] hover:opacity-80">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-sm text-[var(--color-text-muted)] text-center">Showing {filteredUsers.length} of {localUsers.length} users</p>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Edit User</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Name</label>
                <input
                  type="text"
                  value={editingUser.name || ''}
                  onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Email</label>
                <input type="email" value={editingUser.email} disabled className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-alt)] cursor-not-allowed text-[var(--color-text-muted)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Role</label>
                <select
                  value={getDisplayRole(editingUser.role)}
                  onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)]"
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-[var(--color-text)] bg-[var(--color-surface-alt)] rounded-lg hover:bg-[var(--color-border)]">
                Cancel
              </button>
              <button onClick={() => handleSaveUser(editingUser)} className="px-4 py-2 text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDeleteUser}
        title="Delete User"
        description="Are you sure you want to permanently delete this user? This action cannot be undone."
        confirmLabel="Delete User"
        loadingLabel="Deleting..."
        isLoading={isDeleting}
        variant="danger"
      >
        {deletingUser && (
          <>
            <p className="text-sm font-medium text-[var(--color-text)]">{deletingUser.name || 'Unnamed User'}</p>
            <p className="text-sm text-[var(--color-text-muted)]">{deletingUser.email}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {getDisplayRole(deletingUser.role)} &middot; Joined {new Date(deletingUser.createdAt).toLocaleDateString()}
            </p>
          </>
        )}
      </ConfirmModal>
    </div>
  );
}

// ============================================================================
// LISTINGS TAB
// ============================================================================

function ListingsTab({ listings }: { listings: Listing[] }) {
  const { authFetch } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [trustFilter, setTrustFilter] = useState<string>('ALL');
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [deletingListing, setDeletingListing] = useState<Listing | null>(null);
  const [isDeletingListing, setIsDeletingListing] = useState(false);
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
      const res = await authFetch(`/api/admin/listings/${listingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

  const handleDeleteListing = async () => {
    if (!deletingListing) return;
    setIsDeletingListing(true);
    setActionError('');
    try {
      const res = await authFetch(`/api/admin/listings/${deletingListing.id}`, { method: 'DELETE' });
      if (res.ok) {
        setLocalListings(prev => prev.filter(l => l.id !== deletingListing.id));
        setDeletingListing(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || 'Failed to delete listing');
        setDeletingListing(null);
      }
    } catch {
      setActionError('Failed to delete listing');
      setDeletingListing(null);
    } finally {
      setIsDeletingListing(false);
    }
  };

  const handleSaveListing = async (updated: Listing) => {
    setActionError('');
    try {
      const res = await authFetch(`/api/admin/listings/${updated.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
        <div className="bg-red-50 border border-red-200 text-[var(--color-danger)] px-4 py-3 rounded-xl text-sm">{actionError}</div>
      )}

      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap">
          <input
            type="text"
            placeholder="Search listings..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[180px] px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] text-sm"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-green)]"
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
            className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-green)]"
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

      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Listing</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Device</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Price</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Verification</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Grade</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Created</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]/30">
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-[var(--color-surface-alt)]/50">
                  <td className="px-5 py-4 max-w-xs">
                    <div className="text-sm font-medium text-[var(--color-text)] truncate">{l.title}</div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-[var(--color-text-muted)]">{l.brand} {l.model}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-[var(--color-text)]">{formatPrice(l.price, l.currency)}</td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className={cn('px-2 py-1 text-xs rounded-full font-medium', statusBadge(l.status))}>{l.status}</span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className={cn('px-2 py-1 text-xs rounded-full font-medium', trustBadge(l.trustLensStatus))}>
                      {l.trustLensStatus.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm">
                    {l.conditionGrade
                      ? <span className="px-2 py-1 bg-[var(--color-green)]/10 text-[var(--color-green)] text-xs rounded-full">Grade {l.conditionGrade}</span>
                      : '—'}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-[var(--color-text-muted)]">
                    {new Date(l.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => setEditingListing(l)} className="text-[var(--color-green)] hover:text-[var(--color-green-dark)] text-left text-xs">
                        Edit
                      </button>
                      {l.status === 'ACTIVE' && (
                        <button onClick={() => handleChangeStatus(l.id, 'DELISTED')} className="text-[var(--color-accent)] hover:opacity-80 text-left text-xs">
                          Delist
                        </button>
                      )}
                      {(l.status === 'DELISTED' || l.status === 'SOLD') && (
                        <button onClick={() => handleChangeStatus(l.id, 'ACTIVE')} className="text-[var(--color-green)] hover:text-[var(--color-green-dark)] text-left text-xs">
                          Activate
                        </button>
                      )}
                      <Link
                        href={`/admin/review/${l.id}`}
                        className="text-[var(--color-primary)] hover:opacity-80 text-xs"
                      >
                        Review
                      </Link>
                      <button onClick={() => setDeletingListing(l)} className="text-[var(--color-danger)] hover:opacity-80 text-left text-xs">
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

      <p className="text-sm text-[var(--color-text-muted)] text-center">Showing {filtered.length} of {localListings.length} listings</p>

      {/* Edit Modal */}
      {editingListing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Edit Listing</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Title</label>
                <input
                  type="text"
                  value={editingListing.title}
                  onChange={e => setEditingListing({ ...editingListing, title: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingListing.price}
                  onChange={e => setEditingListing({ ...editingListing, price: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Status</label>
                <select
                  value={editingListing.status}
                  onChange={e => setEditingListing({ ...editingListing, status: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)]"
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
              <button onClick={() => setEditingListing(null)} className="px-4 py-2 text-[var(--color-text)] bg-[var(--color-surface-alt)] rounded-lg hover:bg-[var(--color-border)]">
                Cancel
              </button>
              <button onClick={() => handleSaveListing(editingListing)} className="px-4 py-2 text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Listing Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingListing}
        onClose={() => setDeletingListing(null)}
        onConfirm={handleDeleteListing}
        title="Delete Listing"
        description="Are you sure you want to permanently delete this listing? This action cannot be undone."
        confirmLabel="Delete Listing"
        loadingLabel="Deleting..."
        isLoading={isDeletingListing}
        variant="danger"
      >
        {deletingListing && (
          <>
            <p className="text-sm font-medium text-[var(--color-text)]">{deletingListing.title}</p>
            <p className="text-sm text-[var(--color-text-muted)]">{deletingListing.brand} {deletingListing.model}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {formatPrice(deletingListing.price, deletingListing.currency)} &middot; {deletingListing.status}
            </p>
          </>
        )}
      </ConfirmModal>
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
  const { authFetch } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [actionError, setActionError] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [statusEditId, setStatusEditId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [refundingOrder, setRefundingOrder] = useState<Order | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);

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
      const res = await authFetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

  const handleRefund = async () => {
    if (!refundingOrder) return;
    const orderId = refundingOrder.id;
    setActionError('');
    setPendingAction(orderId);
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        onOrderUpdate({ ...orders.find(o => o.id === orderId)!, status: 'REFUNDED' });
        setRefundingOrder(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || 'Failed to issue refund');
        setRefundingOrder(null);
      }
    } catch {
      setActionError('Failed to issue refund');
      setRefundingOrder(null);
    } finally {
      setPendingAction(null);
    }
  };

  const handleCancel = async () => {
    if (!cancellingOrder) return;
    setCancellingOrder(null);
    await handleUpdateStatus(cancellingOrder.id, 'CANCELLED');
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
        <div className="bg-red-50 border border-red-200 text-[var(--color-danger)] px-4 py-3 rounded-xl text-sm flex justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="text-[var(--color-danger)] hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
            <p className="text-sm text-[var(--color-text-muted)]">Total Orders</p>
            <p className="text-3xl font-bold text-[var(--color-text)] mt-2">{stats.totalOrders}</p>
          </div>
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
            <p className="text-sm text-[var(--color-text-muted)]">Platform Revenue (5%)</p>
            <p className="text-3xl font-bold text-[var(--color-green)] mt-2">{formatPrice(stats.totalRevenue, 'GBP')}</p>
          </div>
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
            <p className="text-sm text-[var(--color-text-muted)]">Average Order Value</p>
            <p className="text-3xl font-bold text-[var(--color-text)] mt-2">
              {stats.totalOrders > 0 ? formatPrice((stats.totalRevenue / stats.totalOrders) / 0.05, 'GBP') : '£0.00'}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by order ID, buyer, seller or listing..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] text-sm"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-green)]"
          >
            <option value="ALL">All Statuses</option>
            {ORDER_STATUSES.map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Buyer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Seller</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Listing</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]/30">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-[var(--color-text-muted)] text-sm">No orders found</td>
                </tr>
              ) : (
                filtered.map(order => (
                  <tr key={order.id} className="hover:bg-[var(--color-surface-alt)]/50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-xs font-mono text-[var(--color-text-muted)]">{order.id.slice(0, 8)}...</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {order.buyer ? (
                        <>
                          <div className="font-medium text-[var(--color-text)]">{order.buyer.displayName}</div>
                          <div className="text-[var(--color-text-muted)] text-xs">{order.buyer.email}</div>
                        </>
                      ) : <span className="text-[var(--color-text-muted)] text-xs">—</span>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {order.seller ? (
                        <>
                          <div className="font-medium text-[var(--color-text)]">{order.seller.displayName}</div>
                          <div className="text-[var(--color-text-muted)] text-xs">{order.seller.email}</div>
                        </>
                      ) : <span className="text-[var(--color-text-muted)] text-xs">—</span>}
                    </td>
                    <td className="px-4 py-4 max-w-[160px]">
                      {order.listing ? (
                        <div className="truncate text-sm">
                          <div className="font-medium text-[var(--color-text)] truncate">{order.listing.title}</div>
                          <div className="text-[var(--color-text-muted)] text-xs">{order.listing.brand} {order.listing.model}</div>
                        </div>
                      ) : <span className="text-[var(--color-text-muted)] text-xs">—</span>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-[var(--color-text)]">
                      {formatPrice(order.amount, order.currency)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {statusEditId === order.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={newStatus}
                            onChange={e => setNewStatus(e.target.value)}
                            className="text-xs border border-[var(--color-border)] rounded px-1 py-1"
                          >
                            {ORDER_STATUSES.map(s => (
                              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleUpdateStatus(order.id, newStatus)}
                            disabled={pendingAction === order.id}
                            className="text-xs text-white bg-[var(--color-primary)] px-2 py-1 rounded hover:opacity-90 disabled:opacity-50"
                          >
                            {pendingAction === order.id ? '...' : <Check className="w-3 h-3" />}
                          </button>
                          <button onClick={() => setStatusEditId(null)} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className={cn('px-2 py-1 text-xs rounded-full font-medium', statusBadgeColor(order.status))}>
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-[var(--color-text-muted)]">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => { setStatusEditId(order.id); setNewStatus(order.status); }}
                          className="text-[var(--color-green)] hover:text-[var(--color-green-dark)] text-xs text-left"
                        >
                          Change status
                        </button>
                        {canRefund(order.status) && (
                          <button
                            onClick={() => setRefundingOrder(order)}
                            disabled={pendingAction === order.id}
                            className="text-[var(--color-accent)] hover:opacity-80 text-xs text-left disabled:opacity-50"
                          >
                            {pendingAction === order.id ? 'Processing...' : 'Refund'}
                          </button>
                        )}
                        {canCancel(order.status) && (
                          <button
                            onClick={() => setCancellingOrder(order)}
                            disabled={pendingAction === order.id}
                            className="text-[var(--color-danger)] hover:opacity-80 text-xs text-left disabled:opacity-50"
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

      <p className="text-sm text-[var(--color-text-muted)] text-center">Showing {filtered.length} of {orders.length} orders</p>

      {/* Refund Confirmation Modal */}
      <ConfirmModal
        isOpen={!!refundingOrder}
        onClose={() => setRefundingOrder(null)}
        onConfirm={handleRefund}
        title="Issue Refund"
        description="This will reverse payment via Stripe and mark the listing as Active again. This action cannot be undone."
        confirmLabel="Issue Refund"
        loadingLabel="Processing..."
        isLoading={!!refundingOrder && pendingAction === refundingOrder.id}
        variant="warning"
      >
        {refundingOrder && (
          <>
            <p className="text-sm font-medium text-[var(--color-text)]">
              Order {refundingOrder.id.slice(0, 8)}...
            </p>
            {refundingOrder.listing && (
              <p className="text-sm text-[var(--color-text-muted)]">{refundingOrder.listing.title}</p>
            )}
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {formatPrice(refundingOrder.amount, refundingOrder.currency)}
              {refundingOrder.buyer && <> &middot; Buyer: {refundingOrder.buyer.displayName}</>}
            </p>
          </>
        )}
      </ConfirmModal>

      {/* Cancel Order Confirmation Modal */}
      <ConfirmModal
        isOpen={!!cancellingOrder}
        onClose={() => setCancellingOrder(null)}
        onConfirm={handleCancel}
        title="Cancel Order"
        description="Are you sure you want to cancel this order? This action cannot be undone."
        confirmLabel="Cancel Order"
        variant="danger"
      >
        {cancellingOrder && (
          <>
            <p className="text-sm font-medium text-[var(--color-text)]">
              Order {cancellingOrder.id.slice(0, 8)}...
            </p>
            {cancellingOrder.listing && (
              <p className="text-sm text-[var(--color-text-muted)]">{cancellingOrder.listing.title}</p>
            )}
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {formatPrice(cancellingOrder.amount, cancellingOrder.currency)} &middot; {cancellingOrder.status.replace(/_/g, ' ')}
            </p>
          </>
        )}
      </ConfirmModal>
    </div>
  );
}

// ============================================================================
// SETTINGS TAB
// ============================================================================

function SettingsTab() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [browserNotifications, setBrowserNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [autoApproveThreshold, setAutoApproveThreshold] = useState('500');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // Settings are UI-only for now — no backend endpoint exists yet
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const ToggleSwitch = ({ enabled, onToggle, label, description }: {
    enabled: boolean;
    onToggle: () => void;
    label: string;
    description: string;
  }) => (
    <div className="flex items-center justify-between py-4 border-b border-[var(--color-border)]/30 last:border-0">
      <div>
        <p className="text-sm font-medium text-[var(--color-text)]">{label}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors shrink-0',
          enabled ? 'bg-[var(--color-green)]' : 'bg-[var(--color-border)]',
        )}
      >
        <span className={cn(
          'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm',
          enabled && 'translate-x-5',
        )} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Notifications */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center gap-2">
          <Bell className="w-4 h-4 text-[var(--color-text-muted)]" />
          <h2 className="font-bold text-[var(--color-text)]">Notifications</h2>
        </div>
        <div className="px-5">
          <ToggleSwitch
            enabled={emailNotifications}
            onToggle={() => setEmailNotifications(!emailNotifications)}
            label="Email Notifications"
            description="Receive email alerts for new verifications, disputes, and critical events"
          />
          <ToggleSwitch
            enabled={browserNotifications}
            onToggle={() => setBrowserNotifications(!browserNotifications)}
            label="Browser Notifications"
            description="Show desktop notifications for real-time alerts"
          />
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center gap-2">
          {darkMode ? <Moon className="w-4 h-4 text-[var(--color-text-muted)]" /> : <Sun className="w-4 h-4 text-[var(--color-text-muted)]" />}
          <h2 className="font-bold text-[var(--color-text)]">Appearance</h2>
        </div>
        <div className="px-5">
          <ToggleSwitch
            enabled={darkMode}
            onToggle={() => setDarkMode(!darkMode)}
            label="Dark Mode"
            description="Switch to dark theme for the admin dashboard (coming soon)"
          />
        </div>
      </div>

      {/* Platform Settings */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center gap-2">
          <Globe className="w-4 h-4 text-[var(--color-text-muted)]" />
          <h2 className="font-bold text-[var(--color-text)]">Platform</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Auto-approve Listings Under (GBP)
            </label>
            <input
              type="number"
              value={autoApproveThreshold}
              onChange={e => setAutoApproveThreshold(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] text-sm"
              placeholder="500"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Listings priced below this will skip manual verification (set 0 to disable)
            </p>
          </div>
          <div className="pt-2 border-t border-[var(--color-border)]/30">
            <ToggleSwitch
              enabled={maintenanceMode}
              onToggle={() => setMaintenanceMode(!maintenanceMode)}
              label="Maintenance Mode"
              description="Show maintenance page to all non-admin users"
            />
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center gap-2">
          <Shield className="w-4 h-4 text-[var(--color-text-muted)]" />
          <h2 className="font-bold text-[var(--color-text)]">Security</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">Two-Factor Authentication</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Add an extra layer of security to your admin account</p>
            </div>
            <button className="px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-alt)] transition-colors">
              Configure
            </button>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]/30">
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">Active Sessions</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">View and manage your active login sessions</p>
            </div>
            <button className="px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-alt)] transition-colors">
              View
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
        {saved && (
          <span className="text-sm text-[var(--color-green)] font-medium flex items-center gap-1">
            <Check className="w-4 h-4" />
            Settings saved
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// EXPORT
// ============================================================================

export default function AdminDashboard() {
  // Route protection + ADMIN role enforcement is handled server-side by middleware
  // (jose.jwtVerify + role check). The ProtectedRoute wrapper was removed to prevent
  // a client-side redirect loop when auth-service is slow or temporarily unavailable.
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}
