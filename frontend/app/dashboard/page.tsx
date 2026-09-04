'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  List,
  ShoppingBag,
  ShoppingCart,
  DollarSign,
  BarChart2,
  Star,
  ArrowUpRight,
  Package,
  Truck,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Plus,
  Menu,
  X,
  LogOut,
  Search,
  Eye,
  UserCircle,
  Settings,
  Lock,
  Bell,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  CreditCard,
  Building2,
  ExternalLink,
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

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Listing {
  id: string;
  title: string;
  brand: string;
  model: string;
  price: number;
  currency: string;
  status: string;
  trustLensStatus: string;
  conditionGrade: string | null;
  viewCount: number;
  createdAt: string;
}

interface Order {
  id: string;
  listingId?: string | null;
  listingTitle?: string | null;
  listingDescription?: string | null;
  listingCategory?: string | null;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  shippedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  trackingNumber?: string | null;
  buyer?: { displayName: string; email: string } | null;
  seller?: { displayName: string; email: string } | null;
  listing?: { id?: string; title: string; brand: string; model: string; imageUrls?: string[] } | null;
}

interface VerificationRequest {
  id: string;
  listingId: string;
  status: string;
  createdAt: string;
}

type NavId = 'dashboard' | 'listings' | 'purchases' | 'sales' | 'earnings' | 'analytics' | 'profile' | 'settings';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING:          { label: 'Pending',      className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  PAYMENT_RECEIVED: { label: 'Processing',   className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  ESCROW_HELD:      { label: 'Escrow Held',  className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  SHIPPED:          { label: 'In Transit',   className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  DELIVERED:        { label: 'Delivered',    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  COMPLETED:        { label: 'Completed',    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  CANCELLED:        { label: 'Cancelled',    className: 'bg-neutral-800 text-neutral-400 border-neutral-700' },
  REFUNDED:         { label: 'Refunded',     className: 'bg-neutral-800 text-neutral-400 border-neutral-700' },
  DISPUTED:         { label: 'In Dispute',   className: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const TRUST_BADGE: Record<string, { label: string; className: string }> = {
  PASSED:      { label: 'Verified',    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  IN_PROGRESS: { label: 'Checking',    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  FAILED:      { label: 'Flagged',     className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  PENDING:     { label: 'Queued',      className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
};

const REVENUE_STATUSES = ['COMPLETED', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'PAYMENT_RECEIVED'];

function buildSalesChart(orders: Order[]): { date: string; revenue: number }[] {
  const days = 30;
  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    map.set(d.toISOString().split('T')[0], 0);
  }
  orders.filter(o => REVENUE_STATUSES.includes(o.status)).forEach(o => {
    const key = new Date(o.createdAt).toISOString().split('T')[0];
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + Number(o.amount));
  });
  let running = 0;
  return Array.from(map.entries()).map(([date, rev]) => {
    running += rev;
    return {
      date: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      revenue: Math.round(running),
    };
  });
}

function StarRating({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn(
            'w-3.5 h-3.5',
            i <= Math.floor(value)
              ? 'text-amber-400 fill-amber-400'
              : i - 0.5 <= value
                ? 'text-amber-400 fill-amber-200'
                : 'text-neutral-700 fill-neutral-800'
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────
// Main Dashboard Content
// ─────────────────────────────────────────────

function DashboardContent() {
  const router = useRouter();
  const { user, logout, authFetch } = useAuth();
  const searchParams = useSearchParams();
  const validTabs: NavId[] = ['dashboard', 'listings', 'purchases', 'sales', 'earnings', 'analytics', 'profile', 'settings'];
  const initialTab = validTabs.includes(searchParams.get('tab') as NavId) ? (searchParams.get('tab') as NavId) : 'dashboard';
  const [activeNav, setActiveNav] = useState<NavId>(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [listings, setListings] = useState<Listing[]>([]);
  const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
  const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Listing filter & search state
  const [listingFilter, setListingFilter] = useState<string>('ALL');
  const [listingSearch, setListingSearch] = useState<string>('');

  // Seller rating from profile
  const [sellerRating, setSellerRating] = useState<number | null>(null);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<string>('UNVERIFIED');

  // Rating modal state
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const [ratedOrders, setRatedOrders] = useState<Set<string>>(new Set());

  // Profile state
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Settings / security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState('');
  const [securityError, setSecurityError] = useState('');

  // Notification preferences
  const [notifListingUpdates, setNotifListingUpdates] = useState(true);
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifTrustLens, setNotifTrustLens] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const withTimeout = <T,>(p: Promise<T>, ms = 10_000): Promise<T | null> =>
        Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

      const [listRes, sellerOrdRes, buyerOrdRes, verRes, profileRes] = await Promise.allSettled([
        withTimeout(authFetch(`/api/listings?sellerId=${user.id}`)),
        withTimeout(authFetch(`/api/checkout/orders/seller/${user.id}`)),
        withTimeout(authFetch(`/api/checkout/orders/buyer/${user.id}`)),
        withTimeout(authFetch('/api/trust-lens?limit=100')),
        withTimeout(fetch(`/api/users/${user.id}/profile`, { credentials: 'include' })),
      ]);

      const settleOk = (r: PromiseSettledResult<Response | null>): Response | null =>
        r.status === 'fulfilled' ? r.value : null;

      const listVal = settleOk(listRes);
      if (listVal?.ok) {
        const d = await listVal.json();
        setListings(Array.isArray(d) ? d : (d.data ?? []));
      }
      const sellerOrdVal = settleOk(sellerOrdRes);
      if (sellerOrdVal?.ok) {
        const d = await sellerOrdVal.json();
        setSellerOrders(Array.isArray(d) ? d : (d.data ?? []));
      }
      const buyerOrdVal = settleOk(buyerOrdRes);
      if (buyerOrdVal?.ok) {
        const d = await buyerOrdVal.json();
        setBuyerOrders(Array.isArray(d) ? d : (d.data ?? []));
      }
      const verVal = settleOk(verRes);
      if (verVal?.ok) {
        const d = await verVal.json();
        setVerifications(Array.isArray(d) ? d : (d.data ?? []));
      }
      const profileVal = settleOk(profileRes);
      if (profileVal?.ok) {
        const p = await profileVal.json();
        setSellerRating(p.sellerRating ?? null);
        setTotalSalesCount(p.totalSales ?? 0);
        setVerificationStatus(p.verificationStatus ?? 'UNVERIFIED');
      }
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, authFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Sync tab with URL
  const handleNavClick = (nav: NavId) => {
    setActiveNav(nav);
    setSidebarOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', nav);
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  };

  // Profile save
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setProfileSaving(true);
    setProfileSuccess('');
    setProfileError('');
    try {
      const res = await authFetch(`/api/users/${user.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: profileDisplayName,
          firstName: profileFirstName,
          lastName: profileLastName,
          phone: profilePhone,
          bio: profileBio,
        }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      setProfileSuccess('Profile updated successfully');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Error updating profile');
    } finally {
      setProfileSaving(false);
    }
  };

  // Password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setSecurityError('New passwords do not match');
      return;
    }
    setPasswordLoading(true);
    setSecuritySuccess('');
    setSecurityError('');
    try {
      const res = await authFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to change password');
      }
      setSecuritySuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setSecuritySuccess(''), 3000);
    } catch (err: any) {
      setSecurityError(err.message || 'Error changing password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Derived metrics
  const activeListingsCount = listings.filter(l => l.status === 'ACTIVE').length;
  const inTransitPurchases = buyerOrders.filter(o => o.status === 'SHIPPED').length;
  const totalEarned = sellerOrders
    .filter(o => ['COMPLETED', 'ESCROW_HELD', 'DELIVERED'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const pendingEscrow = sellerOrders
    .filter(o => ['ESCROW_HELD', 'SHIPPED', 'DELIVERED'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);

  const salesChartData = buildSalesChart(sellerOrders);

  const filteredListings = listings.filter(l => {
    const matchesFilter =
      listingFilter === 'ALL' ||
      (listingFilter === 'ACTIVE' && l.status === 'ACTIVE') ||
      (listingFilter === 'REVIEW' && ['UNDER_REVIEW', 'PENDING'].includes(l.status)) ||
      (listingFilter === 'SOLD' && l.status === 'SOLD');
    const matchesSearch =
      !listingSearch ||
      l.title.toLowerCase().includes(listingSearch.toLowerCase()) ||
      l.brand.toLowerCase().includes(listingSearch.toLowerCase()) ||
      l.model.toLowerCase().includes(listingSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const navItems: { id: NavId; label: string; icon: any; count?: number }[] = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'listings', label: 'My Listings', icon: List, count: listings.length },
    { id: 'purchases', label: 'Purchases', icon: ShoppingCart, count: buyerOrders.length },
    { id: 'sales', label: 'Sales & Orders', icon: ShoppingBag, count: sellerOrders.length },
    { id: 'earnings', label: 'Escrow & Earnings', icon: DollarSign },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'profile', label: 'Profile', icon: UserCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-neutral-900 border-b border-neutral-800">
        <BrandLogo />
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
          <div className="hidden md:block mb-8">
            <BrandLogo />
          </div>

          {/* User Profile Mini Card */}
          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{user?.name || 'VeriBuy User'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] text-emerald-400 font-medium">Verified Account</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5" aria-label="Dashboard tabs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
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
                        'px-2 py-0.5 rounded-full text-xs font-mono',
                        isActive ? 'bg-emerald-700 text-white' : 'bg-neutral-800 text-neutral-300'
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
          <Link
            href="/listings/create"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold text-xs uppercase tracking-wider transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Listing
          </Link>
          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-neutral-800 text-xs transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        {/* Top greeting bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {activeNav === 'dashboard' && 'Dashboard Overview'}
              {activeNav === 'listings' && 'Inventory & Listings'}
              {activeNav === 'purchases' && 'My Purchases'}
              {activeNav === 'sales' && 'Sales & Fulfillment'}
              {activeNav === 'earnings' && 'Escrow & Payouts'}
              {activeNav === 'analytics' && 'Performance Analytics'}
              {activeNav === 'profile' && 'Public Profile'}
              {activeNav === 'settings' && 'Account & Security'}
            </h1>
            <p className="text-neutral-400 text-sm mt-1">
              Welcome back, <span className="text-white font-medium">{user?.name}</span>. All your activities are protected by VeriBuy Escrow.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/listings/create"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-950 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Listing
            </Link>
          </div>
        </div>

        {/* ─── TAB 1: OVERVIEW ─── */}
        {activeNav === 'dashboard' && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5">
                <div className="flex items-center justify-between text-neutral-400 text-xs uppercase tracking-wider mb-2">
                  <span>Total Sales</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-white">{formatPrice(totalEarned, 'GBP')}</p>
                <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> 0% seller commission
                </p>
              </div>

              <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5">
                <div className="flex items-center justify-between text-neutral-400 text-xs uppercase tracking-wider mb-2">
                  <span>Active Listings</span>
                  <List className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-white">{activeListingsCount}</p>
                <p className="text-xs text-neutral-400 mt-1">
                  {listings.length} total items listed
                </p>
              </div>

              <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5">
                <div className="flex items-center justify-between text-neutral-400 text-xs uppercase tracking-wider mb-2">
                  <span>Purchases In Transit</span>
                  <Truck className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-2xl font-bold text-white">{inTransitPurchases}</p>
                <p className="text-xs text-neutral-400 mt-1">
                  {buyerOrders.length} total purchases
                </p>
              </div>

              <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5">
                <div className="flex items-center justify-between text-neutral-400 text-xs uppercase tracking-wider mb-2">
                  <span>Vaulted Escrow</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-emerald-400">{formatPrice(pendingEscrow, 'GBP')}</p>
                <p className="text-xs text-neutral-400 mt-1">
                  Protected in vault
                </p>
              </div>
            </div>

            {/* Sales Chart & Recent Activities Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sales Chart (2 cols) */}
              <div className="lg:col-span-2 bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-bold text-white">30-Day Sales Volume</h2>
                    <p className="text-xs text-neutral-400">Cumulative sales and escrow clearances</p>
                  </div>
                  <span className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 font-mono">
                    Real-time
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                      <XAxis dataKey="date" stroke="#737373" fontSize={11} tickLine={false} />
                      <YAxis stroke="#737373" fontSize={11} tickLine={false} tickFormatter={(v) => `£${v}`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#171717',
                          borderColor: '#262626',
                          borderRadius: '12px',
                          color: '#fff',
                        }}
                        formatter={(val: any) => [`£${val}`, 'Revenue']}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#emeraldGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quick Actions & Escrow Reassurance */}
              <div className="space-y-4">
                <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Trust Lens™ Diagnostics
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                    Every device on VeriBuy undergoes real-time GSMA blacklist verification, activation lock checks, and condition matching.
                  </p>
                  <Link
                    href="/how-it-works"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    Learn about verification <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="bg-gradient-to-br from-emerald-950/40 via-neutral-900 to-neutral-900 border border-emerald-500/20 rounded-3xl p-6">
                  <h3 className="text-sm font-bold text-white mb-2">Sell with Zero Commission</h3>
                  <p className="text-xs text-neutral-400 mb-4">
                    Keep 100% of your selling price with guaranteed escrow payouts.
                  </p>
                  <Link
                    href="/listings/create"
                    className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-colors"
                  >
                    List a Device Now
                  </Link>
                </div>
              </div>
            </div>

            {/* Recent Orders Preview */}
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white">Recent Orders</h2>
                <button
                  onClick={() => setActiveNav('purchases')}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  View All ({buyerOrders.length})
                </button>
              </div>

              {buyerOrders.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 text-sm">
                  <Package className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                  No purchases yet.{' '}
                  <Link href="/browse" className="text-emerald-400 underline">
                    Browse verified electronics
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {buyerOrders.slice(0, 3).map((o) => {
                    const badge = STATUS_BADGE[o.status] || { label: o.status, className: 'bg-neutral-800 text-neutral-400' };
                    return (
                      <div
                        key={o.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 hover:border-neutral-700 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-neutral-400">#{o.id.substring(0, 8)}</span>
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', badge.className)}>
                              {badge.label}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-white">{o.listing?.title || o.listingTitle || 'Verified Device'}</p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <span className="text-sm font-bold text-emerald-400">{formatPrice(o.amount, o.currency)}</span>
                          <Link
                            href={`/orders/${o.id}/tracking`}
                            className="inline-flex items-center gap-1 text-xs text-neutral-300 hover:text-white bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-700"
                          >
                            Track <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: MY LISTINGS ─── */}
        {activeNav === 'listings' && (
          <div className="space-y-6">
            {/* Filter & Search Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                {['ALL', 'ACTIVE', 'REVIEW', 'SOLD'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setListingFilter(f)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors',
                      listingFilter === f
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    )}
                  >
                    {f === 'ALL' && 'All Listings'}
                    {f === 'ACTIVE' && 'Active'}
                    {f === 'REVIEW' && 'Under Review'}
                    {f === 'SOLD' && 'Sold'}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search listings..."
                  value={listingSearch}
                  onChange={(e) => setListingSearch(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 w-full sm:w-60"
                />
              </div>
            </div>

            {/* Listings Grid */}
            {filteredListings.length === 0 ? (
              <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-12 text-center">
                <List className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">No listings found</h3>
                <p className="text-xs text-neutral-400 mb-6">Create a verified listing with 0% seller fees</p>
                <Link
                  href="/listings/create"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-950"
                >
                  <Plus className="w-4 h-4" /> Create Listing
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredListings.map((l) => {
                  const trust = TRUST_BADGE[l.trustLensStatus] || { label: l.trustLensStatus, className: 'bg-neutral-800 text-neutral-400' };
                  return (
                    <div
                      key={l.id}
                      className="bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 flex flex-col justify-between transition-all"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', trust.className)}>
                            {trust.label}
                          </span>
                          <span className="text-sm font-bold text-emerald-400">{formatPrice(l.price, l.currency)}</span>
                        </div>
                        <h3 className="font-bold text-white text-sm line-clamp-1 mb-1">{l.title}</h3>
                        <p className="text-xs text-neutral-400 mb-4">
                          {l.brand} &bull; {l.model}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                        <Link
                          href={`/listings/${l.id}`}
                          className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                        >
                          View Listing <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          href={`/verification/${l.id}`}
                          className="text-neutral-400 hover:text-white"
                        >
                          Report
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: PURCHASES ─── */}
        {activeNav === 'purchases' && (
          <div className="space-y-4">
            {buyerOrders.length === 0 ? (
              <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-12 text-center">
                <ShoppingCart className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">No purchases yet</h3>
                <p className="text-xs text-neutral-400 mb-6">Find certified electronics backed by 7-day escrow inspection guarantee</p>
                <Link
                  href="/browse"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-950"
                >
                  Browse Marketplace
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {buyerOrders.map((o) => {
                  const badge = STATUS_BADGE[o.status] || { label: o.status, className: 'bg-neutral-800 text-neutral-400' };
                  return (
                    <div
                      key={o.id}
                      className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0 text-neutral-400">
                          <Package className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-neutral-400">Order #{o.id.substring(0, 8)}</span>
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', badge.className)}>
                              {badge.label}
                            </span>
                          </div>
                          <h4 className="font-bold text-white text-base">{o.listing?.title || o.listingTitle || 'Verified Device'}</h4>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            Purchased {new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-neutral-800 pt-3 md:pt-0">
                        <div className="text-left md:text-right">
                          <span className="text-[11px] text-neutral-400 uppercase tracking-wider block">Price Paid</span>
                          <span className="text-base font-bold text-white">{formatPrice(o.amount, o.currency)}</span>
                        </div>

                        <Link
                          href={`/orders/${o.id}/tracking`}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                        >
                          <Truck className="w-3.5 h-3.5" /> Track & Escrow
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 4: SALES ─── */}
        {activeNav === 'sales' && (
          <div className="space-y-4">
            {sellerOrders.length === 0 ? (
              <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-12 text-center">
                <ShoppingBag className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">No sales recorded yet</h3>
                <p className="text-xs text-neutral-400 mb-6">List electronics with verified IMEI checks to attract high-intent buyers</p>
                <Link
                  href="/listings/create"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-950"
                >
                  <Plus className="w-4 h-4" /> Create Listing
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {sellerOrders.map((o) => {
                  const badge = STATUS_BADGE[o.status] || { label: o.status, className: 'bg-neutral-800 text-neutral-400' };
                  return (
                    <div
                      key={o.id}
                      className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400">
                          <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-neutral-400">Sale #{o.id.substring(0, 8)}</span>
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', badge.className)}>
                              {badge.label}
                            </span>
                          </div>
                          <h4 className="font-bold text-white text-base">{o.listing?.title || o.listingTitle || 'Verified Device'}</h4>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            Buyer: {o.buyer?.displayName || 'VeriBuy Customer'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-neutral-800 pt-3 md:pt-0">
                        <div className="text-left md:text-right">
                          <span className="text-[11px] text-neutral-400 uppercase tracking-wider block">Payout Amount</span>
                          <span className="text-base font-bold text-emerald-400">{formatPrice(o.amount, o.currency)}</span>
                        </div>

                        <Link
                          href={`/orders/${o.id}/tracking`}
                          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs rounded-xl border border-neutral-700 transition-colors flex items-center gap-1.5"
                        >
                          View Order Details
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 5: EARNINGS & ESCROW ─── */}
        {activeNav === 'earnings' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
                <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-1">Total Lifetime Payouts</span>
                <p className="text-3xl font-bold text-white">{formatPrice(totalEarned, 'GBP')}</p>
                <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% Disbursed to Bank
                </p>
              </div>

              <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
                <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-1">Vaulted Escrow (Pending)</span>
                <p className="text-3xl font-bold text-emerald-400">{formatPrice(pendingEscrow, 'GBP')}</p>
                <p className="text-xs text-neutral-400 mt-2">
                  Releases automatically upon delivery inspection
                </p>
              </div>

              <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
                <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-1">Seller Commission Fee</span>
                <p className="text-3xl font-bold text-white">0%</p>
                <p className="text-xs text-neutral-400 mt-2">
                  VeriBuy charges buyers 0% seller commission
                </p>
              </div>
            </div>

            <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" /> Bank Payout Destination
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed mb-6 max-w-xl">
                Escrow payouts are settled directly into your linked bank account via Stripe Connect as soon as the buyer confirms delivery and inspection.
              </p>
              <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-400">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Stripe Express Payouts</p>
                    <p className="text-xs text-emerald-400">Connected & Verified</p>
                  </div>
                </div>
                <span className="text-xs text-neutral-400 bg-neutral-800 px-3 py-1 rounded-lg">Instant Settlement</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 6: ANALYTICS ─── */}
        {activeNav === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-white">Sales & Revenue Trajectory</h3>
                  <p className="text-xs text-neutral-400">Performance over the last 30 active trading days</p>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesChartData}>
                    <defs>
                      <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
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
                      formatter={(val: any) => [`£${val}`, 'Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#analyticsGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 7: PROFILE ─── */}
        {activeNav === 'profile' && (
          <div className="max-w-2xl bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6 sm:p-8">
            <h3 className="text-lg font-bold text-white mb-2">Public Profile Details</h3>
            <p className="text-xs text-neutral-400 mb-6">This information is shown to buyers and sellers on your transactions.</p>

            {profileSuccess && (
              <div role="status" className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs flex items-center gap-2 mb-6">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div role="alert" className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs flex items-center gap-2 mb-6">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={profileDisplayName}
                  onChange={(e) => setProfileDisplayName(e.target.value)}
                  placeholder={user?.name || 'Your name'}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1.5">First Name</label>
                  <input
                    type="text"
                    value={profileFirstName}
                    onChange={(e) => setProfileFirstName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1.5">Last Name</label>
                  <input
                    type="text"
                    value={profileLastName}
                    onChange={(e) => setProfileLastName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="+44 7700 900077"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1.5">Bio / Description</label>
                <textarea
                  rows={3}
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  placeholder="Electronics enthusiast selling verified gadgets..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={profileSaving}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-950 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {profileSaving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        )}

        {/* ─── TAB 8: SETTINGS & SECURITY ─── */}
        {activeNav === 'settings' && (
          <div className="space-y-6 max-w-2xl">
            {/* Security */}
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6 sm:p-8">
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" /> Change Password
              </h3>
              <p className="text-xs text-neutral-400 mb-6">Choose a strong, unique password to protect your account.</p>

              {securitySuccess && (
                <div role="status" className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs flex items-center gap-2 mb-6">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{securitySuccess}</span>
                </div>
              )}

              {securityError && (
                <div role="alert" className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs flex items-center gap-2 mb-6">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{securityError}</span>
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1.5">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1.5">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-50"
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>

            {/* Notification Toggles */}
            <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6 sm:p-8">
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-400" /> Notification Preferences
              </h3>
              <p className="text-xs text-neutral-400 mb-6">Control transactional and security email alerts.</p>

              <div className="space-y-4">
                {[
                  {
                    title: 'Order Status & Tracking',
                    desc: 'Receive alerts when orders ship or delivery is confirmed',
                    state: notifOrders,
                    setter: setNotifOrders,
                  },
                  {
                    title: 'Trust Lens™ Diagnostics',
                    desc: 'Get notified when your device completes carrier checks',
                    state: notifTrustLens,
                    setter: setNotifTrustLens,
                  },
                  {
                    title: 'Listing Updates & Inquiries',
                    desc: 'Buyer messages and listing status updates',
                    state: notifListingUpdates,
                    setter: setNotifListingUpdates,
                  },
                ].map((n) => (
                  <div key={n.title} className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800">
                    <div>
                      <p className="text-sm font-semibold text-white">{n.title}</p>
                      <p className="text-xs text-neutral-400">{n.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={n.state}
                      onChange={(e) => n.setter(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
          <div className="motion-safe:animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent"></div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
