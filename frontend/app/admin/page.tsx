'use client';

import { useAuth } from '@/lib/auth-context';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { getBuyerProtectionFeePercent, fetchBuyerProtectionFeePercent } from '@/lib/fees';
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
  Shield,
  ShieldCheck,
  Lock,
  CreditCard,
  AlertTriangle,
  ChevronRight,
  Sun,
  Moon,
  ArrowLeft,
  ExternalLink,
  Smartphone,
  TrendingUp,
  ArrowUpRight,
  Trash2,
  History,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ActivityLog } from './_desk/activity-log';
import { ListingsDesk } from './_desk/listings-desk';
import { NeedsAttention, useDeskSummary } from './_desk/needs-attention';
import { OrdersDesk } from './_desk/orders-desk';
import { ReviewQueue } from './_desk/review-queue';
import { SystemHealth } from './_desk/system-health';

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

interface ImeiRegistryItem {
  id: string;
  imei: string;
  brand: string | null;
  model: string | null;
  firstListingId: string;
  firstSellerId: string;
  lastListingId: string;
  lastSellerId: string;
  timesListed: number;
  isFlagged: boolean;
  flagReason: string | null;
  firstListedAt: string;
  lastListedAt: string;
  createdAt: string;
}

type TabId = 'dashboard' | 'verification' | 'listings' | 'orders' | 'activity' | 'users' | 'analytics' | 'health' | 'settings';

const TAB_HEADINGS: Record<TabId, { title: string; subtitle: string }> = {
  dashboard: { title: 'Overview', subtitle: 'What needs doing, and how the marketplace is performing.' },
  verification: { title: 'Review queue', subtitle: 'Listings waiting for a decision, and the device identifier register.' },
  listings: { title: 'Listings', subtitle: 'Find, check and take down listings.' },
  orders: { title: 'Orders and escrow', subtitle: 'Payments held, disputes, refunds and unpaid checkouts.' },
  activity: { title: 'Activity log', subtitle: 'Who did what, and when.' },
  users: { title: 'Users', subtitle: 'Search accounts and manage access.' },
  analytics: { title: 'Analytics', subtitle: 'Sales, fees and listing trends.' },
  health: { title: 'System health', subtitle: 'The status of the API, database, cache and connected services.' },
  settings: { title: 'Settings', subtitle: 'Marketplace fees and dashboard preferences.' },
};

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
  const [imeiRegistry, setImeiRegistry] = useState<ImeiRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [userSearch, setUserSearch] = useState('');
  const [imeiSearch, setImeiSearch] = useState('');
  const [imeiFlaggedOnly, setImeiFlaggedOnly] = useState(false);

  // Health state
  const [healthData, setHealthData] = useState<any>(null);

  // Platform settings — the fee rate is server-owned; fetched at runtime
  const [feeRatePercent, setFeeRatePercent] = useState<number>(getBuyerProtectionFeePercent());

  useEffect(() => {
    fetchBuyerProtectionFeePercent()
      .then(setFeeRatePercent)
      .catch(() => {});
  }, []);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Refund modal state
  const [deskView, setDeskView] = useState<string | undefined>(undefined);
  const [deskVersion, setDeskVersion] = useState(0);
  const deskSummary = useDeskSummary(deskVersion);

  // Load theme preference per admin user
  useEffect(() => {
    if (!user?.id) return;
    try {
      const savedTheme = localStorage.getItem(`veribuy_admin_theme_${user.id}`);
      if (savedTheme) {
        setIsDarkMode(savedTheme === 'dark');
      } else {
        setIsDarkMode(false);
      }
    } catch {
      // Theme preference is non-critical — ignore storage access errors.
    }
  }, [user?.id]);

  const setThemeMode = (mode: 'light' | 'dark') => {
    const next = mode === 'dark';
    setIsDarkMode(next);
    if (!user?.id) return;
    try {
      localStorage.setItem(`veribuy_admin_theme_${user.id}`, mode);
    } catch {
      // Theme preference is non-critical — ignore storage access errors.
    }
  };

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const withTimeout = <T,>(p: Promise<T>, ms = 10_000): Promise<T | null> =>
        Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

      const [usersRes, listingsRes, ordersRes, verRes, imeiRes, healthRes] = await Promise.allSettled([
        withTimeout(authFetch('/api/admin/users')),
        withTimeout(authFetch('/api/admin/listings?status=ALL&limit=100')),
        withTimeout(authFetch('/api/admin/orders?limit=100&enrich=true')),
        withTimeout(authFetch('/api/trust-lens?limit=100')),
        withTimeout(authFetch('/api/admin/imei-registry?limit=100')),
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
        setOrders(rawOrders);
      }

      const verVal = settleOk(verRes);
      if (verVal?.ok) {
        const d = await verVal.json();
        setVerifications(Array.isArray(d) ? d : d.data ?? []);
      }

      const imeiVal = settleOk(imeiRes);
      if (imeiVal?.ok) {
        const d = await imeiVal.json();
        setImeiRegistry(Array.isArray(d) ? d : d.data ?? []);
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

  const openDesk = (tab: 'verification' | 'listings' | 'orders', view?: string) => {
    setDeskView(view);
    handleTabClick(tab);
  };

  const refreshAll = useCallback(() => {
    setDeskVersion((version) => version + 1);
    fetchAll();
  }, [fetchAll]);

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

  const handleDeleteUser = async (targetUser: User) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete user "${targetUser.name || targetUser.email}"? This will remove their profile, associated addresses, and revoke all active sessions.`
      )
    ) {
      return;
    }
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await authFetch(`/api/admin/users/${targetUser.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to delete user');
      }
      setActionMessage({
        type: 'success',
        text: `User "${targetUser.name || targetUser.email}" deleted successfully`,
      });
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      await fetchAll();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to delete user',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Metrics & Core Calculations
  const activeListingsCount = listings.filter((l) => l.status === 'ACTIVE').length;
  // Sold and taken down listings no longer need a reviewer.
  const listingStatusById = new Map(listings.map((l) => [l.id, l.status]));
  const pendingVerifications = verifications.filter(
    (v) =>
      ['PENDING', 'IN_PROGRESS', 'REQUIRES_REVIEW'].includes(v.status) &&
      !['SOLD', 'DELISTED', 'REJECTED'].includes(listingStatusById.get(v.listingId) ?? ''),
  );
  const reviewQueueCount = deskSummary?.reviewWaiting ?? pendingVerifications.length;
  const listingTitleById = new Map(listings.map((l) => [l.id, l.title]));
  const flaggedImeis = imeiRegistry.filter((i) => i.isFlagged);

  const paidOrders = orders.filter((o) =>
    ['COMPLETED', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'PAYMENT_RECEIVED'].includes(o.status)
  );
  const activeEscrowOrders = orders.filter((o) =>
    ['ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'PAYMENT_RECEIVED'].includes(o.status)
  );
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
  const disputedOrders = orders.filter((o) => o.status === 'DISPUTED');
  const unpaidOrders = orders.filter((o) => o.status === 'PENDING');

  const totalGmv = paidOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const totalProtectionFees = paidOrders.reduce(
    (sum, o) => sum + Number(o.protectionFee ?? (Number(o.amount || 0) * feeRatePercent) / 100),
    0
  );
  const activeEscrowVault = activeEscrowOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const conversionRate = orders.length > 0 ? (paidOrders.length / orders.length) * 100 : 0;
  const aov = paidOrders.length > 0 ? totalGmv / paidOrders.length : 0;
  const totalRevenue = totalGmv;

  // 14-Day Continuous Timeline (guaranteed continuous dates with zero fill)
  const last14Days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last14Days.push(d.toISOString().split('T')[0]);
  }

  const dailyAnalytics = last14Days.map((dateStr) => {
    const dayOrders = orders.filter((o) => {
      try {
        return new Date(o.createdAt).toISOString().split('T')[0] === dateStr;
      } catch {
        return false;
      }
    });

    const dayPaid = dayOrders.filter((o) =>
      ['COMPLETED', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'PAYMENT_RECEIVED'].includes(o.status)
    );
    const dayGmv = dayPaid.reduce((sum, o) => sum + Number(o.amount || 0), 0);
    const dayFees = dayPaid.reduce(
      (sum, o) => sum + Number(o.protectionFee ?? (Number(o.amount || 0) * feeRatePercent) / 100),
      0
    );
    const dayUnpaid = dayOrders.filter((o) => o.status === 'PENDING').length;

    return {
      date: new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      rawDate: dateStr,
      revenue: Math.round(dayGmv),
      gmv: Math.round(dayGmv * 100) / 100,
      fees: Math.round(dayFees * 100) / 100,
      paidCount: dayPaid.length,
      unpaidCount: dayUnpaid,
      totalOrders: dayOrders.length,
    };
  });

  const revenueChartData = dailyAnalytics.map((d) => ({
    date: d.date,
    revenue: d.revenue,
    fees: d.fees,
  }));

  // Category volume breakdown
  const categoryStats: Record<string, { count: number; activeValue: number }> = {
    SMARTPHONE: { count: 0, activeValue: 0 },
    TABLET: { count: 0, activeValue: 0 },
    LAPTOP: { count: 0, activeValue: 0 },
    AUDIO: { count: 0, activeValue: 0 },
    WEARABLE: { count: 0, activeValue: 0 },
    OTHER: { count: 0, activeValue: 0 },
  };

  listings.forEach((l) => {
    const rawType = (l.deviceType || '').toUpperCase();
    const typeKey = categoryStats[rawType] ? rawType : 'OTHER';
    categoryStats[typeKey].count += 1;
    if (l.status === 'ACTIVE') {
      categoryStats[typeKey].activeValue += Number(l.price || 0);
    }
  });

  const categoryChartData = Object.entries(categoryStats).map(([name, stat]) => ({
    name: name.charAt(0) + name.slice(1).toLowerCase(),
    count: stat.count,
    value: Math.round(stat.activeValue),
  }));

  const navItems: { id: TabId; label: string; icon: any; count?: number; alert?: boolean }[] = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'verification', label: 'Review queue', icon: ClipboardCheck, count: reviewQueueCount, alert: reviewQueueCount > 0 },
    { id: 'listings', label: 'Listings', icon: Store },
    { id: 'orders', label: 'Orders and escrow', icon: Wallet, alert: !!deskSummary?.disputes, count: deskSummary?.disputes || undefined },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'activity', label: 'Activity log', icon: History },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'health', label: 'System health', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const filteredUsers = users.filter((u) => {
    const term = userSearch.toLowerCase();
    return !term || (u.name && u.name.toLowerCase().includes(term)) || (u.email && u.email.toLowerCase().includes(term));
  });

  const filteredImeis = imeiRegistry.filter((item) => {
    if (imeiFlaggedOnly && !item.isFlagged) return false;
    const term = imeiSearch.toLowerCase().trim();
    if (!term) return true;
    return (
      item.imei.toLowerCase().includes(term) ||
      (item.brand && item.brand.toLowerCase().includes(term)) ||
      (item.model && item.model.toLowerCase().includes(term)) ||
      (item.flagReason && item.flagReason.toLowerCase().includes(term)) ||
      item.firstListingId.toLowerCase().includes(term) ||
      item.lastListingId.toLowerCase().includes(term)
    );
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
              <span className="text-[11px] text-emerald-600 font-semibold">Administrator</span>
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
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'motion-safe:animate-spin')} /> Refresh
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
            <span className="flex-1">{actionMessage.text}</span>
            <button type="button" onClick={() => setActionMessage(null)} aria-label="Dismiss message" className="p-0.5 rounded hover:bg-black/5">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className={cn('text-2xl sm:text-3xl font-bold tracking-tight', isDarkMode ? 'text-white' : 'text-slate-900')}>
              {TAB_HEADINGS[activeTab].title}
            </h1>
            <p className={cn('text-sm mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
              {TAB_HEADINGS[activeTab].subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchAll()}
              disabled={loading}
              className={cn(
                'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-xs',
                isDarkMode
                  ? 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              )}
              title="Refresh live data"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin text-emerald-600')} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>

          </div>
        </div>

        {/* ─── TAB 1: COMMAND CENTER (OVERVIEW) ─── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <NeedsAttention summary={deskSummary} isDarkMode={isDarkMode} onOpen={openDesk} />
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                className={cn(
                  'border rounded-3xl p-6 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <span className={cn('text-xs uppercase tracking-wider block mb-1 font-semibold', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Total sales
                </span>
                <p className="text-2xl font-bold text-emerald-600">{formatPrice(totalRevenue, 'GBP')}</p>
                <span className={cn('text-xs mt-2 block', isDarkMode ? 'text-neutral-500' : 'text-slate-500')}>
                  {paidOrders.length} paid orders
                </span>
              </div>

              <div
                className={cn(
                  'border rounded-3xl p-6 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <span className={cn('text-xs uppercase tracking-wider block mb-1 font-semibold', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Waiting for review
                </span>
                <p className="text-2xl font-bold text-amber-600">{reviewQueueCount}</p>
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
                  {listings.length} listings in total
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
                    Sales over time
                  </h3>
                  <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Last 14 days
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
                      formatter={(val: any) => [`£${val}`, 'Sales']}
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
                  <ClipboardCheck className="w-5 h-5 text-emerald-600" /> Waiting for review
                </h3>
                <button
                  onClick={() => setActiveTab('verification')}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                >
                  View All ({reviewQueueCount})
                </button>
              </div>

              {reviewQueueCount === 0 ? (
                <div className={cn('text-center py-8 text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  Nothing is waiting for review.
                </div>
              ) : pendingVerifications.length === 0 ? (
                <p className={cn('text-xs py-4', isDarkMode ? 'text-neutral-400' : 'text-slate-600')}>
                  {reviewQueueCount} {reviewQueueCount === 1 ? 'listing is' : 'listings are'} waiting. Open the review queue to see them.
                </p>
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
                          {listingTitleById.get(v.listingId) ?? `Listing ${v.listingId.substring(0, 8)}`}
                        </p>
                      </div>

                      <Link
                        href={`/admin/review/${v.listingId}`}
                        className="shrink-0 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs"
                      >
                        Review
                      </Link>
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
            <ReviewQueue isDarkMode={isDarkMode} />

            {/* IMEI Security & Duplicate Tracker Card */}
            <div
              className={cn(
                'border rounded-3xl overflow-hidden shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <div className={cn('p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4', isDarkMode ? 'border-neutral-800' : 'border-slate-200')}>
                <div>
                  <h3 className={cn('text-base font-bold flex items-center gap-2', isDarkMode ? 'text-white' : 'text-slate-900')}>
                    <Shield className="w-5 h-5 text-emerald-600" />
                    IMEI Registry & Duplicate Tracker
                  </h3>
                  <p className={cn('text-xs mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Historical registry of listed hardware identifiers. Flags re-listing attempts across different seller accounts.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => setImeiFlaggedOnly(!imeiFlaggedOnly)}
                    className={cn(
                      'px-3.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors',
                      imeiFlaggedOnly
                        ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 font-bold'
                        : isDarkMode
                        ? 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    Flagged Duplicates Only ({flaggedImeis.length})
                  </button>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search IMEI or device..."
                      value={imeiSearch}
                      onChange={(e) => setImeiSearch(e.target.value)}
                      className={cn(
                        'pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-emerald-500',
                        isDarkMode
                          ? 'bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500'
                          : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                      )}
                    />
                  </div>
                </div>
              </div>

              {filteredImeis.length === 0 ? (
                <div className={cn('text-center py-12 text-sm', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  No IMEI records found matching your filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={cn('border-b font-semibold uppercase tracking-wider', isDarkMode ? 'border-neutral-800 text-neutral-400 bg-neutral-950/40' : 'border-slate-200 text-slate-500 bg-slate-50')}>
                        <th className="py-3 px-5">IMEI</th>
                        <th className="py-3 px-4">Device</th>
                        <th className="py-3 px-4">Times Listed</th>
                        <th className="py-3 px-4">First Listed</th>
                        <th className="py-3 px-4">Last Activity</th>
                        <th className="py-3 px-4">Integrity Status</th>
                        <th className="py-3 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={cn('divide-y', isDarkMode ? 'divide-neutral-800/60' : 'divide-slate-200/60')}>
                      {filteredImeis.map((item) => (
                        <tr key={item.id} className={cn('transition-colors', isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-slate-50/70')}>
                          <td className="py-3.5 px-5 font-mono font-semibold text-slate-800 dark:text-neutral-200">
                            {item.imei}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-neutral-200">
                            {item.brand || item.model ? `${item.brand ?? ''} ${item.model ?? ''}`.trim() : 'Unspecified'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={cn('px-2.5 py-0.5 rounded-full font-bold text-xs', item.timesListed > 1 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400')}>
                              {item.timesListed}x
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-neutral-400">
                            <div>{new Date(item.firstListedAt).toLocaleDateString('en-GB')}</div>
                            <div className="font-mono text-[10px] text-slate-400">Listing: #{item.firstListingId.substring(0, 8)}</div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-neutral-400">
                            <div>{new Date(item.lastListedAt).toLocaleDateString('en-GB')}</div>
                            <div className="font-mono text-[10px] text-slate-400">Listing: #{item.lastListingId.substring(0, 8)}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            {item.isFlagged ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-xs bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/60">
                                  <AlertTriangle className="w-3 h-3" /> Duplicate Seller Attempt
                                </span>
                                {item.flagReason && (
                                  <div className="text-[10px] text-red-600 dark:text-red-400 mt-0.5 italic">{item.flagReason}</div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                                <CheckCircle2 className="w-3 h-3" /> Unique Single Seller
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <Link
                              href={`/listings/${item.lastListingId}`}
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors',
                                isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              )}
                            >
                              <ExternalLink className="w-3 h-3" /> Listing
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: LISTINGS MODERATION ─── */}
        {activeTab === 'listings' && (
          <ListingsDesk key={deskView} isDarkMode={isDarkMode} onChanged={refreshAll} initialView={deskView ?? 'all'} />
        )}

        {activeTab === 'orders' && (
          <OrdersDesk key={deskView} isDarkMode={isDarkMode} onChanged={refreshAll} initialView={deskView ?? 'all'} />
        )}

        {activeTab === 'activity' && <ActivityLog isDarkMode={isDarkMode} />}

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
                      <th className="py-4 px-6 text-right">Actions</th>
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
                          <div className="flex items-center justify-end gap-2">
                            <button
                              disabled={actionLoading}
                              onClick={() => handleToggleUserRole(u)}
                              className={cn(
                                'px-3 py-1.5 font-semibold rounded-lg border shadow-sm transition-colors text-xs',
                                isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                              )}
                            >
                              Switch to {u.role === 'ADMIN' ? 'USER' : 'ADMIN'}
                            </button>
                            <button
                              disabled={actionLoading}
                              onClick={() => handleDeleteUser(u)}
                              title="Delete user account"
                              className="px-2.5 py-1.5 font-semibold rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 shadow-sm transition-colors text-xs flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
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
            {/* Top KPI Metrics Suite */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div
                className={cn(
                  'p-5 rounded-3xl border shadow-sm transition-all',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={cn('text-xs font-semibold uppercase tracking-wider', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Total sales
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className={cn('text-2xl font-black tracking-tight', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  {formatPrice(totalGmv, 'GBP')}
                </div>
                <div className={cn('text-xs mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Gross value transacted
                </div>
              </div>

              <div
                className={cn(
                  'p-5 rounded-3xl border shadow-sm transition-all',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={cn('text-xs font-semibold uppercase tracking-wider', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Protection Fees
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className={cn('text-2xl font-black tracking-tight text-indigo-600 dark:text-indigo-400')}>
                  {formatPrice(totalProtectionFees, 'GBP')}
                </div>
                <div className={cn('text-xs mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Earned on paid orders
                </div>
              </div>

              <div
                className={cn(
                  'p-5 rounded-3xl border shadow-sm transition-all',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={cn('text-xs font-semibold uppercase tracking-wider', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Active Escrow
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <Lock className="w-4 h-4" />
                  </div>
                </div>
                <div className={cn('text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400')}>
                  {formatPrice(activeEscrowVault, 'GBP')}
                </div>
                <div className={cn('text-xs mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  {activeEscrowOrders.length} orders in vault
                </div>
              </div>

              <div
                className={cn(
                  'p-5 rounded-3xl border shadow-sm transition-all',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={cn('text-xs font-semibold uppercase tracking-wider', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Conversion Rate
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <div className={cn('text-2xl font-black tracking-tight', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  {conversionRate.toFixed(1)}%
                </div>
                <div className={cn('text-xs mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  {paidOrders.length} paid of {orders.length} total
                </div>
              </div>

              <div
                className={cn(
                  'p-5 rounded-3xl border shadow-sm transition-all',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={cn('text-xs font-semibold uppercase tracking-wider', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Average Order Value
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <div className={cn('text-2xl font-black tracking-tight', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  {formatPrice(aov, 'GBP')}
                </div>
                <div className={cn('text-xs mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Avg ticket per checkout
                </div>
              </div>
            </div>

            {/* Main Dual-Metric Volume & Revenue Chart */}
            <div
              className={cn(
                'border rounded-3xl p-6 shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h3 className={cn('text-base font-bold flex items-center gap-2', isDarkMode ? 'text-white' : 'text-slate-900')}>
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    Gross Platform Transaction Velocity & Protection Fees
                  </h3>
                  <p className={cn('text-xs mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    Sales and buyer protection fees over the last 14 days.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className={isDarkMode ? 'text-neutral-300' : 'text-slate-700'}>Sales (£)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-indigo-500" />
                    <span className={isDarkMode ? 'text-neutral-300' : 'text-slate-700'}>Buyer protection fees (£)</span>
                  </div>
                </div>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyAnalytics}>
                    <defs>
                      <linearGradient id="gmvGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="feeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
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
                      formatter={(val: any, name: any) => [
                        `£${val}`,
                        name === 'gmv' ? 'Sales' : 'Buyer protection fees',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="gmv"
                      name="gmv"
                      stroke="#059669"
                      strokeWidth={2.5}
                      fill="url(#gmvGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="fees"
                      name="fees"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#feeGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Two-Column Breakdown: Escrow Lifecycle & Device Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Escrow Status Breakdown */}
              <div
                className={cn(
                  'border rounded-3xl p-6 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <h3 className={cn('text-base font-bold mb-1 flex items-center gap-2', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  <Lock className="w-5 h-5 text-amber-500" />
                  Escrow Lifecycle Distribution
                </h3>
                <p className={cn('text-xs mb-5', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Current disposition of all transaction funds across states.
                </p>

                <div className="space-y-4">
                  {[
                    {
                      label: 'Paid in Escrow (Awaiting Dispatch)',
                      count: orders.filter((o) => o.status === 'ESCROW_HELD' || o.status === 'PAYMENT_RECEIVED').length,
                      val: orders.filter((o) => o.status === 'ESCROW_HELD' || o.status === 'PAYMENT_RECEIVED').reduce((s, o) => s + Number(o.amount || 0), 0),
                      color: 'bg-amber-500',
                    },
                    {
                      label: 'In Transit / Dispatched',
                      count: orders.filter((o) => o.status === 'SHIPPED').length,
                      val: orders.filter((o) => o.status === 'SHIPPED').reduce((s, o) => s + Number(o.amount || 0), 0),
                      color: 'bg-blue-500',
                    },
                    {
                      label: 'Delivered',
                      count: orders.filter((o) => o.status === 'DELIVERED').length,
                      val: orders.filter((o) => o.status === 'DELIVERED').reduce((s, o) => s + Number(o.amount || 0), 0),
                      color: 'bg-indigo-500',
                    },
                    {
                      label: 'Funds Released / Completed',
                      count: completedOrders.length,
                      val: completedOrders.reduce((s, o) => s + Number(o.amount || 0), 0),
                      color: 'bg-emerald-500',
                    },
                    {
                      label: 'Disputed / In Arbitration',
                      count: disputedOrders.length,
                      val: disputedOrders.reduce((s, o) => s + Number(o.amount || 0), 0),
                      color: 'bg-red-500',
                    },
                    {
                      label: 'Unpaid Checkout Attempts',
                      count: unpaidOrders.length,
                      val: unpaidOrders.reduce((s, o) => s + Number(o.amount || 0), 0),
                      color: 'bg-slate-400',
                    },
                  ].map((row, idx) => {
                    const pct = orders.length > 0 ? (row.count / orders.length) * 100 : 0;
                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className={cn('font-semibold', isDarkMode ? 'text-neutral-200' : 'text-slate-700')}>
                            {row.label}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className={cn('font-mono font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                              {formatPrice(row.val, 'GBP')}
                            </span>
                            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', isDarkMode ? 'bg-neutral-800 text-neutral-300' : 'bg-slate-100 text-slate-600')}>
                              {row.count} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', row.color)}
                            style={{ width: `${Math.max(pct, row.count > 0 ? 3 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Device Category Distribution */}
              <div
                className={cn(
                  'border rounded-3xl p-6 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <h3 className={cn('text-base font-bold mb-1 flex items-center gap-2', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  <Smartphone className="w-5 h-5 text-emerald-600" />
                  Inventory & Category Distribution
                </h3>
                <p className={cn('text-xs mb-5', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Live marketplace catalog volume and active inventory value.
                </p>

                <div className="space-y-4">
                  {categoryChartData.map((cat, idx) => {
                    const totalListingsCount = listings.length || 1;
                    const pct = (cat.count / totalListingsCount) * 100;
                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className={cn('font-semibold', isDarkMode ? 'text-neutral-200' : 'text-slate-700')}>
                            {cat.name}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className={cn('font-mono font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                              {formatPrice(cat.value, 'GBP')} active
                            </span>
                            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', isDarkMode ? 'bg-neutral-800 text-neutral-300' : 'bg-slate-100 text-slate-600')}>
                              {cat.count} listings ({pct.toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.max(pct, cat.count > 0 ? 3 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Daily Itemized Settlement Ledger (14-Day Audit Table) */}
            <div
              className={cn(
                'border rounded-3xl overflow-hidden shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <div className={cn('p-6 border-b', isDarkMode ? 'border-neutral-800' : 'border-slate-200')}>
                <h3 className={cn('text-base font-bold flex items-center gap-2', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  <Wallet className="w-5 h-5 text-indigo-600" />
                  14-Day Platform Settlement Audit Ledger
                </h3>
                <p className={cn('text-xs mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Daily breakdown of checkout attempts, paid escrow deposits, and captured protection fees.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={cn('border-b font-semibold uppercase tracking-wider', isDarkMode ? 'border-neutral-800 text-neutral-400 bg-neutral-950/40' : 'border-slate-200 text-slate-500 bg-slate-50')}>
                      <th className="py-3 px-6">Settlement Date</th>
                      <th className="py-3 px-6">Paid Orders</th>
                      <th className="py-3 px-6">Sales</th>
                      <th className="py-3 px-6">Buyer protection fees</th>
                      <th className="py-3 px-6">Unpaid Attempts</th>
                      <th className="py-3 px-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className={cn('divide-y', isDarkMode ? 'divide-neutral-800/60' : 'divide-slate-200/60')}>
                    {dailyAnalytics.slice().reverse().map((day, idx) => (
                      <tr key={idx} className={cn('transition-colors', isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-slate-50/70')}>
                        <td className="py-3.5 px-6 font-semibold text-slate-800 dark:text-neutral-200">
                          {day.date} <span className="text-[10px] text-slate-400 font-mono">({day.rawDate})</span>
                        </td>
                        <td className="py-3.5 px-6 font-bold">
                          {day.paidCount > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">{day.paidCount} paid</span>
                          ) : (
                            <span className="text-slate-400 font-normal">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-6 font-mono font-bold text-slate-800 dark:text-neutral-200">
                          {formatPrice(day.gmv, 'GBP')}
                        </td>
                        <td className="py-3.5 px-6 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {formatPrice(day.fees, 'GBP')}
                        </td>
                        <td className="py-3.5 px-6 text-slate-500 dark:text-neutral-400 font-mono">
                          {day.unpaidCount}
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          {day.paidCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60">
                              <CheckCircle2 className="w-3 h-3" /> Settled
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal text-slate-400 bg-slate-100 dark:bg-neutral-800">
                              Idle
                            </span>
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

        {/* ─── TAB 7: SYSTEM HEALTH & BACKEND APIS ─── */}
        {activeTab === 'health' && <SystemHealth data={healthData} loading={loading} isDarkMode={isDarkMode} />}

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

            {/* Fee Setting (read-only — server-owned) */}
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
                    Server-owned rate applied to every checkout.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xl font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                    {feeRatePercent}
                  </span>
                  <span className="font-bold text-sm text-emerald-600">%</span>
                </div>
              </div>

              <p className={cn('text-xs pt-2', isDarkMode ? 'text-neutral-500' : 'text-slate-500')}>
                This rate is configured via the <code className="font-mono">BUYER_PROTECTION_FEE_PERCENT</code>{' '}
                environment variable on the backend. Changing it applies to new orders; existing orders keep
                the fee they were created with. It cannot be changed from the browser, which prevents tampering
                with checkout totals.
              </p>
            </div>

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
