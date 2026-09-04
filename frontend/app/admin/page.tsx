'use client';

import { useAuth } from '@/lib/auth-context';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { getBuyerProtectionFeePercent, getBuyerProtectionFeeRate } from '@/lib/fees';
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
  Check,
  XCircle,
  LogOut,
  RefreshCw,
  Server,
  Database,
  Shield,
  Bell,
  Globe,
  Save,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  RotateCcw,
  Sparkles,
  Layers,
  Smartphone,
  ChevronRight,
  Filter,
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
  AreaChart,
  Area,
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
  deviceType?: string;
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
  protectionFee?: number | null;
  shippingFee?: number | null;
  shippingService?: string | null;
  totalAmount?: number | null;
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

type TabId = 'dashboard' | 'verification' | 'listings' | 'orders' | 'users' | 'analytics' | 'health' | 'settings';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  details?: Record<string, unknown>;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function AdminDashboardContent() {
  const router = useRouter();
  const { user, authFetch, logout } = useAuth();
  const searchParams = useSearchParams();
  const validTabs: TabId[] = ['dashboard', 'verification', 'listings', 'orders', 'users', 'analytics', 'health', 'settings'];
  const initialTab = validTabs.includes(searchParams.get('tab') as TabId) ? (searchParams.get('tab') as TabId) : 'dashboard';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [userSearch, setUserSearch] = useState('');
  const [listingSearch, setListingSearch] = useState('');
  const [listingStatusFilter, setListingStatusFilter] = useState('ALL');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Refund modal state
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const withTimeout = <T,>(p: Promise<T>, ms = 10_000): Promise<T | null> =>
        Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

      const [usersRes, listingsRes, ordersRes, verRes] = await Promise.allSettled([
        withTimeout(authFetch('/api/admin/users')),
        withTimeout(authFetch('/api/admin/listings')),
        withTimeout(authFetch('/api/admin/orders?limit=100&enrich=true')),
        withTimeout(authFetch('/api/trust-lens?limit=1000')),
      ]);

      const settleOk = (r: PromiseSettledResult<Response | null>): Response | null =>
        r.status === 'fulfilled' ? r.value : null;

      const usersVal = settleOk(usersRes);
      if (usersVal?.ok) {
        const d = await usersVal.json();
        setUsers(Array.isArray(d) ? d : (d.data ?? []));
      }

      const listVal = settleOk(listingsRes);
      if (listVal?.ok) {
        const d = await listVal.json();
        setListings(Array.isArray(d) ? d : (d.data ?? []));
      }

      const ordVal = settleOk(ordersRes);
      if (ordVal?.ok) {
        const d = await ordVal.json();
        setOrders(Array.isArray(d.orders) ? d.orders : (Array.isArray(d) ? d : []));
      }

      const verVal = settleOk(verRes);
      if (verVal?.ok) {
        const d = await verVal.json();
        setVerifications(Array.isArray(d) ? d : (d.data ?? []));
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Sync tab with URL
  const handleTabClick = (tab: TabId) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    router.replace(`/admin?${params.toString()}`, { scroll: false });
  };

  // Verification review action
  const handleVerificationReview = async (id: string, action: 'PASSED' | 'FAILED') => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await authFetch(`/api/trust-lens/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action,
          reviewNotes: `Admin manual review marked as ${action}`,
        }),
      });
      if (!res.ok) throw new Error('Failed to update verification status');
      setActionMessage({ type: 'success', text: `Verification marked as ${action}` });
      await fetchAll();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Action failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // User role toggle
  const handleToggleUserRole = async (targetUser: User) => {
    const newRole = targetUser.role === 'ADMIN' ? 'USER' : 'ADMIN';
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await authFetch(`/api/admin/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('Failed to update user role');
      setActionMessage({ type: 'success', text: `User ${targetUser.name || targetUser.email} role updated to ${newRole}` });
      await fetchAll();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Role change failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Listing status change
  const handleUpdateListingStatus = async (listingId: string, newStatus: string) => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await authFetch(`/api/admin/listings/${listingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update listing status');
      setActionMessage({ type: 'success', text: `Listing status updated to ${newStatus}` });
      await fetchAll();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Status change failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Order refund action
  const handleExecuteRefund = async () => {
    if (!refundOrderId) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await authFetch(`/api/admin/orders/${refundOrderId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to process refund');
      setActionMessage({ type: 'success', text: `Order #${refundOrderId.substring(0, 8)} refunded successfully` });
      setRefundOrderId(null);
      await fetchAll();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Refund failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Metrics
  const activeListingsCount = listings.filter((l) => l.status === 'ACTIVE').length;
  const pendingVerifications = verifications.filter((v) => ['PENDING', 'IN_PROGRESS', 'REQUIRES_REVIEW'].includes(v.status));
  const totalRevenue = orders
    .filter((o) => ['COMPLETED', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);

  // Revenue chart by day
  const revenueMap = new Map<string, number>();
  orders.forEach((o) => {
    const key = new Date(o.createdAt).toISOString().split('T')[0];
    revenueMap.set(key, (revenueMap.get(key) || 0) + Number(o.amount || 0));
  });
  const revenueChartData = Array.from(revenueMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, revenue]) => ({
      date: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      revenue: Math.round(revenue),
    }));

  const navItems: { id: TabId; label: string; icon: any; count?: number; alert?: boolean }[] = [
    { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
    { id: 'verification', label: 'Verification Queue', icon: ClipboardCheck, count: pendingVerifications.length, alert: pendingVerifications.length > 0 },
    { id: 'listings', label: 'Listings Moderation', icon: Store, count: listings.length },
    { id: 'orders', label: 'Orders & Escrow', icon: Wallet, count: orders.length },
    { id: 'users', label: 'User Directory', icon: Users, count: users.length },
    { id: 'analytics', label: 'Platform Analytics', icon: BarChart3 },
    { id: 'health', label: 'System Health', icon: Activity },
    { id: 'settings', label: 'Platform Settings', icon: Settings },
  ];

  const filteredUsers = users.filter((u) => {
    const term = userSearch.toLowerCase();
    return !term || (u.name && u.name.toLowerCase().includes(term)) || (u.email && u.email.toLowerCase().includes(term));
  });

  const filteredListings = listings.filter((l) => {
    const matchesFilter = listingStatusFilter === 'ALL' || l.status === listingStatusFilter;
    const term = listingSearch.toLowerCase();
    const matchesSearch =
      !term ||
      (l.title && l.title.toLowerCase().includes(term)) ||
      (l.brand && l.brand.toLowerCase().includes(term)) ||
      (l.model && l.model.toLowerCase().includes(term));
    return matchesFilter && matchesSearch;
  });

  const filteredOrders = orders.filter((o) => {
    const matchesFilter = orderStatusFilter === 'ALL' || o.status === orderStatusFilter;
    const term = orderSearch.toLowerCase();
    const matchesSearch =
      !term ||
      o.id.toLowerCase().includes(term) ||
      (o.buyer?.displayName && o.buyer.displayName.toLowerCase().includes(term)) ||
      (o.seller?.displayName && o.seller.displayName.toLowerCase().includes(term));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-white">Veri<span className="text-emerald-400">Buy</span></span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30">ADMIN</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-neutral-900/95 border-r border-neutral-800 backdrop-blur-md p-6 flex flex-col justify-between transition-transform duration-200 md:translate-x-0 md:static',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div>
          {/* Logo */}
          <div className="hidden md:flex items-center justify-between mb-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-white">Veri<span className="text-emerald-400">Buy</span></span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30">ADMIN</span>
            </Link>
          </div>

          {/* Admin Tag */}
          <div className="bg-neutral-950/70 border border-neutral-800 rounded-2xl p-3.5 mb-6 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.name || 'Administrator'}</p>
              <span className="text-[11px] text-emerald-400">Superuser Access</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1.5" aria-label="Admin Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150',
                    isActive
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950 font-semibold'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-neutral-400')} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-mono font-bold',
                        item.alert
                          ? 'bg-red-500 text-white motion-safe:animate-pulse'
                          : isActive
                          ? 'bg-emerald-700 text-white'
                          : 'bg-neutral-800 text-neutral-300'
                      )}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-6 border-t border-neutral-800 space-y-2">
          <button
            onClick={() => fetchAll()}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'motion-safe:animate-spin')} /> Refresh Telemetry
          </button>
          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-neutral-800 text-xs transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Command Workspace */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        {/* Global Action Message */}
        {actionMessage && (
          <div
            role="status"
            className={cn(
              'p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 mb-6 border transition-all',
              actionMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            )}
          >
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Top Operations Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {activeTab === 'dashboard' && 'Operations Command Center'}
              {activeTab === 'verification' && 'Trust Lens™ Verification Queue'}
              {activeTab === 'listings' && 'Inventory Moderation'}
              {activeTab === 'orders' && 'Escrow & Transaction Desk'}
              {activeTab === 'users' && 'User & Identity Directory'}
              {activeTab === 'analytics' && 'Platform Analytics'}
              {activeTab === 'health' && 'System Health & Infrastructure'}
              {activeTab === 'settings' && 'Global Marketplace Settings'}
            </h1>
            <p className="text-neutral-400 text-sm mt-1">
              VeriBuy Central Operations &bull; PostgreSQL, Redis Cache, Carrier GSMA Registries
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
              API: 200 OK
            </div>
          </div>
        </div>

        {/* ─── TAB 1: COMMAND CENTER (OVERVIEW) ─── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
                <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-1">Total Platform GMV</span>
                <p className="text-2xl font-bold text-emerald-400">{formatPrice(totalRevenue, 'GBP')}</p>
                <span className="text-xs text-neutral-500 mt-2 block">{orders.length} total orders processed</span>
              </div>

              <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
                <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-1">Pending Verification</span>
                <p className="text-2xl font-bold text-amber-400">{pendingVerifications.length}</p>
                <button
                  onClick={() => setActiveTab('verification')}
                  className="text-xs text-emerald-400 hover:underline mt-2 inline-flex items-center gap-1"
                >
                  Review queue <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
                <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-1">Live Listings</span>
                <p className="text-2xl font-bold text-white">{activeListingsCount}</p>
                <span className="text-xs text-neutral-500 mt-2 block">{listings.length} total inventory</span>
              </div>

              <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
                <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-1">Registered Users</span>
                <p className="text-2xl font-bold text-white">{users.length}</p>
                <span className="text-xs text-emerald-400 mt-2 block">
                  {users.filter((u) => u.isEmailVerified).length} verified emails
                </span>
              </div>
            </div>

            {/* Revenue Trend Area Chart */}
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-white">Platform Transaction Volume</h3>
                  <p className="text-xs text-neutral-400">14-day trailing gross sales</p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="adminEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                    <XAxis dataKey="date" stroke="#737373" fontSize={11} />
                    <YAxis stroke="#737373" fontSize={11} tickFormatter={(v) => `£${v}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#171717',
                        borderColor: '#262626',
                        borderRadius: '12px',
                        color: '#fff',
                      }}
                      formatter={(val: any) => [`£${val}`, 'Gross Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#adminEmeraldGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Urgent Review Deck Preview */}
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-emerald-400" /> Pending Hardware Approvals
                </h3>
                <button
                  onClick={() => setActiveTab('verification')}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  View All ({pendingVerifications.length})
                </button>
              </div>

              {pendingVerifications.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  All Trust Lens™ verification checks are clear. Zero backlog.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingVerifications.slice(0, 3).map((v) => (
                    <div
                      key={v.id}
                      className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-neutral-400">Req #{v.id.substring(0, 8)}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {v.status}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-white">Listing: {v.listingId}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          disabled={actionLoading}
                          onClick={() => handleVerificationReview(v.id, 'PASSED')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-colors"
                        >
                          Approve Pass
                        </button>
                        <button
                          disabled={actionLoading}
                          onClick={() => handleVerificationReview(v.id, 'FAILED')}
                          className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-semibold text-xs rounded-xl transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: VERIFICATION QUEUE ─── */}
        {activeTab === 'verification' && (
          <div className="space-y-6">
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
              <h3 className="text-base font-bold text-white mb-1">Trust Lens™ Telemetry Queue</h3>
              <p className="text-xs text-neutral-400 mb-6">
                Automated carrier checks, blacklist scans, and manual reviews.
              </p>

              {verifications.length === 0 ? (
                <div className="text-center py-12 text-neutral-400 text-sm">
                  <ClipboardCheck className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                  No verification items found in queue.
                </div>
              ) : (
                <div className="space-y-4">
                  {verifications.map((v) => (
                    <div
                      key={v.id}
                      className="p-5 rounded-2xl bg-neutral-950/70 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-xs text-neutral-400">ID: {v.id.substring(0, 12)}</span>
                          <span
                            className={cn(
                              'px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                              v.status === 'PASSED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : v.status === 'FAILED'
                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            )}
                          >
                            {v.status}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-white">Listing Target: {v.listingId}</p>
                        {v.conditionGrade && (
                          <span className="text-xs text-neutral-400 block mt-1">
                            Condition: <strong className="text-white">{v.conditionGrade}</strong>
                          </span>
                        )}
                        {v.reviewNotes && (
                          <p className="text-xs text-neutral-400 mt-1 italic">{v.reviewNotes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 border-t md:border-t-0 border-neutral-800 pt-3 md:pt-0">
                        <Link
                          href={`/verification/${v.listingId}`}
                          className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs rounded-xl border border-neutral-700"
                        >
                          Certificate
                        </Link>
                        <button
                          disabled={actionLoading}
                          onClick={() => handleVerificationReview(v.id, 'PASSED')}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          disabled={actionLoading}
                          onClick={() => handleVerificationReview(v.id, 'FAILED')}
                          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: LISTINGS MODERATION ─── */}
        {activeTab === 'listings' && (
          <div className="space-y-6">
            {/* Filter toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                {['ALL', 'ACTIVE', 'UNDER_REVIEW', 'SOLD', 'REJECTED'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setListingStatusFilter(s)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors',
                      listingStatusFilter === s
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter listings..."
                  value={listingSearch}
                  onChange={(e) => setListingSearch(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 w-full sm:w-60"
                />
              </div>
            </div>

            {/* Listings table */}
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950/80 text-neutral-400 uppercase tracking-wider border-b border-neutral-800">
                    <tr>
                      <th className="py-4 px-6">Device</th>
                      <th className="py-4 px-6">Price</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6">Trust Lens</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {filteredListings.map((l) => (
                      <tr key={l.id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-4 px-6">
                          <p className="font-bold text-white text-sm">{l.title}</p>
                          <p className="text-neutral-400 text-xs">
                            {l.brand} &bull; {l.model}
                          </p>
                        </td>
                        <td className="py-4 px-6 font-bold text-emerald-400">
                          {formatPrice(l.price, l.currency)}
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
                            {l.status}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {l.trustLensStatus}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          <Link
                            href={`/listings/${l.id}`}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-lg border border-neutral-700 inline-block"
                          >
                            View
                          </Link>
                          {l.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleUpdateListingStatus(l.id, 'DELISTED')}
                              className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-semibold rounded-lg"
                            >
                              Delist
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateListingStatus(l.id, 'ACTIVE')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg"
                            >
                              Make Active
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 4: ORDERS & ESCROW ─── */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white">Escrow & Fulfillment Logs</h3>
                  <p className="text-xs text-neutral-400">All marketplace transactions and escrow disbursements</p>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by order ID or user..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950/80 text-neutral-400 uppercase tracking-wider border-b border-neutral-800">
                    <tr>
                      <th className="py-4 px-6">Order ID</th>
                      <th className="py-4 px-6">Buyer & Seller</th>
                      <th className="py-4 px-6">Amount</th>
                      <th className="py-4 px-6">Escrow Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-4 px-6 font-mono text-neutral-400">
                          #{o.id.substring(0, 10)}
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-white font-semibold">B: {o.buyer?.displayName || 'Buyer'}</p>
                          <p className="text-neutral-400">S: {o.seller?.displayName || 'Seller'}</p>
                        </td>
                        <td className="py-4 px-6 font-bold text-emerald-400">
                          {formatPrice(o.amount, o.currency)}
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
                            {o.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          <Link
                            href={`/orders/${o.id}/tracking`}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-lg border border-neutral-700 inline-block"
                          >
                            Timeline
                          </Link>
                          {['ESCROW_HELD', 'DISPUTED'].includes(o.status) && (
                            <button
                              onClick={() => setRefundOrderId(o.id)}
                              className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-semibold rounded-lg"
                            >
                              Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 5: USER DIRECTORY ─── */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white">Identity & Role Management</h3>
                  <p className="text-xs text-neutral-400">{users.length} total registered accounts</p>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950/80 text-neutral-400 uppercase tracking-wider border-b border-neutral-800">
                    <tr>
                      <th className="py-4 px-6">User</th>
                      <th className="py-4 px-6">Email</th>
                      <th className="py-4 px-6">Role</th>
                      <th className="py-4 px-6">Verification</th>
                      <th className="py-4 px-6 text-right">Role Toggle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-4 px-6 font-bold text-white">{u.name || 'Unnamed'}</td>
                        <td className="py-4 px-6 text-neutral-300 font-mono">{u.email}</td>
                        <td className="py-4 px-6">
                          <span
                            className={cn(
                              'px-2.5 py-1 rounded-full text-[11px] font-bold',
                              u.role === 'ADMIN'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-neutral-800 text-neutral-400'
                            )}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {u.isEmailVerified ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                            </span>
                          ) : (
                            <span className="text-neutral-500">Unverified</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            disabled={actionLoading}
                            onClick={() => handleToggleUserRole(u)}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold rounded-lg border border-neutral-700"
                          >
                            Switch to {u.role === 'ADMIN' ? 'USER' : 'ADMIN'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 6: ANALYTICS ─── */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
              <h3 className="text-base font-bold text-white mb-6">Gross Transaction Flow</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                    <XAxis dataKey="date" stroke="#737373" />
                    <YAxis stroke="#737373" tickFormatter={(v) => `£${v}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#171717',
                        borderColor: '#262626',
                        borderRadius: '12px',
                        color: '#fff',
                      }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 7: SYSTEM HEALTH ─── */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <h4 className="font-bold text-white text-sm">PostgreSQL 17</h4>
                </div>
                <p className="text-xs text-neutral-400">Connection pool healthy &bull; Latency: 4ms</p>
                <span className="inline-block mt-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Operational
                </span>
              </div>

              <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Server className="w-5 h-5 text-emerald-400" />
                  <h4 className="font-bold text-white text-sm">Redis Application State</h4>
                </div>
                <p className="text-xs text-neutral-400">Short-lived cache & sessions</p>
                <span className="inline-block mt-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Connected
                </span>
              </div>

              <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <h4 className="font-bold text-white text-sm">GSMA & Carrier APIs</h4>
                </div>
                <p className="text-xs text-neutral-400">Blacklist & IMEI verification gateway</p>
                <span className="inline-block mt-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Live Active
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 8: SETTINGS ─── */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Global Marketplace Parameters</h3>
              <p className="text-xs text-neutral-400">Configured runtime parameters</p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 space-y-2">
              <span className="text-xs text-neutral-400 uppercase tracking-wider block">Buyer Protection Rate</span>
              <p className="text-xl font-bold text-white">{getBuyerProtectionFeePercent()}% Dynamic Fee</p>
              <p className="text-xs text-neutral-500">
                Calculated dynamically via <code>getBuyerProtectionFeePercent()</code>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 space-y-2">
              <span className="text-xs text-neutral-400 uppercase tracking-wider block">Seller Commission Rate</span>
              <p className="text-xl font-bold text-emerald-400">0% (Promotional Standard)</p>
            </div>
          </div>
        )}
      </main>

      {/* Confirm Refund Modal */}
      {refundOrderId && (
        <ConfirmModal
          isOpen={!!refundOrderId}
          title="Confirm Escrow Refund"
          description={`Are you sure you want to refund order #${refundOrderId.substring(0, 8)}? This will return vaulted escrow funds to the buyer and cancel the transaction.`}
          confirmLabel={actionLoading ? 'Refunding...' : 'Confirm Refund'}
          cancelLabel="Cancel"
          isLoading={actionLoading}
          onConfirm={handleExecuteRefund}
          onClose={() => setRefundOrderId(null)}
        />
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
          <div className="motion-safe:animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent"></div>
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
