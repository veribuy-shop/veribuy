'use client';

import { useAuth } from '@/lib/auth-context';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { getBuyerProtectionFeePercent, setBuyerProtectionFeePercent } from '@/lib/fees';
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
  CheckCircle2,
  LogOut,
  RefreshCw,
  Server,
  Database,
  Shield,
  ShieldCheck,
  Layers,
  Lock,
  Package,
  CreditCard,
  Camera,
  Bell,
  Cpu,
  Save,
  AlertTriangle,
  ChevronRight,
  Sun,
  Moon,
  ArrowLeft,
  Percent,
  ExternalLink,
  Smartphone,
} from 'lucide-react';
import ConfirmModal from '@/components/confirm-modal';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
  sellerId?: string;
  title: string;
  deviceType?: string;
  brand: string;
  model: string;
  price: number;
  currency: string;
  status: string;
  trustLensStatus: string;
  conditionGrade: string | null;
  imageUrl?: string | null;
  images?: Array<{ id?: string; url: string }>;
  createdAt: string;
  publishedAt: string | null;
}

interface Order {
  id: string;
  listingId?: string | null;
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
  listing?: { id?: string; title: string; brand: string; model: string } | null;
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

type TabId = 'dashboard' | 'verification' | 'listings' | 'orders' | 'users' | 'analytics' | 'health' | 'settings';

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

function deduplicateOrders(orders: Order[]): Order[] {
  const groups = new Map<string, Order[]>();

  for (const order of orders) {
    const key =
      order.listingId ||
      order.listing?.id ||
      (order.listing?.title ? `title:${order.listing.title.trim().toLowerCase()}` : order.id);
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
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Data state
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

  // Health state
  const [healthData, setHealthData] = useState<any>(null);

  // Platform settings state
  const [feeRateInput, setFeeRateInput] = useState<number>(getBuyerProtectionFeePercent());
  const [feeSaveSuccess, setFeeSaveSuccess] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Refund modal state
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);

  // Load theme preference
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('veribuy_admin_theme');
      if (savedTheme === 'dark') {
        setIsDarkMode(true);
      }
    } catch {}
  }, []);

  const setThemeMode = (mode: 'light' | 'dark') => {
    const next = mode === 'dark';
    setIsDarkMode(next);
    try {
      localStorage.setItem('veribuy_admin_theme', mode);
    } catch {}
  };

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const withTimeout = <T,>(p: Promise<T>, ms = 10_000): Promise<T | null> =>
        Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

      const [usersRes, listingsRes, ordersRes, verRes, healthRes] = await Promise.allSettled([
        withTimeout(authFetch('/api/admin/users')),
        withTimeout(authFetch('/api/admin/listings?status=ALL&limit=100')),
        withTimeout(authFetch('/api/admin/orders?limit=100&enrich=true')),
        withTimeout(authFetch('/api/trust-lens?limit=1000')),
        withTimeout(authFetch('/api/admin/health')),
      ]);

      const settleOk = (r: PromiseSettledResult<Response | null>): Response | null =>
        r.status === 'fulfilled' ? r.value : null;

      const usersVal = settleOk(usersRes);
      if (usersVal?.ok) {
        const d = await usersVal.json();
        setUsers(Array.isArray(d) ? d : d.data ?? []);
      }

      const listVal = settleOk(listingsRes);
      if (listVal?.ok) {
        const d = await listVal.json();
        setListings(Array.isArray(d) ? d : d.data ?? []);
      }

      const ordVal = settleOk(ordersRes);
      if (ordVal?.ok) {
        const d = await ordVal.json();
        const rawOrders: Order[] = Array.isArray(d.orders) ? d.orders : Array.isArray(d) ? d : [];
        setOrders(deduplicateOrders(rawOrders));
      }

      const verVal = settleOk(verRes);
      if (verVal?.ok) {
        const d = await verVal.json();
        setVerifications(Array.isArray(d) ? d : d.data ?? []);
      }

      const healthVal = settleOk(healthRes);
      if (healthVal?.ok) {
        const d = await healthVal.json();
        setHealthData(d);
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

  const handleTabClick = (tab: TabId) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    router.replace(`/admin?${params.toString()}`, { scroll: false });
  };

  const handleSaveFeeSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setBuyerProtectionFeePercent(Number(feeRateInput));
    setFeeSaveSuccess(true);
    setTimeout(() => setFeeSaveSuccess(false), 3000);
  };

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

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to remove this unpaid order attempt and restore the listing to active queue?')) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to delete order');
      }
      setActionMessage({ type: 'success', text: `Order attempt #${orderId.substring(0, 8)} removed successfully` });
      await fetchAll();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete order' });
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
    let matchesFilter = true;
    if (listingStatusFilter === 'ALL') {
      matchesFilter = true;
    } else if (listingStatusFilter === 'UNDER_REVIEW') {
      matchesFilter = l.status === 'UNDER_REVIEW' || l.status === 'DRAFT';
    } else if (listingStatusFilter === 'INACTIVE') {
      matchesFilter = l.status === 'INACTIVE';
    } else if (listingStatusFilter === 'DELISTED') {
      matchesFilter = l.status === 'DELISTED' || l.status === 'REJECTED';
    } else {
      matchesFilter = l.status === listingStatusFilter;
    }
    const term = listingSearch.toLowerCase();
    const matchesSearch =
      !term ||
      (l.title && l.title.toLowerCase().includes(term)) ||
      (l.brand && l.brand.toLowerCase().includes(term)) ||
      (l.model && l.model.toLowerCase().includes(term)) ||
      (l.id && l.id.toLowerCase().includes(term)) ||
      (l.sellerId && l.sellerId.toLowerCase().includes(term));
    return matchesFilter && matchesSearch;
  });

  const filteredOrders = orders.filter((o) => {
    const matchesFilter =
      orderStatusFilter === 'ALL' ||
      (orderStatusFilter === 'PAID' && ['ESCROW_HELD', 'PAYMENT_RECEIVED', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(o.status)) ||
      (orderStatusFilter === 'PENDING' && o.status === 'PENDING') ||
      o.status === orderStatusFilter;
    const term = orderSearch.toLowerCase();
    const matchesSearch =
      !term ||
      o.id.toLowerCase().includes(term) ||
      (o.listingId && o.listingId.toLowerCase().includes(term)) ||
      (o.buyer?.displayName && o.buyer.displayName.toLowerCase().includes(term)) ||
      (o.seller?.displayName && o.seller.displayName.toLowerCase().includes(term));
    return matchesFilter && matchesSearch;
  });

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col md:flex-row transition-colors duration-150',
        isDarkMode ? 'bg-neutral-950 text-neutral-100' : 'bg-slate-50 text-slate-900'
      )}
    >
      {/* Mobile Top Header */}
      <div
        className={cn(
          'md:hidden flex items-center justify-between p-4 border-b',
          isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200'
        )}
      >
        <Link href="/" className="flex items-center gap-2">
          <BrandLogo />
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
            ADMIN
          </span>
        </Link>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={cn(
            'p-2 rounded-xl',
            isDarkMode ? 'bg-neutral-800 text-neutral-300' : 'bg-slate-100 text-slate-700'
          )}
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 border-r p-6 flex flex-col justify-between transition-transform duration-200 md:translate-x-0 md:static backdrop-blur-md',
          isDarkMode ? 'bg-neutral-900/95 border-neutral-800' : 'bg-white/95 border-slate-200 shadow-sm',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div>
          {/* Logo & Brand */}
          <div className="hidden md:flex items-center justify-between mb-6">
            <Link href="/" className="flex items-center gap-2" title="Back to Marketplace">
              <BrandLogo />
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                ADMIN
              </span>
            </Link>
          </div>

          {/* Back to Marketplace */}
          <Link
            href="/"
            className={cn(
              'w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold mb-5 border transition-all',
              isDarkMode
                ? 'bg-neutral-950 border-neutral-800 text-emerald-400 hover:bg-neutral-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            )}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Marketplace</span>
          </Link>

          {/* Admin Badge */}
          <div
            className={cn(
              'border rounded-2xl p-3.5 mb-6 flex items-center gap-3',
              isDarkMode ? 'bg-neutral-950/70 border-neutral-800' : 'bg-slate-50 border-slate-200'
            )}
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className={cn('text-xs font-bold truncate', isDarkMode ? 'text-white' : 'text-slate-900')}>
                {user?.name || 'Administrator'}
              </p>
              <span className="text-[11px] text-emerald-600 font-semibold">Superuser Access</span>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1" aria-label="Admin Navigation">
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
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-semibold'
                      : isDarkMode
                      ? 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn('w-4 h-4', isActive ? 'text-white' : isDarkMode ? 'text-neutral-400' : 'text-slate-500')} />
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
                          : isDarkMode
                          ? 'bg-neutral-800 text-neutral-300'
                          : 'bg-slate-200 text-slate-700'
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
        <div
          className={cn(
            'pt-6 border-t space-y-2',
            isDarkMode ? 'border-neutral-800' : 'border-slate-200'
          )}
        >
          <button
            onClick={() => fetchAll()}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold border transition-colors',
              isDarkMode
                ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm'
            )}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'motion-safe:animate-spin')} /> Refresh Telemetry
          </button>
          <button
            onClick={() => logout()}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs transition-colors',
              isDarkMode ? 'text-neutral-400 hover:text-red-400 hover:bg-neutral-800' : 'text-slate-500 hover:text-red-600 hover:bg-slate-100'
            )}
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
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50 border-red-200 text-red-700'
            )}
          >
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className={cn('text-2xl sm:text-3xl font-bold tracking-tight', isDarkMode ? 'text-white' : 'text-slate-900')}>
              {activeTab === 'dashboard' && 'Operations Command Center'}
              {activeTab === 'verification' && 'Trust Lens™ Verification Queue'}
              {activeTab === 'listings' && 'Inventory Moderation'}
              {activeTab === 'orders' && 'Escrow & Transaction Desk'}
              {activeTab === 'users' && 'User & Identity Directory'}
              {activeTab === 'analytics' && 'Platform Analytics'}
              {activeTab === 'health' && 'System Health & Infrastructure'}
              {activeTab === 'settings' && 'Global Marketplace Settings'}
            </h1>
            <p className={cn('text-sm mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
              VeriBuy Operations &bull; Core Monolith API, PostgreSQL 17, Redis Cache & Escrow Engine
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={cn(
                'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono font-semibold',
                isDarkMode ? 'bg-neutral-900 border-neutral-800 text-neutral-300' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
              )}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
              API: 200 OK
            </div>
          </div>
        </div>

        {/* ─── TAB 1: COMMAND CENTER (OVERVIEW) ─── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                className={cn(
                  'border rounded-3xl p-6 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <span className={cn('text-xs uppercase tracking-wider block mb-1 font-semibold', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Total Platform GMV
                </span>
                <p className="text-2xl font-bold text-emerald-600">{formatPrice(totalRevenue, 'GBP')}</p>
                <span className={cn('text-xs mt-2 block', isDarkMode ? 'text-neutral-500' : 'text-slate-500')}>
                  {orders.length} unique active orders
                </span>
              </div>

              <div
                className={cn(
                  'border rounded-3xl p-6 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <span className={cn('text-xs uppercase tracking-wider block mb-1 font-semibold', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Pending Verification
                </span>
                <p className="text-2xl font-bold text-amber-600">{pendingVerifications.length}</p>
                <button
                  onClick={() => setActiveTab('verification')}
                  className="text-xs text-emerald-600 hover:underline mt-2 inline-flex items-center gap-1 font-semibold"
                >
                  Review queue <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div
                className={cn(
                  'border rounded-3xl p-6 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <span className={cn('text-xs uppercase tracking-wider block mb-1 font-semibold', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Live Listings
                </span>
                <p className={cn('text-2xl font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>{activeListingsCount}</p>
                <span className={cn('text-xs mt-2 block', isDarkMode ? 'text-neutral-500' : 'text-slate-500')}>
                  {listings.length} total catalog items
                </span>
              </div>

              <div
                className={cn(
                  'border rounded-3xl p-6 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <span className={cn('text-xs uppercase tracking-wider block mb-1 font-semibold', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Registered Accounts
                </span>
                <p className={cn('text-2xl font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>{users.length}</p>
                <span className="text-xs text-emerald-600 font-semibold mt-2 block">
                  {users.filter((u) => u.isEmailVerified).length} verified emails
                </span>
              </div>
            </div>

            {/* Revenue Trend Area Chart */}
            <div
              className={cn(
                'border rounded-3xl p-6 shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className={cn('text-base font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                    Platform Transaction Volume
                  </h3>
                  <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    14-day trailing gross sales
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="adminEmeraldGradLight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#262626' : '#f1f5f9'} />
                    <XAxis dataKey="date" stroke={isDarkMode ? '#737373' : '#94a3b8'} fontSize={11} />
                    <YAxis stroke={isDarkMode ? '#737373' : '#94a3b8'} tickFormatter={(v) => `£${v}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDarkMode ? '#171717' : '#ffffff',
                        borderColor: isDarkMode ? '#262626' : '#e2e8f0',
                        borderRadius: '12px',
                        color: isDarkMode ? '#fff' : '#0f172a',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                      }}
                      formatter={(val: any) => [`£${val}`, 'Gross Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2.5} fill="url(#adminEmeraldGradLight)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Verification Queue Preview */}
            <div
              className={cn(
                'border rounded-3xl p-6 shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={cn('text-base font-bold flex items-center gap-2', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  <ClipboardCheck className="w-5 h-5 text-emerald-600" /> Pending Hardware Approvals
                </h3>
                <button
                  onClick={() => setActiveTab('verification')}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                >
                  View All ({pendingVerifications.length})
                </button>
              </div>

              {pendingVerifications.length === 0 ? (
                <div className={cn('text-center py-8 text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  All Trust Lens™ verification checks are clear. Zero backlog.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingVerifications.slice(0, 3).map((v) => (
                    <div
                      key={v.id}
                      className={cn(
                        'p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                        isDarkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn('font-mono text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                            Req #{v.id.substring(0, 8)}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            {v.status}
                          </span>
                        </div>
                        <p className={cn('text-sm font-semibold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                          Listing Target: {v.listingId}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          disabled={actionLoading}
                          onClick={() => handleVerificationReview(v.id, 'PASSED')}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
                        >
                          Approve Pass
                        </button>
                        <button
                          disabled={actionLoading}
                          onClick={() => handleVerificationReview(v.id, 'FAILED')}
                          className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-xs rounded-xl transition-colors"
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
            <div
              className={cn(
                'border rounded-3xl p-6 shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <h3 className={cn('text-base font-bold mb-1', isDarkMode ? 'text-white' : 'text-slate-900')}>
                Trust Lens™ Telemetry Queue
              </h3>
              <p className={cn('text-xs mb-6', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                Automated carrier checks, blacklist scans, and manual reviews.
              </p>

              {verifications.length === 0 ? (
                <div className={cn('text-center py-12 text-sm', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  <ClipboardCheck className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  No verification items found in queue.
                </div>
              ) : (
                <div className="space-y-4">
                  {verifications.map((v) => (
                    <div
                      key={v.id}
                      className={cn(
                        'p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4',
                        isDarkMode ? 'bg-neutral-950/70 border-neutral-800' : 'bg-slate-50 border-slate-200'
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn('font-mono text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                            ID: {v.id.substring(0, 12)}
                          </span>
                          <span
                            className={cn(
                              'px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                              v.status === 'PASSED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : v.status === 'FAILED'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            )}
                          >
                            {v.status}
                          </span>
                        </div>
                        <p className={cn('text-sm font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                          Listing Target: {v.listingId}
                        </p>
                        {v.conditionGrade && (
                          <span className={cn('text-xs block mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                            Condition: <strong className={isDarkMode ? 'text-white' : 'text-slate-800'}>{v.conditionGrade}</strong>
                          </span>
                        )}
                        {v.reviewNotes && (
                          <p className={cn('text-xs mt-1 italic', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>{v.reviewNotes}</p>
                        )}
                      </div>

                      <div className={cn('flex items-center gap-3 border-t md:border-t-0 pt-3 md:pt-0', isDarkMode ? 'border-neutral-800' : 'border-slate-200')}>
                        <Link
                          href={`/verification/${v.listingId}`}
                          className={cn(
                            'px-3.5 py-2 font-semibold text-xs rounded-xl border transition-colors',
                            isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-300' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
                          )}
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
            <div
              className={cn(
                'border rounded-3xl overflow-hidden shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              {/* Card Header with total count & search */}
              <div
                className={cn(
                  'p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4',
                  isDarkMode ? 'border-neutral-800' : 'border-slate-200'
                )}
              >
                <div>
                  <h3 className={cn('text-base font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                    Catalog & Inventory Moderation
                  </h3>
                  <p className={cn('text-xs mt-0.5', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Showing marketplace listings ({listings.length} total) across all lifecycle statuses
                  </p>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by title, brand, model, ID..."
                    value={listingSearch}
                    onChange={(e) => setListingSearch(e.target.value)}
                    className={cn(
                      'border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-emerald-500 w-full sm:w-72 transition-colors',
                      isDarkMode
                        ? 'bg-neutral-950 border-neutral-800 text-white placeholder-neutral-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                    )}
                  />
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div
                className={cn(
                  'px-6 py-3 border-b flex items-center gap-2 overflow-x-auto scrollbar-none',
                  isDarkMode ? 'bg-neutral-950/40 border-neutral-800' : 'bg-slate-50/70 border-slate-200'
                )}
              >
                {[
                  { id: 'ALL', label: 'All Listings', count: listings.length },
                  { id: 'ACTIVE', label: 'Active', count: listings.filter((l) => l.status === 'ACTIVE').length },
                  { id: 'UNDER_REVIEW', label: 'Under Review', count: listings.filter((l) => l.status === 'UNDER_REVIEW' || l.status === 'DRAFT').length },
                  { id: 'INACTIVE', label: 'In Checkout / Reserved', count: listings.filter((l) => l.status === 'INACTIVE').length },
                  { id: 'SOLD', label: 'Sold', count: listings.filter((l) => l.status === 'SOLD').length },
                  { id: 'DELISTED', label: 'Delisted / Suspended', count: listings.filter((l) => l.status === 'DELISTED' || l.status === 'REJECTED').length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setListingStatusFilter(tab.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5',
                      listingStatusFilter === tab.id
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : isDarkMode
                        ? 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80 shadow-xs'
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        'px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold',
                        listingStatusFilter === tab.id
                          ? 'bg-emerald-700/80 text-white'
                          : isDarkMode
                          ? 'bg-neutral-900 text-neutral-400'
                          : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Table or Empty State */}
              {filteredListings.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center border',
                      isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-400' : 'bg-slate-100 border-slate-200 text-slate-400'
                    )}
                  >
                    <Package className="w-6 h-6" />
                  </div>
                  <h4 className={cn('text-sm font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                    No listings found
                  </h4>
                  <p className={cn('text-xs max-w-sm mx-auto mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    {listingSearch
                      ? `No marketplace items matched "${listingSearch}". Try searching by another keyword.`
                      : 'No marketplace items currently match this status filter.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead
                      className={cn(
                        'uppercase tracking-wider border-b',
                        isDarkMode ? 'bg-neutral-950/80 text-neutral-400 border-neutral-800' : 'bg-slate-50 text-slate-500 border-slate-200'
                      )}
                    >
                      <tr>
                        <th className="py-4 px-6">Product / Device</th>
                        <th className="py-4 px-6">Price</th>
                        <th className="py-4 px-6">Condition</th>
                        <th className="py-4 px-6">Listing Status</th>
                        <th className="py-4 px-6">Trust Lens™</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={cn('divide-y', isDarkMode ? 'divide-neutral-800' : 'divide-slate-200')}>
                      {filteredListings.map((l) => {
                        const coverImg = l.imageUrl || (Array.isArray(l.images) && l.images[0]?.url) || null;
                        const isLive = l.status === 'ACTIVE';
                        const isReserved = l.status === 'INACTIVE';
                        const isSold = l.status === 'SOLD';
                        const isUnderReview = l.status === 'UNDER_REVIEW' || l.status === 'DRAFT';
                        const isDelisted = l.status === 'DELISTED' || l.status === 'REJECTED';

                        return (
                          <tr
                            key={l.id}
                            className={cn('transition-colors', isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-slate-50')}
                          >
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3.5">
                                <div
                                  className={cn(
                                    'w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden border shrink-0',
                                    isDarkMode ? 'bg-neutral-950 border-neutral-800 text-neutral-500' : 'bg-slate-100 border-slate-200 text-slate-400'
                                  )}
                                >
                                  {coverImg ? (
                                    <img src={coverImg} alt={l.title} className="w-full h-full object-cover" />
                                  ) : (
                                    <Smartphone className="w-5 h-5" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <Link
                                    href={`/listings/${l.id}`}
                                    className={cn('font-bold text-sm hover:underline line-clamp-1', isDarkMode ? 'text-white' : 'text-slate-900')}
                                  >
                                    {l.title}
                                  </Link>
                                  <p className={cn('text-xs mt-0.5', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                                    {l.brand} &bull; {l.model}
                                  </p>
                                  <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                                    ID: {l.id.slice(0, 8)}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-6 font-bold text-emerald-600 text-sm whitespace-nowrap">
                              {formatPrice(l.price, l.currency || 'GBP')}
                            </td>

                            <td className="py-4 px-6 whitespace-nowrap">
                              {l.conditionGrade ? (
                                <span
                                  className={cn(
                                    'px-2.5 py-1 rounded-lg text-[11px] font-semibold border',
                                    isDarkMode ? 'bg-neutral-800 text-neutral-300 border-neutral-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                                  )}
                                >
                                  {l.conditionGrade}
                                </span>
                              ) : (
                                <span className="text-neutral-400 text-xs">—</span>
                              )}
                            </td>

                            <td className="py-4 px-6 whitespace-nowrap">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border',
                                  isLive && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                  isReserved && 'bg-amber-50 text-amber-700 border-amber-200',
                                  isSold && 'bg-purple-50 text-purple-700 border-purple-200',
                                  isUnderReview && 'bg-sky-50 text-sky-700 border-sky-200',
                                  isDelisted && 'bg-red-50 text-red-700 border-red-200'
                                )}
                              >
                                <span
                                  className={cn(
                                    'w-1.5 h-1.5 rounded-full',
                                    isLive && 'bg-emerald-500',
                                    isReserved && 'bg-amber-500',
                                    isSold && 'bg-purple-500',
                                    isUnderReview && 'bg-sky-500',
                                    isDelisted && 'bg-red-500'
                                  )}
                                />
                                {isReserved
                                  ? 'In Checkout'
                                  : isUnderReview
                                  ? 'Under Review'
                                  : isDelisted
                                  ? 'Delisted'
                                  : l.status}
                              </span>
                            </td>

                            <td className="py-4 px-6 whitespace-nowrap">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border',
                                  l.trustLensStatus === 'VERIFIED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : l.trustLensStatus === 'FLAGGED' || l.trustLensStatus === 'REJECTED'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                )}
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                {l.trustLensStatus || 'PENDING'}
                              </span>
                            </td>

                            <td className="py-4 px-6 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <Link
                                  href={`/listings/${l.id}`}
                                  target="_blank"
                                  className={cn(
                                    'px-2.5 py-1.5 font-semibold rounded-lg border inline-flex items-center gap-1 text-xs transition-colors shadow-xs',
                                    isDarkMode
                                      ? 'bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                  )}
                                >
                                  <span>View</span>
                                  <ExternalLink className="w-3 h-3 text-slate-400" />
                                </Link>

                                {isLive ? (
                                  <button
                                    onClick={() => handleUpdateListingStatus(l.id, 'DELISTED')}
                                    disabled={actionLoading}
                                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold rounded-lg text-xs transition-colors disabled:opacity-50"
                                    title="Delist from marketplace"
                                  >
                                    Delist
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleUpdateListingStatus(l.id, 'ACTIVE')}
                                    disabled={actionLoading}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors disabled:opacity-50"
                                    title="Reactivate on marketplace"
                                  >
                                    Activate
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 4: ORDERS & ESCROW ─── */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div
              className={cn(
                'border rounded-3xl overflow-hidden shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <div className={cn('p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4', isDarkMode ? 'border-neutral-800' : 'border-slate-200')}>
                <div>
                  <h3 className={cn('text-base font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                    Escrow & Transaction Desk
                  </h3>
                  <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Showing active order records ({orders.length} total)
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className={cn(
                      'border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500',
                      isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    )}
                  >
                    <option value="ALL">All Orders</option>
                    <option value="PAID">Paid / In Escrow Only</option>
                    <option value="PENDING">Unpaid Attempts Only</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="DISPUTED">Disputed</option>
                  </select>

                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search order ID / user..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className={cn(
                        'border rounded-xl pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:border-emerald-500',
                        isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className={cn('uppercase tracking-wider border-b', isDarkMode ? 'bg-neutral-950/80 text-neutral-400 border-neutral-800' : 'bg-slate-50 text-slate-500 border-slate-200')}>
                    <tr>
                      <th className="py-4 px-6">Order ID</th>
                      <th className="py-4 px-6">Listing Target</th>
                      <th className="py-4 px-6">Buyer & Seller</th>
                      <th className="py-4 px-6">Amount</th>
                      <th className="py-4 px-6">Escrow Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={cn('divide-y', isDarkMode ? 'divide-neutral-800' : 'divide-slate-200')}>
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className={cn('transition-colors', isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-slate-50')}>
                        <td className={cn('py-4 px-6 font-mono font-semibold', isDarkMode ? 'text-neutral-400' : 'text-slate-600')}>
                          #{o.id.substring(0, 8)}
                        </td>
                        <td className="py-4 px-6">
                          <p className={cn('font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                            {o.listing?.title || 'Electronics Listing'}
                          </p>
                          <span className={cn('font-mono text-[10px]', isDarkMode ? 'text-neutral-500' : 'text-slate-400')}>
                            Listing ID: {o.listingId ? o.listingId.substring(0, 8) : 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider', isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-700 border border-blue-200')}>
                                Buyer
                              </span>
                              <span className={cn('font-semibold text-xs truncate max-w-[140px]', isDarkMode ? 'text-white' : 'text-slate-900')}>
                                {o.buyer?.displayName || (o.buyer?.email ? o.buyer.email.split('@')[0] : 'Buyer User')}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider', isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700 border border-emerald-200')}>
                                Seller
                              </span>
                              <span className={cn('text-xs truncate max-w-[140px]', isDarkMode ? 'text-neutral-400' : 'text-slate-600')}>
                                {o.seller?.displayName || (o.seller?.email ? o.seller.email.split('@')[0] : 'Seller User')}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 font-bold text-emerald-600">
                          {formatPrice(o.amount, o.currency)}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={cn(
                              'px-2.5 py-1 rounded-full text-[11px] font-semibold border',
                              o.status === 'PENDING'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : ['ESCROW_HELD', 'COMPLETED', 'DELIVERED'].includes(o.status)
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isDarkMode
                                ? 'bg-neutral-800 text-neutral-300 border-neutral-700'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            )}
                          >
                            {o.status === 'PENDING' ? 'Unpaid Attempt' : o.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          <Link
                            href={`/orders/${o.id}/tracking`}
                            className={cn(
                              'px-3 py-1.5 font-semibold rounded-lg border inline-block shadow-sm',
                              isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-200' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            )}
                          >
                            Timeline
                          </Link>
                          {['ESCROW_HELD', 'DISPUTED'].includes(o.status) && (
                            <button
                              onClick={() => setRefundOrderId(o.id)}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold rounded-lg"
                            >
                              Refund
                            </button>
                          )}
                          {['PENDING', 'CANCELLED'].includes(o.status) && (
                            <button
                              onClick={() => handleDeleteOrder(o.id)}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold rounded-lg"
                            >
                              Delete Attempt
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
            <div
              className={cn(
                'border rounded-3xl overflow-hidden shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <div className={cn('p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4', isDarkMode ? 'border-neutral-800' : 'border-slate-200')}>
                <div>
                  <h3 className={cn('text-base font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                    Identity & Role Management
                  </h3>
                  <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    {users.length} total registered users
                  </p>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className={cn(
                      'border rounded-xl pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:border-emerald-500',
                      isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    )}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className={cn('uppercase tracking-wider border-b', isDarkMode ? 'bg-neutral-950/80 text-neutral-400 border-neutral-800' : 'bg-slate-50 text-slate-500 border-slate-200')}>
                    <tr>
                      <th className="py-4 px-6">User</th>
                      <th className="py-4 px-6">Email</th>
                      <th className="py-4 px-6">Role</th>
                      <th className="py-4 px-6">Email Verification</th>
                      <th className="py-4 px-6 text-right">Role Toggle</th>
                    </tr>
                  </thead>
                  <tbody className={cn('divide-y', isDarkMode ? 'divide-neutral-800' : 'divide-slate-200')}>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className={cn('transition-colors', isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-slate-50')}>
                        <td className={cn('py-4 px-6 font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>{u.name || 'Unnamed'}</td>
                        <td className={cn('py-4 px-6 font-mono', isDarkMode ? 'text-neutral-300' : 'text-slate-700')}>{u.email}</td>
                        <td className="py-4 px-6">
                          <span
                            className={cn(
                              'px-2.5 py-1 rounded-full text-[11px] font-bold border',
                              u.role === 'ADMIN'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isDarkMode
                                ? 'bg-neutral-800 text-neutral-400 border-neutral-700'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            )}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {u.isEmailVerified ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                            </span>
                          ) : (
                            <span className={cn('text-xs', isDarkMode ? 'text-neutral-500' : 'text-slate-400')}>Unverified</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            disabled={actionLoading}
                            onClick={() => handleToggleUserRole(u)}
                            className={cn(
                              'px-3 py-1.5 font-semibold rounded-lg border shadow-sm transition-colors',
                              isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                            )}
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
            <div
              className={cn(
                'border rounded-3xl p-6 shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <h3 className={cn('text-base font-bold mb-6', isDarkMode ? 'text-white' : 'text-slate-900')}>
                Gross Platform Transaction Flow
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#262626' : '#f1f5f9'} />
                    <XAxis dataKey="date" stroke={isDarkMode ? '#737373' : '#94a3b8'} />
                    <YAxis stroke={isDarkMode ? '#737373' : '#94a3b8'} tickFormatter={(v) => `£${v}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDarkMode ? '#171717' : '#ffffff',
                        borderColor: isDarkMode ? '#262626' : '#e2e8f0',
                        borderRadius: '12px',
                        color: isDarkMode ? '#fff' : '#0f172a',
                      }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#059669" fill="#059669" fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 7: SYSTEM HEALTH & BACKEND APIS ─── */}
        {activeTab === 'health' && (
          <div className="space-y-8">
            {/* Top Status & Architecture Summary */}
            <div
              className={cn(
                'border rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
                  <span className={cn('text-xs font-bold uppercase tracking-wider', isDarkMode ? 'text-emerald-400' : 'text-emerald-700')}>
                    Modular Monolith Architecture
                  </span>
                </div>
                <h3 className={cn('text-xl font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  VeriBuy Core Backend & Infrastructure
                </h3>
                <p className={cn('text-xs mt-1.5 max-w-xl leading-relaxed', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  One NestJS monolith deployment powering all internal business modules with PostgreSQL 17 logical schemas, Redis session cache, and Cloudinary media vault.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => fetchAll()}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors',
                    isDarkMode
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                  Run Diagnostics
                </button>
              </div>
            </div>

            {/* Core Infrastructure Engines */}
            <div>
              <h4 className={cn('text-sm font-bold uppercase tracking-wider mb-4', isDarkMode ? 'text-neutral-400' : 'text-slate-600')}>
                Core Infrastructure & Data Engines
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div
                  className={cn(
                    'border rounded-3xl p-6 shadow-sm',
                    isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className={cn('font-bold text-sm', isDarkMode ? 'text-white' : 'text-slate-900')}>
                          Backend Monolith API
                        </h5>
                        <p className={cn('text-[11px] font-mono', isDarkMode ? 'text-neutral-500' : 'text-slate-400')}>
                          NestJS 11 &bull; Port 3000
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className={cn('text-xs leading-relaxed', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Single process HTTP server serving REST endpoints, Swagger docs, and internal event emitters.
                  </p>
                  <div className="mt-4 pt-3 border-t flex items-center justify-between border-slate-100 dark:border-neutral-800">
                    <span className="text-[11px] font-mono text-slate-400">/health check</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Operational
                    </span>
                  </div>
                </div>

                <div
                  className={cn(
                    'border rounded-3xl p-6 shadow-sm',
                    isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className={cn('font-bold text-sm', isDarkMode ? 'text-white' : 'text-slate-900')}>
                          PostgreSQL 17 Database
                        </h5>
                        <p className={cn('text-[11px] font-mono', isDarkMode ? 'text-neutral-500' : 'text-slate-400')}>
                          Logical Schemas &bull; Prisma 7
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className={cn('text-xs leading-relaxed', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Logical schemas for auth, users, listings, trust_lens, evidence, transactions, and notifications.
                  </p>
                  <div className="mt-4 pt-3 border-t flex items-center justify-between border-slate-100 dark:border-neutral-800">
                    <span className="text-[11px] font-mono text-slate-400">Connection Pool</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Operational
                    </span>
                  </div>
                </div>

                <div
                  className={cn(
                    'border rounded-3xl p-6 shadow-sm',
                    isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className={cn('font-bold text-sm', isDarkMode ? 'text-white' : 'text-slate-900')}>
                          Redis Cache & State
                        </h5>
                        <p className={cn('text-[11px] font-mono', isDarkMode ? 'text-neutral-500' : 'text-slate-400')}>
                          In-Memory Store &bull; Port 6379
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className={cn('text-xs leading-relaxed', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Token blacklisting, short-lived session states, rate limiting, and cached user profile data.
                  </p>
                  <div className="mt-4 pt-3 border-t flex items-center justify-between border-slate-100 dark:border-neutral-800">
                    <span className="text-[11px] font-mono text-slate-400">Session Vault</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Connected
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Backend Business Modules */}
            <div>
              <h4 className={cn('text-sm font-bold uppercase tracking-wider mb-4', isDarkMode ? 'text-neutral-400' : 'text-slate-600')}>
                Backend Business API Modules
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* 1. Auth API */}
                <div
                  className={cn(
                    'border rounded-3xl p-5 shadow-sm space-y-3',
                    isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <h6 className={cn('font-bold text-xs', isDarkMode ? 'text-white' : 'text-slate-900')}>
                          Auth & Identity API
                        </h6>
                        <span className="font-mono text-[10px] text-slate-400">/auth</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Live
                    </span>
                  </div>
                  <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    JWT authentication, password hashing (argon2/bcrypt), role-based access control, and secure cookie sessions.
                  </p>
                </div>

                {/* 2. Users API */}
                <div
                  className={cn(
                    'border rounded-3xl p-5 shadow-sm space-y-3',
                    isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h6 className={cn('font-bold text-xs', isDarkMode ? 'text-white' : 'text-slate-900')}>
                          Users & Profiles API
                        </h6>
                        <span className="font-mono text-[10px] text-slate-400">/users</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Live
                    </span>
                  </div>
                  <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    User accounts, buyer/seller profiles, address verification, and seller trust ratings.
                  </p>
                </div>

                {/* 3. Listings API */}
                <div
                  className={cn(
                    'border rounded-3xl p-5 shadow-sm space-y-3',
                    isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <h6 className={cn('font-bold text-xs', isDarkMode ? 'text-white' : 'text-slate-900')}>
                          Listings & Catalog API
                        </h6>
                        <span className="font-mono text-[10px] text-slate-400">/listings</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Live
                    </span>
                  </div>
                  <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Electronics catalog inventory, categorization, price configuration, moderation status, and search filters.
                  </p>
                </div>

                {/* 4. Trust Lens API */}
                <div
                  className={cn(
                    'border rounded-3xl p-5 shadow-sm space-y-3',
                    isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h6 className={cn('font-bold text-xs', isDarkMode ? 'text-white' : 'text-slate-900')}>
                          Trust Lens™ Verification API
                        </h6>
                        <span className="font-mono text-[10px] text-slate-400">/trust-lens</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Live
                    </span>
                  </div>
                  <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Hardware integrity checks, IMEI blacklist validation, optical condition grading, and tamper certificates.
                  </p>
                </div>

                {/* 5. Transactions API */}
                <div
                  className={cn(
                    'border rounded-3xl p-5 shadow-sm space-y-3',
                    isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-xs">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <h6 className={cn('font-bold text-xs', isDarkMode ? 'text-white' : 'text-slate-900')}>
                          Transactions & Escrow API
                        </h6>
                        <span className="font-mono text-[10px] text-slate-400">/transactions</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Live
                    </span>
                  </div>
                  <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Stripe PaymentIntents, Escrow vaulting, delivery inspection confirmations, automatic refunding, and seller payouts.
                  </p>
                </div>

                {/* 6. Evidence API */}
                <div
                  className={cn(
                    'border rounded-3xl p-5 shadow-sm space-y-3',
                    isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold text-xs">
                        <Camera className="w-4 h-4" />
                      </div>
                      <div>
                        <h6 className={cn('font-bold text-xs', isDarkMode ? 'text-white' : 'text-slate-900')}>
                          Evidence Vault API
                        </h6>
                        <span className="font-mono text-[10px] text-slate-400">/evidence</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Live
                    </span>
                  </div>
                  <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Cloudinary media assets, high-resolution device photo uploads, optical certificates, and dispute evidence logs.
                  </p>
                </div>

                {/* 7. Notifications API */}
                <div
                  className={cn(
                    'border rounded-3xl p-5 shadow-sm space-y-3 sm:col-span-2 lg:col-span-1',
                    isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold text-xs">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <h6 className={cn('font-bold text-xs', isDarkMode ? 'text-white' : 'text-slate-900')}>
                          Notifications & Messaging API
                        </h6>
                        <span className="font-mono text-[10px] text-slate-400">/messages</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Live
                    </span>
                  </div>
                  <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Buyer & seller messaging, transaction milestone notifications, courier status events, and transactional emails.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 8: SETTINGS, THEME TOGGLE & DYNAMIC FEE CONFIGURATION ─── */}
        {activeTab === 'settings' && (
          <div
            className={cn(
              'max-w-2xl border rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm',
              isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
            )}
          >
            <div>
              <h3 className={cn('text-lg font-bold mb-1', isDarkMode ? 'text-white' : 'text-slate-900')}>
                Platform & Interface Settings
              </h3>
              <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                Configure the dynamic Buyer Protection Fee rate and dashboard display theme.
              </p>
            </div>

            {/* Dashboard Theme Mode Preference */}
            <div
              className={cn(
                'p-5 rounded-2xl border space-y-3',
                isDarkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
              )}
            >
              <div>
                <label className={cn('text-sm font-bold block', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  Dashboard Appearance Theme
                </label>
                <p className={cn('text-xs mt-0.5', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Select the display theme for the Admin operations console.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={cn(
                    'p-4 rounded-xl border flex items-center justify-center gap-2 font-semibold text-xs transition-all',
                    !isDarkMode
                      ? 'bg-white border-emerald-600 text-emerald-700 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-white'
                  )}
                >
                  <Sun className="w-4 h-4 text-amber-500" /> Light Mode (Default)
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={cn(
                    'p-4 rounded-xl border flex items-center justify-center gap-2 font-semibold text-xs transition-all',
                    isDarkMode
                      ? 'bg-neutral-900 border-emerald-500 text-emerald-400 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                  )}
                >
                  <Moon className="w-4 h-4 text-purple-500" /> Dark Mode
                </button>
              </div>
            </div>

            {feeSaveSuccess && (
              <div role="status" className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Buyer Protection Fee rate updated successfully! All checkout calculations updated.</span>
              </div>
            )}

            {/* Fee Setting Form */}
            <form onSubmit={handleSaveFeeSettings} className="space-y-4">
              <div
                className={cn(
                  'p-5 rounded-2xl border space-y-3',
                  isDarkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <label className={cn('text-sm font-bold block', isDarkMode ? 'text-white' : 'text-slate-900')}>
                      Buyer Protection Fee Percentage
                    </label>
                    <p className={cn('text-xs mt-0.5', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                      Configured dynamic rate applied to checkouts in real-time.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={feeRateInput}
                      onChange={(e) => setFeeRateInput(parseFloat(e.target.value) || 0)}
                      className={cn(
                        'w-24 border rounded-xl px-3 py-2 text-center font-bold text-sm focus:outline-none focus:border-emerald-500',
                        isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
                      )}
                    />
                    <span className="font-bold text-sm text-emerald-600">%</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
                  >
                    <Save className="w-4 h-4" /> Save Fee Rate
                  </button>
                </div>
              </div>
            </form>

            <div
              className={cn(
                'p-4 rounded-2xl border space-y-1',
                isDarkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
              )}
            >
              <span className={cn('text-xs uppercase tracking-wider block font-semibold', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                Seller Commission Rate
              </span>
              <p className="text-xl font-bold text-emerald-600">0% (Promotional Standard)</p>
              <p className={cn('text-xs', isDarkMode ? 'text-neutral-500' : 'text-slate-500')}>
                Sellers pay 0% fees and retain 100% of the sale price.
              </p>
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="motion-safe:animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent"></div>
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
