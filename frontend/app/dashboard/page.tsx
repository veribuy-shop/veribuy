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
  UserCircle,
  Settings,
  Lock,
  Bell,
  Save,
  Sparkles,
  CheckCircle2,
  CreditCard,
  Building2,
  ArrowLeft,
  Sun,
  Moon,
  Store,
  Filter,
  MapPin,
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

const STATUS_BADGE: Record<string, { label: string; lightClass: string; darkClass: string }> = {
  PENDING:          { label: 'Unpaid / Pending', lightClass: 'bg-amber-50 text-amber-700 border-amber-200', darkClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  PAYMENT_RECEIVED: { label: 'Processing',       lightClass: 'bg-blue-50 text-blue-700 border-blue-200',   darkClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  ESCROW_HELD:      { label: 'Escrow Secured',   lightClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', darkClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  SHIPPED:          { label: 'In Transit',       lightClass: 'bg-purple-50 text-purple-700 border-purple-200', darkClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  DELIVERED:        { label: 'Delivered',        lightClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', darkClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  COMPLETED:        { label: 'Completed',        lightClass: 'bg-emerald-50 text-emerald-800 border-emerald-300', darkClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  CANCELLED:        { label: 'Cancelled',        lightClass: 'bg-gray-100 text-gray-700 border-gray-200', darkClass: 'bg-neutral-800 text-neutral-400 border-neutral-700' },
  REFUNDED:         { label: 'Refunded',         lightClass: 'bg-gray-100 text-gray-700 border-gray-200', darkClass: 'bg-neutral-800 text-neutral-400 border-neutral-700' },
  DISPUTED:         { label: 'In Dispute',       lightClass: 'bg-red-50 text-red-700 border-red-200',     darkClass: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const TRUST_BADGE: Record<string, { label: string; lightClass: string; darkClass: string }> = {
  PASSED:      { label: 'Verified Pass', lightClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', darkClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  IN_PROGRESS: { label: 'Checking IMEI', lightClass: 'bg-blue-50 text-blue-700 border-blue-200',         darkClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  FAILED:      { label: 'Flagged',       lightClass: 'bg-red-50 text-red-700 border-red-200',             darkClass: 'bg-red-500/10 text-red-400 border-red-500/20' },
  PENDING:     { label: 'Queued',        lightClass: 'bg-amber-50 text-amber-700 border-amber-200',       darkClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
};

const REVENUE_STATUSES = ['COMPLETED', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'PAYMENT_RECEIVED'];
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
 * Deduplicate multiple checkout attempts for the same listing.
 * Exactly 1 canonical order record is shown per unique listing.
 */
function deduplicateOrders(orders: Order[]): Order[] {
  const groups = new Map<string, Order[]>();

  for (const order of orders) {
    const key =
      order.listingId ||
      order.listing?.id ||
      (order.listingTitle ? `title:${order.listingTitle.trim().toLowerCase()}` : null) ||
      (order.listing?.title ? `title:${order.listing.title.trim().toLowerCase()}` : null) ||
      order.id;
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

function buildSalesChart(orders: Order[]): { date: string; revenue: number }[] {
  const days = 30;
  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    map.set(d.toISOString().split('T')[0], 0);
  }
  orders.filter((o) => REVENUE_STATUSES.includes(o.status)).forEach((o) => {
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
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [listings, setListings] = useState<Listing[]>([]);
  const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
  const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Listing filter & search state
  const [listingFilter, setListingFilter] = useState<string>('ALL');
  const [listingSearch, setListingSearch] = useState<string>('');

  // Purchase order filter state
  const [purchaseFilter, setPurchaseFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'PENDING'>('ALL');

  // Profile state
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [profileState, setProfileState] = useState('');
  const [profilePostalCode, setProfilePostalCode] = useState('');
  const [profileCountry, setProfileCountry] = useState('United Kingdom');
  const [profileLine1, setProfileLine1] = useState('');
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

  // Load theme preference per user
  useEffect(() => {
    if (!user?.id) return;
    try {
      const savedTheme = localStorage.getItem(`veribuy_dashboard_theme_${user.id}`);
      if (savedTheme) {
        setIsDarkMode(savedTheme === 'dark');
      } else {
        setIsDarkMode(false);
      }
    } catch {}
  }, [user?.id]);

  const setThemeMode = (mode: 'light' | 'dark') => {
    setIsDarkMode(mode === 'dark');
    if (!user?.id) return;
    try {
      localStorage.setItem(`veribuy_dashboard_theme_${user.id}`, mode);
    } catch {}
  };

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
        setListings(Array.isArray(d) ? d : d.data ?? []);
      }
      const sellerOrdVal = settleOk(sellerOrdRes);
      if (sellerOrdVal?.ok) {
        const d = await sellerOrdVal.json();
        const raw: Order[] = Array.isArray(d) ? d : d.data ?? [];
        const paidOnly = raw.filter((o) => o.status !== 'PENDING' && o.status !== 'CANCELLED');
        setSellerOrders(deduplicateOrders(paidOnly));
      }
      const buyerOrdVal = settleOk(buyerOrdRes);
      if (buyerOrdVal?.ok) {
        const d = await buyerOrdVal.json();
        const raw: Order[] = Array.isArray(d) ? d : d.data ?? [];
        const activeOnly = raw.filter((o) => {
          if (o.status === 'CANCELLED') return false;
          if (o.status === 'PENDING') {
            const elapsed = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60);
            return elapsed < 30;
          }
          return true;
        });
        setBuyerOrders(deduplicateOrders(activeOnly));
      }
      const verVal = settleOk(verRes);
      if (verVal?.ok) {
        const d = await verVal.json();
        setVerifications(Array.isArray(d) ? d : d.data ?? []);
      }
      const profileVal = settleOk(profileRes);
      if (profileVal?.ok) {
        const p = await profileVal.json();
        setProfileDisplayName(p.displayName ?? '');
        setProfileFirstName(p.firstName ?? '');
        setProfileLastName(p.lastName ?? '');
        setProfilePhone(p.phone ?? '');
        setProfileBio(p.bio ?? '');
        setProfileCity(p.address?.city ?? p.city ?? '');
        setProfileState(p.address?.state ?? '');
        setProfilePostalCode(p.address?.postalCode ?? '');
        setProfileCountry(p.address?.country ?? p.country ?? 'United Kingdom');
        setProfileLine1(p.address?.line1 ?? '');
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

  const handleNavClick = (nav: NavId) => {
    setActiveNav(nav);
    setSidebarOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', nav);
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  };

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
          city: profileCity,
          state: profileState,
          postalCode: profilePostalCode,
          country: profileCountry,
          line1: profileLine1,
        }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      setProfileSuccess('Profile and location updated successfully');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Error updating profile');
    } finally {
      setProfileSaving(false);
    }
  };

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

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this checkout attempt and release the item?')) return;
    try {
      const res = await authFetch(`/api/checkout/orders/${orderId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setBuyerOrders((prev) => prev.filter((o) => o.id !== orderId));
        setSellerOrders((prev) => prev.filter((o) => o.id !== orderId));
        await fetchAll();
      }
    } catch (err) {
      console.error('Failed to cancel order:', err);
    }
  };

  // Metrics
  const activeListingsCount = listings.filter((l) => l.status === 'ACTIVE').length;
  const inTransitPurchases = buyerOrders.filter((o) => o.status === 'SHIPPED').length;
  const totalEarned = sellerOrders
    .filter((o) => ['COMPLETED', 'ESCROW_HELD', 'DELIVERED'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const pendingEscrow = sellerOrders
    .filter((o) => ['ESCROW_HELD', 'SHIPPED', 'DELIVERED'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);

  const salesChartData = buildSalesChart(sellerOrders);

  const filteredListings = listings.filter((l) => {
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

  const filteredBuyerOrders = buyerOrders.filter((o) => {
    if (purchaseFilter === 'ACTIVE') return ['ESCROW_HELD', 'PAYMENT_RECEIVED', 'SHIPPED', 'DELIVERED'].includes(o.status);
    if (purchaseFilter === 'COMPLETED') return o.status === 'COMPLETED';
    if (purchaseFilter === 'PENDING') return o.status === 'PENDING';
    return true;
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
    <div
      className={cn(
        'min-h-screen flex flex-col md:flex-row transition-colors duration-150',
        isDarkMode
          ? 'bg-neutral-950 text-neutral-100'
          : 'bg-slate-50 text-slate-900'
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
          aria-label="Toggle navigation menu"
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
          isDarkMode
            ? 'bg-neutral-900/95 border-neutral-800'
            : 'bg-white/95 border-slate-200 shadow-sm',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div>
          {/* Logo & Home Link */}
          <div className="hidden md:flex items-center justify-between mb-6">
            <Link href="/" title="Back to VeriBuy Home" className="group flex items-center gap-2">
              <BrandLogo />
            </Link>
          </div>

          {/* Back to Marketplace Button */}
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

          {/* User Profile Mini Card */}
          <div
            className={cn(
              'border rounded-2xl p-4 mb-6',
              isDarkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-bold truncate', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  {user?.name || 'VeriBuy User'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-[11px] text-emerald-600 font-semibold">Verified Account</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1" aria-label="Dashboard tabs">
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
                      ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-600/20'
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
                        'px-2 py-0.5 rounded-full text-xs font-mono font-semibold',
                        isActive
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
          <Link
            href="/listings/create"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs uppercase tracking-wider shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Listing
          </Link>
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

      {/* Main Workspace */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        {/* Top greeting bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className={cn('text-2xl sm:text-3xl font-bold tracking-tight', isDarkMode ? 'text-white' : 'text-slate-900')}>
                {activeNav === 'dashboard' && 'Dashboard Overview'}
                {activeNav === 'listings' && 'Inventory & Listings'}
                {activeNav === 'purchases' && 'My Purchases'}
                {activeNav === 'sales' && 'Sales & Fulfillment'}
                {activeNav === 'earnings' && 'Escrow & Payouts'}
                {activeNav === 'analytics' && 'Performance Analytics'}
                {activeNav === 'profile' && 'Public Profile'}
                {activeNav === 'settings' && 'Account & Security'}
              </h1>
            </div>
            <p className={cn('text-sm mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
              Welcome back, <span className={cn('font-semibold', isDarkMode ? 'text-white' : 'text-slate-800')}>{user?.name}</span>. All your transactions are secured by VeriBuy Escrow.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/browse"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border transition-colors',
                isDarkMode
                  ? 'bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
              )}
            >
              <Store className="w-4 h-4" /> Browse Shop
            </Link>
            <Link
              href="/listings/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
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
              <div
                className={cn(
                  'border rounded-2xl p-5 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <div className={cn('flex items-center justify-between text-xs uppercase tracking-wider mb-2', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  <span>Total Sales</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <p className={cn('text-2xl font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  {formatPrice(totalEarned, 'GBP')}
                </p>
                <p className="text-xs text-emerald-600 mt-1 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> 0% seller commission
                </p>
              </div>

              <div
                className={cn(
                  'border rounded-2xl p-5 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <div className={cn('flex items-center justify-between text-xs uppercase tracking-wider mb-2', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  <span>Active Listings</span>
                  <List className="w-4 h-4 text-blue-600" />
                </div>
                <p className={cn('text-2xl font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  {activeListingsCount}
                </p>
                <p className={cn('text-xs mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  {listings.length} total items listed
                </p>
              </div>

              <div
                className={cn(
                  'border rounded-2xl p-5 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <div className={cn('flex items-center justify-between text-xs uppercase tracking-wider mb-2', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  <span>Purchases In Transit</span>
                  <Truck className="w-4 h-4 text-purple-600" />
                </div>
                <p className={cn('text-2xl font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  {inTransitPurchases}
                </p>
                <p className={cn('text-xs mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  {buyerOrders.length} total purchases
                </p>
              </div>

              <div
                className={cn(
                  'border rounded-2xl p-5 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <div className={cn('flex items-center justify-between text-xs uppercase tracking-wider mb-2', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  <span>Vaulted Escrow</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatPrice(pendingEscrow, 'GBP')}
                </p>
                <p className={cn('text-xs mt-1', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Safe in vault
                </p>
              </div>
            </div>

            {/* Sales Chart & Reassurance Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sales Chart (2 cols) */}
              <div
                className={cn(
                  'lg:col-span-2 border rounded-3xl p-6 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className={cn('text-base font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                      30-Day Sales Volume
                    </h2>
                    <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                      Cumulative sales and escrow releases
                    </p>
                  </div>
                  <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 font-semibold">
                    Real-time
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="emeraldGradDash" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#262626' : '#f1f5f9'} />
                      <XAxis dataKey="date" stroke={isDarkMode ? '#737373' : '#94a3b8'} fontSize={11} tickLine={false} />
                      <YAxis stroke={isDarkMode ? '#737373' : '#94a3b8'} fontSize={11} tickLine={false} tickFormatter={(v) => `£${v}`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDarkMode ? '#171717' : '#ffffff',
                          borderColor: isDarkMode ? '#262626' : '#e2e8f0',
                          borderRadius: '12px',
                          color: isDarkMode ? '#fff' : '#0f172a',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        }}
                        formatter={(val: any) => [`£${val}`, 'Revenue']}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#emeraldGradDash)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Trust Reassurance Side Cards */}
              <div className="space-y-4">
                <div
                  className={cn(
                    'border rounded-3xl p-6 shadow-sm',
                    isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                  )}
                >
                  <h3 className={cn('text-sm font-bold mb-3 flex items-center gap-2', isDarkMode ? 'text-white' : 'text-slate-900')}>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> Trust Lens™ Diagnostics
                  </h3>
                  <p className={cn('text-xs leading-relaxed mb-4', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    All electronics on VeriBuy undergo cryptographic IMEI checks, GSMA blacklist scans, and activation lock verification.
                  </p>
                  <Link
                    href="/how-it-works"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                  >
                    View verification protocol <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div
                  className={cn(
                    'border rounded-3xl p-6 shadow-sm',
                    isDarkMode
                      ? 'bg-gradient-to-br from-emerald-950/40 via-neutral-900 to-neutral-900 border-emerald-500/20'
                      : 'bg-gradient-to-br from-emerald-50 via-white to-white border-emerald-200'
                  )}
                >
                  <h3 className={cn('text-sm font-bold mb-1', isDarkMode ? 'text-white' : 'text-slate-900')}>
                    0% Seller Commission
                  </h3>
                  <p className={cn('text-xs mb-4', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                    You keep 100% of your selling price with guaranteed escrow payouts.
                  </p>
                  <Link
                    href="/listings/create"
                    className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
                  >
                    Create New Listing
                  </Link>
                </div>
              </div>
            </div>

            {/* Recent Orders Preview */}
            <div
              className={cn(
                'border rounded-3xl p-6 shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className={cn('text-base font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  Recent Purchases & Checkouts
                </h2>
                <button
                  onClick={() => setActiveNav('purchases')}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                >
                  View All ({buyerOrders.length})
                </button>
              </div>

              {buyerOrders.length === 0 ? (
                <div className={cn('text-center py-8 text-sm', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  No purchases yet.{' '}
                  <Link href="/browse" className="text-emerald-600 underline font-medium">
                    Browse verified electronics
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {buyerOrders.slice(0, 3).map((o) => {
                    const badge = STATUS_BADGE[o.status] || {
                      label: o.status,
                      lightClass: 'bg-slate-100 text-slate-700 border-slate-200',
                      darkClass: 'bg-neutral-800 text-neutral-400',
                    };
                    return (
                      <div
                        key={o.id}
                        className={cn(
                          'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border transition-colors',
                          isDarkMode
                            ? 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
                            : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                        )}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn('font-mono text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                              #{o.id.substring(0, 8)}
                            </span>
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold border', isDarkMode ? badge.darkClass : badge.lightClass)}>
                              {badge.label}
                            </span>
                          </div>
                          <p className={cn('text-sm font-semibold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                            {o.listing?.title || o.listingTitle || 'Verified Device'}
                          </p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <span className="text-sm font-bold text-emerald-600">
                            {formatPrice(o.amount, o.currency)}
                          </span>
                          <Link
                            href={`/orders/${o.id}/tracking`}
                            className={cn(
                              'inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors',
                              isDarkMode
                                ? 'bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                            )}
                          >
                            Track <ArrowUpRight className="w-3.5 h-3.5" />
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
            <div
              className={cn(
                'flex flex-col sm:flex-row sm:items-center justify-between gap-4 border rounded-2xl p-4 shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                {['ALL', 'ACTIVE', 'REVIEW', 'SOLD'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setListingFilter(f)}
                    className={cn(
                      'px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors',
                      listingFilter === f
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : isDarkMode
                        ? 'bg-neutral-800 text-neutral-400 hover:text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search listings..."
                  value={listingSearch}
                  onChange={(e) => setListingSearch(e.target.value)}
                  className={cn(
                    'border rounded-xl pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:border-emerald-500 w-full sm:w-60',
                    isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  )}
                />
              </div>
            </div>

            {filteredListings.length === 0 ? (
              <div
                className={cn(
                  'border rounded-3xl p-12 text-center shadow-sm',
                  isDarkMode ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <List className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h3 className={cn('text-lg font-bold mb-1', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  No listings found
                </h3>
                <p className={cn('text-xs mb-6', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Create a verified listing with 0% seller fees
                </p>
                <Link
                  href="/listings/create"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-emerald-500 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create Listing
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredListings.map((l) => {
                  const trust = TRUST_BADGE[l.trustLensStatus] || {
                    label: l.trustLensStatus,
                    lightClass: 'bg-slate-100 text-slate-700 border-slate-200',
                    darkClass: 'bg-neutral-800 text-neutral-400',
                  };
                  return (
                    <div
                      key={l.id}
                      className={cn(
                        'border rounded-2xl p-5 flex flex-col justify-between shadow-sm transition-all',
                        isDarkMode
                          ? 'bg-neutral-900/70 border-neutral-800 hover:border-neutral-700'
                          : 'bg-white border-slate-200 hover:border-emerald-300'
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold border', isDarkMode ? trust.darkClass : trust.lightClass)}>
                            {trust.label}
                          </span>
                          <span className="text-sm font-bold text-emerald-600">{formatPrice(l.price, l.currency)}</span>
                        </div>
                        <h3 className={cn('font-bold text-sm line-clamp-1 mb-1', isDarkMode ? 'text-white' : 'text-slate-900')}>
                          {l.title}
                        </h3>
                        <p className={cn('text-xs mb-4', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                          {l.brand} &bull; {l.model}
                        </p>
                      </div>

                      <div className={cn('pt-3 border-t flex items-center justify-between text-xs font-semibold', isDarkMode ? 'border-neutral-800' : 'border-slate-100')}>
                        <Link
                          href={`/listings/${l.id}`}
                          className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                        >
                          View Listing <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          href={`/verification/${l.id}`}
                          className={isDarkMode ? 'text-neutral-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}
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
            {/* Filter toolbar */}
            <div
              className={cn(
                'flex items-center gap-2 border rounded-2xl p-3 overflow-x-auto shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              {[
                { id: 'ALL', label: `All Orders (${buyerOrders.length})` },
                { id: 'ACTIVE', label: 'Active in Escrow' },
                { id: 'COMPLETED', label: 'Completed' },
                { id: 'PENDING', label: 'Unpaid Checkouts' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPurchaseFilter(f.id as any)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors',
                    purchaseFilter === f.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isDarkMode
                      ? 'bg-neutral-800 text-neutral-400 hover:text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredBuyerOrders.length === 0 ? (
              <div
                className={cn(
                  'border rounded-3xl p-12 text-center shadow-sm',
                  isDarkMode ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <ShoppingCart className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h3 className={cn('text-lg font-bold mb-1', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  No matching purchases found
                </h3>
                <p className={cn('text-xs mb-6', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Find certified electronics backed by 48-hour (2 days) escrow inspection guarantee
                </p>
                <Link
                  href="/browse"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-emerald-500 transition-colors"
                >
                  Browse Marketplace
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBuyerOrders.map((o) => {
                  const badge = STATUS_BADGE[o.status] || {
                    label: o.status,
                    lightClass: 'bg-slate-100 text-slate-700 border-slate-200',
                    darkClass: 'bg-neutral-800 text-neutral-400',
                  };
                  return (
                    <div
                      key={o.id}
                      className={cn(
                        'border rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm',
                        isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border',
                            isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                          )}
                        >
                          <Package className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn('font-mono text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                              Order #{o.id.substring(0, 8)}
                            </span>
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold border', isDarkMode ? badge.darkClass : badge.lightClass)}>
                              {badge.label}
                            </span>
                          </div>
                          <h4 className={cn('font-bold text-base', isDarkMode ? 'text-white' : 'text-slate-900')}>
                            {o.listing?.title || o.listingTitle || 'Verified Device'}
                          </h4>
                          <p className={cn('text-xs mt-0.5', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                            Created {new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <div
                        className={cn(
                          'flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0',
                          isDarkMode ? 'border-neutral-800' : 'border-slate-100'
                        )}
                      >
                        <div className="text-left md:text-right">
                          <span className={cn('text-[11px] uppercase tracking-wider block font-semibold', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                            Amount
                          </span>
                          <span className="text-base font-bold text-emerald-600">
                            {formatPrice(o.amount, o.currency)}
                          </span>
                        </div>

                        {o.status === 'PENDING' ? (
                          (() => {
                            const createdAtMs = new Date(o.createdAt).getTime();
                            const elapsedMinutes = Math.floor((Date.now() - createdAtMs) / (1000 * 60));
                            const remainingMinutes = Math.max(0, 30 - elapsedMinutes);
                            const isExpired = remainingMinutes <= 0;

                            if (isExpired) {
                              return (
                                <div className="flex items-center gap-2">
                                  <span className={cn('text-xs font-medium px-2 py-1 rounded-lg border', isDarkMode ? 'bg-neutral-800 text-neutral-400 border-neutral-700' : 'bg-slate-100 text-slate-500 border-slate-200')}>
                                    Expired (30m passed)
                                  </span>
                                  <button
                                    onClick={() => handleCancelOrder(o.id)}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold text-xs rounded-xl transition-colors"
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                                  {remainingMinutes}m left
                                </span>
                                <Link
                                  href={`/checkout?listingId=${o.listingId || ''}&resume=true`}
                                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
                                >
                                  Resume
                                </Link>
                                <button
                                  onClick={() => handleCancelOrder(o.id)}
                                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-xs rounded-xl transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            );
                          })()
                        ) : (
                          <Link
                            href={`/orders/${o.id}/tracking`}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                          >
                            <Truck className="w-3.5 h-3.5" /> Track & Escrow
                          </Link>
                        )}
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
              <div
                className={cn(
                  'border rounded-3xl p-12 text-center shadow-sm',
                  isDarkMode ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <ShoppingBag className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h3 className={cn('text-lg font-bold mb-1', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  No sales recorded yet
                </h3>
                <p className={cn('text-xs mb-6', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  List electronics with verified IMEI checks to attract buyers
                </p>
                <Link
                  href="/listings/create"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-emerald-500 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create Listing
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {sellerOrders.map((o) => {
                  const badge = STATUS_BADGE[o.status] || {
                    label: o.status,
                    lightClass: 'bg-slate-100 text-slate-700 border-slate-200',
                    darkClass: 'bg-neutral-800 text-neutral-400',
                  };
                  return (
                    <div
                      key={o.id}
                      className={cn(
                        'border rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm',
                        isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-600">
                          <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn('font-mono text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                              Sale #{o.id.substring(0, 8)}
                            </span>
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold border', isDarkMode ? badge.darkClass : badge.lightClass)}>
                              {badge.label}
                            </span>
                          </div>
                          <h4 className={cn('font-bold text-base', isDarkMode ? 'text-white' : 'text-slate-900')}>
                            {o.listing?.title || o.listingTitle || 'Verified Device'}
                          </h4>
                          <p className={cn('text-xs mt-0.5', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                            Buyer: {o.buyer?.displayName || 'VeriBuy Customer'}
                          </p>
                        </div>
                      </div>

                      <div
                        className={cn(
                          'flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0',
                          isDarkMode ? 'border-neutral-800' : 'border-slate-100'
                        )}
                      >
                        <div className="text-left md:text-right">
                          <span className={cn('text-[11px] uppercase tracking-wider block font-semibold', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                            Payout
                          </span>
                          <span className="text-base font-bold text-emerald-600">
                            {formatPrice(o.amount, o.currency)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {o.status === 'PENDING' && (
                            <button
                              onClick={() => handleCancelOrder(o.id)}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-xs rounded-xl transition-colors"
                            >
                              Cancel Attempt
                            </button>
                          )}
                          <Link
                            href={`/orders/${o.id}/tracking`}
                            className={cn(
                              'px-4 py-2 font-semibold text-xs rounded-xl border transition-colors flex items-center gap-1.5 shadow-sm',
                              isDarkMode
                                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                            )}
                          >
                            View Order
                          </Link>
                        </div>
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
              <div
                className={cn(
                  'border rounded-3xl p-6 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <span className={cn('text-xs uppercase tracking-wider block mb-1 font-semibold', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Total Lifetime Payouts
                </span>
                <p className={cn('text-3xl font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  {formatPrice(totalEarned, 'GBP')}
                </p>
                <p className="text-xs text-emerald-600 mt-2 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% Disbursed to Bank
                </p>
              </div>

              <div
                className={cn(
                  'border rounded-3xl p-6 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <span className={cn('text-xs uppercase tracking-wider block mb-1 font-semibold', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Vaulted Escrow (Pending)
                </span>
                <p className="text-3xl font-bold text-emerald-600">{formatPrice(pendingEscrow, 'GBP')}</p>
                <p className={cn('text-xs mt-2', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Releases upon buyer inspection
                </p>
              </div>

              <div
                className={cn(
                  'border rounded-3xl p-6 shadow-sm',
                  isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
                )}
              >
                <span className={cn('text-xs uppercase tracking-wider block mb-1 font-semibold', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Seller Commission Fee
                </span>
                <p className={cn('text-3xl font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>0%</p>
                <p className={cn('text-xs mt-2', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  VeriBuy charges 0% seller commission
                </p>
              </div>
            </div>

            <div
              className={cn(
                'border rounded-3xl p-6 shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <h3 className={cn('text-base font-bold mb-4 flex items-center gap-2', isDarkMode ? 'text-white' : 'text-slate-900')}>
                <Building2 className="w-5 h-5 text-emerald-600" /> Bank Payout Account
              </h3>
              <p className={cn('text-xs leading-relaxed mb-6 max-w-xl', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                Escrow funds disburse directly into your verified bank account via Stripe Connect as soon as delivery and condition are confirmed.
              </p>
              <div
                className={cn(
                  'p-4 rounded-2xl border flex items-center justify-between',
                  isDarkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', isDarkMode ? 'bg-neutral-800 text-neutral-400' : 'bg-white text-slate-700 shadow-sm')}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={cn('text-sm font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>Stripe Express Direct Payouts</p>
                    <p className="text-xs text-emerald-600 font-semibold">Active & Connected</p>
                  </div>
                </div>
                <span className={cn('text-xs px-3 py-1 rounded-lg border font-semibold', isDarkMode ? 'bg-neutral-800 text-neutral-400 border-neutral-700' : 'bg-white text-slate-600 border-slate-200')}>
                  Instant Settlement
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 6: ANALYTICS ─── */}
        {activeNav === 'analytics' && (
          <div className="space-y-6">
            <div
              className={cn(
                'border rounded-3xl p-6 shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <h3 className={cn('text-base font-bold mb-6', isDarkMode ? 'text-white' : 'text-slate-900')}>
                Sales & Revenue Trajectory (30 Days)
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#262626' : '#f1f5f9'} />
                    <XAxis dataKey="date" stroke={isDarkMode ? '#737373' : '#94a3b8'} fontSize={11} />
                    <YAxis stroke={isDarkMode ? '#737373' : '#94a3b8'} tickFormatter={(v) => `£${v}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDarkMode ? '#171717' : '#ffffff',
                        borderColor: isDarkMode ? '#262626' : '#e2e8f0',
                        borderRadius: '12px',
                        color: isDarkMode ? '#fff' : '#0f172a',
                      }}
                      formatter={(val: any) => [`£${val}`, 'Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2.5} fill="#059669" fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 7: PROFILE ─── */}
        {activeNav === 'profile' && (
          <div
            className={cn(
              'max-w-2xl border rounded-3xl p-6 sm:p-8 shadow-sm',
              isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
            )}
          >
            <h3 className={cn('text-lg font-bold mb-2', isDarkMode ? 'text-white' : 'text-slate-900')}>
              Public Profile Details
            </h3>
            <p className={cn('text-xs mb-6', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
              This information is shown to buyers and sellers on your transactions.
            </p>

            {profileSuccess && (
              <div role="status" className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs font-semibold flex items-center gap-2 mb-6">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold flex items-center gap-2 mb-6">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className={cn('text-xs font-semibold block mb-1.5', isDarkMode ? 'text-neutral-300' : 'text-slate-700')}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={profileDisplayName}
                  onChange={(e) => setProfileDisplayName(e.target.value)}
                  placeholder={user?.name || 'Your name'}
                  className={cn(
                    'w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500',
                    isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={cn('text-xs font-semibold block mb-1.5', isDarkMode ? 'text-neutral-300' : 'text-slate-700')}>
                    First Name
                  </label>
                  <input
                    type="text"
                    value={profileFirstName}
                    onChange={(e) => setProfileFirstName(e.target.value)}
                    className={cn(
                      'w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500',
                      isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    )}
                  />
                </div>
                <div>
                  <label className={cn('text-xs font-semibold block mb-1.5', isDarkMode ? 'text-neutral-300' : 'text-slate-700')}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={profileLastName}
                    onChange={(e) => setProfileLastName(e.target.value)}
                    className={cn(
                      'w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500',
                      isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    )}
                  />
                </div>
              </div>

              <div>
                <label className={cn('text-xs font-semibold block mb-1.5', isDarkMode ? 'text-neutral-300' : 'text-slate-700')}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="+44 7700 900077"
                  className={cn(
                    'w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500',
                    isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  )}
                />
              </div>

              <div>
                <label className={cn('text-xs font-semibold block mb-1.5', isDarkMode ? 'text-neutral-300' : 'text-slate-700')}>
                  Bio / Description
                </label>
                <textarea
                  rows={3}
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  placeholder="Electronics enthusiast selling verified gadgets..."
                  className={cn(
                    'w-full border rounded-xl p-4 text-sm focus:outline-none focus:border-emerald-500 resize-none',
                    isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  )}
                />
              </div>

              {/* Location & Shipping Origin Card */}
              <div className={cn('border rounded-2xl p-5 space-y-4', isDarkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50/80 border-slate-200')}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={cn('text-sm font-bold', isDarkMode ? 'text-white' : 'text-slate-900')}>
                      Dispatch Location &amp; Shipping Address
                    </h4>
                    <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                      Displayed on your listings as the origin (e.g. &quot;Ships from London, UK&quot;) and used for shipping.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div>
                    <label className={cn('text-xs font-semibold block mb-1', isDarkMode ? 'text-neutral-300' : 'text-slate-700')}>
                      City / Town
                    </label>
                    <input
                      type="text"
                      value={profileCity}
                      onChange={(e) => setProfileCity(e.target.value)}
                      placeholder="e.g. London, Manchester, Leeds"
                      className={cn(
                        'w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500',
                        isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn('text-xs font-semibold block mb-1', isDarkMode ? 'text-neutral-300' : 'text-slate-700')}>
                      County / Region
                    </label>
                    <input
                      type="text"
                      value={profileState}
                      onChange={(e) => setProfileState(e.target.value)}
                      placeholder="e.g. Greater London, West Midlands"
                      className={cn(
                        'w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500',
                        isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className={cn('text-xs font-semibold block mb-1', isDarkMode ? 'text-neutral-300' : 'text-slate-700')}>
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={profilePostalCode}
                      onChange={(e) => setProfilePostalCode(e.target.value)}
                      placeholder="e.g. SW1A 1AA"
                      className={cn(
                        'w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500',
                        isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn('text-xs font-semibold block mb-1', isDarkMode ? 'text-neutral-300' : 'text-slate-700')}>
                      Country
                    </label>
                    <input
                      type="text"
                      value={profileCountry}
                      onChange={(e) => setProfileCountry(e.target.value)}
                      placeholder="United Kingdom"
                      className={cn(
                        'w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500',
                        isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      )}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={profileSaving}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {profileSaving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        )}

        {/* ─── TAB 8: SETTINGS & SECURITY ─── */}
        {activeNav === 'settings' && (
          <div className="space-y-6 max-w-2xl">
            {/* Dashboard Appearance Theme */}
            <div
              className={cn(
                'border rounded-3xl p-6 sm:p-8 shadow-sm space-y-4',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <div>
                <h3 className={cn('text-base font-bold mb-1 flex items-center gap-2', isDarkMode ? 'text-white' : 'text-slate-900')}>
                  <Sparkles className="w-4 h-4 text-emerald-600" /> Dashboard Appearance
                </h3>
                <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                  Choose your preferred color theme across all dashboard views.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={cn(
                    'p-4 rounded-2xl border flex items-center justify-center gap-2 font-semibold text-xs transition-all',
                    !isDarkMode
                      ? 'bg-emerald-50/50 border-emerald-600 text-emerald-700 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                  )}
                >
                  <Sun className="w-4 h-4 text-amber-500" /> Light Mode (Default)
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={cn(
                    'p-4 rounded-2xl border flex items-center justify-center gap-2 font-semibold text-xs transition-all',
                    isDarkMode
                      ? 'bg-neutral-950 border-emerald-500 text-emerald-400 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                  )}
                >
                  <Moon className="w-4 h-4 text-purple-500" /> Dark Mode
                </button>
              </div>
            </div>

            {/* Security */}
            <div
              className={cn(
                'border rounded-3xl p-6 sm:p-8 shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <h3 className={cn('text-base font-bold mb-2 flex items-center gap-2', isDarkMode ? 'text-white' : 'text-slate-900')}>
                <Lock className="w-4 h-4 text-emerald-600" /> Change Password
              </h3>
              <p className={cn('text-xs mb-6', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                Choose a strong password to protect your account.
              </p>

              {securitySuccess && (
                <div role="status" className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs font-semibold flex items-center gap-2 mb-6">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{securitySuccess}</span>
                </div>
              )}

              {securityError && (
                <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold flex items-center gap-2 mb-6">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{securityError}</span>
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className={cn('text-xs font-semibold block mb-1.5', isDarkMode ? 'text-neutral-300' : 'text-slate-700')}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={cn(
                      'w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500',
                      isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    )}
                  />
                </div>
                <div>
                  <label className={cn('text-xs font-semibold block mb-1.5', isDarkMode ? 'text-neutral-300' : 'text-slate-700')}>
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={cn(
                      'w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500',
                      isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    )}
                  />
                </div>
                <div>
                  <label className={cn('text-xs font-semibold block mb-1.5', isDarkMode ? 'text-neutral-300' : 'text-slate-700')}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className={cn(
                      'w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500',
                      isDarkMode ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    )}
                  />
                </div>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>

            {/* Notification Toggles */}
            <div
              className={cn(
                'border rounded-3xl p-6 sm:p-8 shadow-sm',
                isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200'
              )}
            >
              <h3 className={cn('text-base font-bold mb-2 flex items-center gap-2', isDarkMode ? 'text-white' : 'text-slate-900')}>
                <Bell className="w-4 h-4 text-emerald-600" /> Notification Preferences
              </h3>
              <p className={cn('text-xs mb-6', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>
                Manage your transactional and security email alerts.
              </p>

              <div className="space-y-3">
                {[
                  {
                    title: 'Order Status & Escrow Tracking',
                    desc: 'Receive alerts when orders ship or funds are released',
                    state: notifOrders,
                    setter: setNotifOrders,
                  },
                  {
                    title: 'Trust Lens™ Diagnostics',
                    desc: 'Get notified when your device completes carrier audits',
                    state: notifTrustLens,
                    setter: setNotifTrustLens,
                  },
                  {
                    title: 'Listing Updates & Inquiries',
                    desc: 'Buyer inquiries and listing state updates',
                    state: notifListingUpdates,
                    setter: setNotifListingUpdates,
                  },
                ].map((n) => (
                  <div
                    key={n.title}
                    className={cn(
                      'flex items-center justify-between p-3.5 rounded-2xl border',
                      isDarkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200'
                    )}
                  >
                    <div>
                      <p className={cn('text-sm font-semibold', isDarkMode ? 'text-white' : 'text-slate-900')}>{n.title}</p>
                      <p className={cn('text-xs', isDarkMode ? 'text-neutral-400' : 'text-slate-500')}>{n.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={n.state}
                      onChange={(e) => n.setter(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer"
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="motion-safe:animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent"></div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
