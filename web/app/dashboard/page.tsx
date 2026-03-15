'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  shippedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  buyer?: { displayName: string; email: string } | null;
  seller?: { displayName: string; email: string } | null;
  listing?: { title: string; brand: string; model: string } | null;
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
  PENDING:          { label: 'Pending',    className: 'bg-amber-100 text-amber-800' },
  PAYMENT_RECEIVED: { label: 'Processing', className: 'bg-blue-100 text-blue-800' },
  ESCROW_HELD:      { label: 'In Escrow',  className: 'bg-blue-100 text-blue-800' },
  SHIPPED:          { label: 'Shipped',    className: 'bg-purple-100 text-purple-800' },
  DELIVERED:        { label: 'Delivered',  className: 'bg-indigo-100 text-indigo-800' },
  COMPLETED:        { label: 'Completed',  className: 'bg-green-100 text-green-800' },
  CANCELLED:        { label: 'Cancelled',  className: 'bg-gray-100 text-gray-600' },
  REFUNDED:         { label: 'Refunded',   className: 'bg-gray-100 text-gray-600' },
  DISPUTED:         { label: 'Disputed',   className: 'bg-red-100 text-red-700' },
};

const TRUST_BADGE: Record<string, { label: string; className: string }> = {
  PASSED:      { label: 'Verified',    className: 'bg-green-100 text-green-800' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-blue-100 text-blue-800' },
  FAILED:      { label: 'Failed',      className: 'bg-red-100 text-red-700' },
  PENDING:     { label: 'Pending',     className: 'bg-amber-100 text-amber-800' },
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
            'w-4 h-4',
            i <= Math.floor(value)
              ? 'text-amber-400 fill-amber-400'
              : i - 0.5 <= value
                ? 'text-amber-400 fill-amber-200'
                : 'text-[var(--color-border)] fill-[var(--color-surface-alt)]',
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

function DashboardContent() {
  const { user, logout, authFetch } = useAuth();
  const searchParams = useSearchParams();
  const validTabs: NavId[] = ['dashboard', 'purchases', 'listings', 'sales', 'earnings', 'analytics', 'profile', 'settings'];
  const initialTab = validTabs.includes(searchParams.get('tab') as NavId) ? (searchParams.get('tab') as NavId) : 'dashboard';
  const [activeNav, setActiveNav] = useState<NavId>(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [listings, setListings] = useState<Listing[]>([]);
  const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
  const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [profileLoaded, setProfileLoaded] = useState(false);

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
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifPriceAlerts, setNotifPriceAlerts] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [listRes, sellerOrdRes, buyerOrdRes, verRes, profileRes] = await Promise.all([
        authFetch(`/api/listings?sellerId=${user.id}`),
        authFetch(`/api/checkout/orders/seller/${user.id}`),
        authFetch(`/api/checkout/orders/buyer/${user.id}`),
        authFetch('/api/trust-lens?limit=100'),
        fetch(`/api/users/${user.id}/profile`, { credentials: 'include' }),
      ]);
      if (listRes.ok) {
        const d = await listRes.json();
        setListings(Array.isArray(d) ? d : (d.data ?? []));
      }
      if (sellerOrdRes.ok) {
        const d = await sellerOrdRes.json();
        setSellerOrders(Array.isArray(d) ? d : (d.data ?? []));
      }
      if (buyerOrdRes.ok) {
        const d = await buyerOrdRes.json();
        setBuyerOrders(Array.isArray(d) ? d : (d.data ?? []));
      }
      if (verRes.ok) {
        const d = await verRes.json();
        setVerifications(Array.isArray(d) ? d : (d.data ?? []));
      }
      if (profileRes.ok) {
        const p = await profileRes.json();
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

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Rating submission ──
  const openRatingModal = (orderId: string) => {
    setRatingOrderId(orderId);
    setRatingValue(0);
    setRatingHover(0);
    setRatingComment('');
    setRatingError('');
  };

  const closeRatingModal = () => {
    setRatingOrderId(null);
    setRatingValue(0);
    setRatingHover(0);
    setRatingComment('');
    setRatingError('');
  };

  const handleRatingSubmit = async () => {
    if (!ratingOrderId || ratingValue < 1) return;
    setRatingSubmitting(true);
    setRatingError('');
    try {
      const res = await fetch(`/api/checkout/orders/${ratingOrderId}/rate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: ratingValue,
          ...(ratingComment.trim() && { comment: ratingComment.trim() }),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit rating');
      }
      setRatedOrders(prev => new Set(prev).add(ratingOrderId));
      closeRatingModal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit rating';
      setRatingError(message);
    } finally {
      setRatingSubmitting(false);
    }
  };

  // ── Profile fetch/save ──
  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    setProfileLoading(true);
    setProfileError('');
    try {
      const res = await fetch(`/api/users/${user.id}/profile`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setProfileDisplayName(data.displayName ?? '');
        setProfileFirstName(data.firstName ?? '');
        setProfileLastName(data.lastName ?? '');
        setProfilePhone(data.phone ?? '');
        setProfileBio(data.bio ?? '');
      } else if (res.status === 404) {
        // No profile yet -- seed from auth context
        const name = user.name ?? '';
        const parts = name.split(' ');
        setProfileFirstName(parts[0] ?? '');
        setProfileLastName(parts.slice(1).join(' '));
        setProfileDisplayName(name);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setProfileError('Failed to load profile');
    } finally {
      setProfileLoading(false);
      setProfileLoaded(true);
    }
  }, [user?.id, user?.name]);

  // Load profile when navigating to profile tab
  useEffect(() => {
    if (activeNav === 'profile' && !profileLoaded) {
      fetchProfile();
    }
  }, [activeNav, profileLoaded, fetchProfile]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');
    setProfileSaving(true);
    try {
      const res = await fetch(`/api/users/${user?.id}/profile`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: profileDisplayName.trim() || `${profileFirstName} ${profileLastName}`.trim(),
          firstName: profileFirstName.trim(),
          lastName: profileLastName.trim(),
          phone: profilePhone.trim(),
          bio: profileBio.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save profile');
      }
      setProfileSuccess('Profile updated successfully!');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save profile';
      setProfileError(message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecuritySuccess('');
    setSecurityError('');
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setSecurityError('Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 8) {
      setSecurityError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setSecurityError('New passwords do not match.');
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setSecuritySuccess('Password updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => setSecuritySuccess(''), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setSecurityError(data.error || data.message || 'Failed to update password.');
      }
    } catch {
      setSecurityError('An error occurred. Please try again.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── Computed stats ──
  const totalSales = sellerOrders
    .filter(o => REVENUE_STATUSES.includes(o.status))
    .reduce((sum, o) => sum + Number(o.amount), 0);

  const totalSpent = buyerOrders
    .filter(o => REVENUE_STATUSES.includes(o.status))
    .reduce((sum, o) => sum + Number(o.amount), 0);

  const activeListings = listings.filter(l => l.status === 'ACTIVE').length;
  const chartData = buildSalesChart(sellerOrders);
  const recentSellerOrders = [...sellerOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const recentBuyerOrders = [...buyerOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const needsShipment = sellerOrders.filter(o => o.status === 'ESCROW_HELD');
  const inspecting = verifications.filter(v => v.status === 'IN_PROGRESS').length;
  const awaitingInspection = verifications.filter(v => v.status === 'PENDING').length;

  const displayName = (() => {
    if (user?.name) {
      const parts = user.name.split(' ');
      const skip = ['Admin', 'User', 'Test', 'Demo'];
      return skip.includes(parts[0]) && parts.length > 1 ? parts[1] : parts[0];
    }
    return 'there';
  })();

  const navItems: { id: NavId; label: string; icon: typeof LayoutDashboard; dividerBefore?: boolean }[] = [
    { id: 'dashboard',  label: 'Overview',     icon: LayoutDashboard },
    { id: 'purchases',  label: 'My Purchases', icon: ShoppingCart },
    { id: 'listings',   label: 'My Listings',  icon: List },
    { id: 'sales',      label: 'Sales',        icon: ShoppingBag },
    { id: 'earnings',   label: 'Earnings',     icon: DollarSign },
    { id: 'analytics',  label: 'Analytics',    icon: BarChart2 },
    { id: 'profile',    label: 'My Profile',   icon: UserCircle, dividerBefore: true },
    { id: 'settings',   label: 'Settings',     icon: Settings },
  ];

  // ─────────────────────────────────────────────
  // OVERVIEW (Dashboard) VIEW
  // ─────────────────────────────────────────────

  const renderDashboard = () => (
    <div className="space-y-6">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-green)]/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-[var(--color-green)]" aria-hidden="true" />
            </div>
            <span className="text-sm text-[var(--color-text-muted)] font-medium">Total Sales</span>
          </div>
          <p className="text-2xl font-bold text-[var(--color-text)]">{formatPrice(totalSales, 'GBP')}</p>
          {totalSales > 0 && <p className="text-xs text-[var(--color-green)] font-semibold mt-1 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> From your listings</p>}
        </div>

        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-blue-600" aria-hidden="true" />
            </div>
            <span className="text-sm text-[var(--color-text-muted)] font-medium">Total Spent</span>
          </div>
          <p className="text-2xl font-bold text-[var(--color-text)]">{formatPrice(totalSpent, 'GBP')}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{buyerOrders.length} purchase{buyerOrders.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-alt)] flex items-center justify-center">
              <Package className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />
            </div>
            <span className="text-sm text-[var(--color-text-muted)] font-medium">Active Listings</span>
          </div>
          <p className="text-2xl font-bold text-[var(--color-text)]">{activeListings}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{listings.length} total</p>
        </div>

        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" aria-hidden="true" />
            </div>
            <span className="text-sm text-[var(--color-text-muted)] font-medium">Seller Rating</span>
          </div>
          <div className="flex items-center gap-2">
            {sellerRating != null ? (
              <>
                <p className="text-2xl font-bold text-[var(--color-text)]">{sellerRating.toFixed(1)}</p>
                <StarRating value={sellerRating} />
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">No ratings yet</p>
            )}
          </div>
          {totalSalesCount > 0 && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {totalSalesCount} rating{totalSalesCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* ── Sales chart ── */}
      {(totalSales > 0 || sellerOrders.length > 0) && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <h2 className="font-bold text-[var(--color-text)] mb-4">Sales Overview (Last 30 Days)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2D7A4F" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2D7A4F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#565959' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={v => `£${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: '#565959' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                formatter={(v: number | undefined) => [formatPrice(v ?? 0, 'GBP'), 'Revenue']}
                contentStyle={{ borderRadius: 8, border: '1px solid #E3E3E3', fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#2D7A4F"
                strokeWidth={2}
                fill="url(#salesGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Bottom row: Recent Purchases + Right widgets ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent Purchases table -- 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <h2 className="font-bold text-[var(--color-text)]">Recent Purchases</h2>
            <button
              onClick={() => handleNavClick('purchases')}
              className="text-xs text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-medium flex items-center gap-1"
            >
              View all <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]/50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/30">
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-[var(--color-text-muted)] text-sm">Loading purchases...</td></tr>
                ) : recentBuyerOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <ShoppingCart className="w-8 h-8 text-[var(--color-border)] mx-auto mb-2" aria-hidden="true" />
                      <p className="text-sm text-[var(--color-text-muted)]">No purchases yet</p>
                      <Link href="/browse" className="text-xs text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-semibold mt-1 inline-block">
                        Browse devices
                      </Link>
                    </td>
                  </tr>
                ) : (
                  recentBuyerOrders.map(order => {
                    const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.PENDING;
                    const isCompleted = order.status === 'COMPLETED';
                    const isRated = ratedOrders.has(order.id);
                    return (
                      <tr key={order.id} className="hover:bg-[var(--color-surface-alt)]/50">
                        <td className="px-5 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">
                          {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text)] font-medium text-xs truncate max-w-[140px]">
                          {order.listing?.title ?? (`${order.listing?.brand ?? ''} ${order.listing?.model ?? ''}`.trim() || 'Device')}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-[var(--color-text)]">
                          {formatPrice(order.amount, order.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2.5 py-1 text-xs font-medium rounded-full', badge.className)}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isCompleted && !isRated ? (
                            <button
                              onClick={() => openRatingModal(order.id)}
                              className="text-xs text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-medium flex items-center gap-1"
                            >
                              <Star className="w-3 h-3" aria-hidden="true" /> Rate
                            </button>
                          ) : (
                            <Link href={`/orders/${order.id}`} className="text-xs text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-medium">
                              {order.status === 'SHIPPED' ? 'Track' : isRated ? 'Rated' : 'Details'}
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

        {/* Right column widgets */}
        <div className="space-y-4">

          {/* Shipment Required (only if there are items to ship) */}
          {needsShipment.length > 0 && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-5">
              <div className="flex items-start gap-3 mb-2">
                <AlertCircle className="w-5 h-5 text-[var(--color-danger)] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="font-bold text-[var(--color-text)] text-sm">Shipment Required</h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                    {needsShipment.length} order{needsShipment.length > 1 ? 's' : ''} need{needsShipment.length === 1 ? 's' : ''} to be shipped.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleNavClick('sales')}
                className="text-xs font-semibold text-[var(--color-green)] hover:text-[var(--color-green-dark)]"
              >
                View Sales
              </button>
            </div>
          )}

          {/* Verification Status */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-green)]/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-[var(--color-green)]" aria-hidden="true" />
              </div>
              <h3 className="font-bold text-[var(--color-text)] text-sm">Verification Pipeline</h3>
            </div>

            <div className="w-full bg-[var(--color-surface-alt)] rounded-full h-2 mb-3">
              {(() => {
                const total = inspecting + awaitingInspection;
                const pct = total > 0 ? Math.round((inspecting / total) * 100) : 0;
                return (
                  <div
                    className="bg-[var(--color-green)] h-2 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                );
              })()}
            </div>

            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              {inspecting > 0 ? `${inspecting} item${inspecting > 1 ? 's' : ''} being inspected.` : 'No items being inspected.'}
              {awaitingInspection > 0 && <><br />{awaitingInspection} awaiting inspection.</>}
            </p>
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <h3 className="font-bold text-[var(--color-text)] text-sm mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href="/listings/create"
                className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-green)] transition-colors py-1"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Create a listing
              </Link>
              <Link
                href="/browse"
                className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-green)] transition-colors py-1"
              >
                <Search className="w-3.5 h-3.5" aria-hidden="true" />
                Browse devices
              </Link>
              <Link
                href="/orders"
                className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-green)] transition-colors py-1"
              >
                <Truck className="w-3.5 h-3.5" aria-hidden="true" />
                View all orders
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // MY PURCHASES VIEW
  // ─────────────────────────────────────────────

  const renderPurchases = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--color-text)]">My Purchases</h2>
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          <Search className="w-4 h-4" aria-hidden="true" />
          Browse Devices
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>
      ) : buyerOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-12 text-center">
          <ShoppingCart className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" aria-hidden="true" />
          <p className="text-[var(--color-text-muted)] font-medium">No purchases yet</p>
          <Link href="/browse" className="text-[var(--color-green)] text-sm font-semibold mt-2 inline-block hover:underline">
            Start browsing verified devices
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Item</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]/30">
              {buyerOrders.map(order => {
                const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.PENDING;
                const isCompleted = order.status === 'COMPLETED';
                const isRated = ratedOrders.has(order.id);
                const actionLabel =
                  order.status === 'SHIPPED' ? 'Track Shipment' :
                  order.status === 'DELIVERED' ? 'Confirm Receipt' :
                  isCompleted && !isRated ? 'Rate Seller' :
                  isCompleted && isRated ? 'Rated' : 'View Details';
                return (
                  <tr key={order.id} className="hover:bg-[var(--color-surface-alt)]/50">
                    <td className="px-5 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                      {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text)] font-medium text-xs truncate max-w-[200px]">
                      {order.listing?.title ?? (`${order.listing?.brand ?? ''} ${order.listing?.model ?? ''}`.trim() || 'Device')}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-[var(--color-text)]">
                      {formatPrice(order.amount, order.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2.5 py-1 text-xs font-medium rounded-full', badge.className)}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isCompleted && !isRated ? (
                        <button
                          onClick={() => openRatingModal(order.id)}
                          className="text-xs text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-medium flex items-center gap-1"
                        >
                          <Star className="w-3 h-3" aria-hidden="true" /> Rate Seller <ChevronRight className="w-3 h-3" aria-hidden="true" />
                        </button>
                      ) : (
                        <Link href={`/orders/${order.id}`} className="text-xs text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-medium flex items-center gap-1">
                          {actionLabel} <ChevronRight className="w-3 h-3" aria-hidden="true" />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────
  // MY LISTINGS VIEW
  // ─────────────────────────────────────────────

  const renderListings = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--color-text)]">My Listings</h2>
        <Link
          href="/listings/create"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          New Listing
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>
      ) : listings.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-12 text-center">
          <Package className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" aria-hidden="true" />
          <p className="text-[var(--color-text-muted)] font-medium">No listings yet</p>
          <Link href="/listings/create" className="text-[var(--color-green)] text-sm font-semibold mt-2 inline-block hover:underline">
            Create your first listing
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Listing</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Price</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Verification</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Views</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]/30">
              {listings.map(l => {
                const trustBadge = TRUST_BADGE[l.trustLensStatus] ?? TRUST_BADGE.PENDING;
                return (
                  <tr key={l.id} className="hover:bg-[var(--color-surface-alt)]/50">
                    <td className="px-5 py-3 max-w-[200px]">
                      <p className="font-medium text-[var(--color-text)] truncate text-xs">{l.title}</p>
                      <p className="text-[var(--color-text-muted)] text-xs">{l.brand} {l.model}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-[var(--color-text)]">{formatPrice(l.price, l.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 text-xs rounded-full font-medium',
                        l.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        l.status === 'SOLD' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-600')}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 text-xs rounded-full font-medium', trustBadge.className)}>
                        {trustBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" aria-hidden="true" />{l.viewCount}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/listings/${l.id}`} className="text-xs text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-medium flex items-center gap-1">
                        View <ChevronRight className="w-3 h-3" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────
  // SALES VIEW (orders where user is seller)
  // ─────────────────────────────────────────────

  const renderSales = () => (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-[var(--color-text)]">Sales</h2>
      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>
      ) : sellerOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-12 text-center">
          <ShoppingBag className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" aria-hidden="true" />
          <p className="text-[var(--color-text-muted)] font-medium">No sales yet</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Sales will appear here when buyers purchase your listings.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Item</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Buyer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]/30">
              {sellerOrders.map(o => {
                const badge = STATUS_BADGE[o.status] ?? STATUS_BADGE.PENDING;
                const actionLabel =
                  o.status === 'ESCROW_HELD' ? 'Mark Shipped' :
                  o.status === 'SHIPPED' ? 'Track Shipment' :
                  o.status === 'COMPLETED' ? 'View Feedback' : 'View Details';
                return (
                  <tr key={o.id} className="hover:bg-[var(--color-surface-alt)]/50">
                    <td className="px-5 py-3 font-mono text-xs text-[var(--color-text-muted)]">#{o.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                      {new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text)] font-medium text-xs truncate max-w-[140px]">
                      {o.listing?.title ?? (`${o.listing?.brand ?? ''} ${o.listing?.model ?? ''}`.trim() || 'Device')}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{o.buyer?.displayName ?? 'Buyer'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-[var(--color-text)]">{formatPrice(o.amount, o.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2.5 py-1 text-xs font-medium rounded-full', badge.className)}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/orders/${o.id}`} className="text-xs text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-medium">
                        {actionLabel}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────
  // EARNINGS VIEW
  // ─────────────────────────────────────────────

  const renderEarnings = () => {
    const completed = sellerOrders.filter(o => o.status === 'COMPLETED');
    const pending = sellerOrders.filter(o => ['ESCROW_HELD', 'PAYMENT_RECEIVED', 'SHIPPED', 'DELIVERED'].includes(o.status));
    const completedTotal = completed.reduce((s, o) => s + Number(o.amount), 0);
    const pendingTotal = pending.reduce((s, o) => s + Number(o.amount), 0);

    return (
      <div className="space-y-5">
        <h2 className="text-xl font-bold text-[var(--color-text)]">Earnings</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Earned', value: formatPrice(completedTotal, 'GBP'), sub: 'From completed sales', color: 'text-[var(--color-green)]' },
            { label: 'Pending Payout', value: formatPrice(pendingTotal, 'GBP'), sub: 'In escrow / in transit', color: 'text-[var(--color-warning)]' },
            { label: 'Platform Fee (5%)', value: formatPrice(completedTotal * 0.05, 'GBP'), sub: 'Deducted from earnings', color: 'text-[var(--color-text-muted)]' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-[var(--color-border)] p-5">
              <p className="text-xs text-[var(--color-text-muted)] font-medium mb-2">{card.label}</p>
              <p className={cn('text-2xl font-bold', card.color)}>{card.value}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
          <h3 className="font-bold text-[var(--color-text)] mb-4">Revenue Over Last 30 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2D7A4F" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2D7A4F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E3" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#565959' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#565959' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(v: number | undefined) => [formatPrice(v ?? 0, 'GBP'), 'Revenue']} contentStyle={{ borderRadius: 8, border: '1px solid #E3E3E3', fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" stroke="#2D7A4F" strokeWidth={2} fill="url(#earningsGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────
  // ANALYTICS VIEW
  // ─────────────────────────────────────────────

  const renderAnalytics = () => (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-[var(--color-text)]">Analytics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Purchases', value: buyerOrders.length },
          { label: 'Total Sales',     value: sellerOrders.length },
          { label: 'Active Listings', value: activeListings },
          { label: 'Avg Sale Value',  value: sellerOrders.length ? formatPrice(sellerOrders.reduce((s, o) => s + Number(o.amount), 0) / sellerOrders.length, 'GBP') : formatPrice(0, 'GBP') },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-[var(--color-text)]">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
        <h3 className="font-bold text-[var(--color-text)] mb-4">Cumulative Sales Trend</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF9900" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#FF9900" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E3" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#565959' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#565959' }} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(v: number | undefined) => [formatPrice(v ?? 0, 'GBP'), 'Revenue']} contentStyle={{ borderRadius: 8, border: '1px solid #E3E3E3', fontSize: 12 }} />
            <Area type="monotone" dataKey="revenue" stroke="#FF9900" strokeWidth={2} fill="url(#analyticsGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // PROFILE VIEW
  // ─────────────────────────────────────────────

  const renderProfile = () => {
    if (profileLoading) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-block motion-safe:animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">Loading profile...</p>
          </div>
        </div>
      );
    }

    const initials = (profileDisplayName || user?.name || 'U').charAt(0).toUpperCase();

    return (
      <div className="space-y-5">
        <h2 className="text-xl font-bold text-[var(--color-text)]">My Profile</h2>

        <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
          {profileSuccess && (
            <div role="status" aria-live="polite" className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm">
              {profileSuccess}
            </div>
          )}
          {profileError && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
              {profileError}
            </div>
          )}

          <form onSubmit={handleProfileSave} className="space-y-5">
            {/* Avatar + basic info */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xl font-bold shrink-0">
                {initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">{profileDisplayName || user?.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{user?.email}</p>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label htmlFor="dash-profile-display" className="block text-sm font-medium text-[var(--color-text)] mb-1">Display Name</label>
              <input
                id="dash-profile-display"
                type="text"
                value={profileDisplayName}
                onChange={(e) => setProfileDisplayName(e.target.value)}
                placeholder="How you appear to others"
                maxLength={80}
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-green)]"
              />
            </div>

            {/* First / Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dash-profile-first" className="block text-sm font-medium text-[var(--color-text)] mb-1">First Name</label>
                <input
                  id="dash-profile-first"
                  type="text"
                  value={profileFirstName}
                  onChange={(e) => setProfileFirstName(e.target.value)}
                  placeholder="Jane"
                  maxLength={50}
                  className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-green)]"
                />
              </div>
              <div>
                <label htmlFor="dash-profile-last" className="block text-sm font-medium text-[var(--color-text)] mb-1">Last Name</label>
                <input
                  id="dash-profile-last"
                  type="text"
                  value={profileLastName}
                  onChange={(e) => setProfileLastName(e.target.value)}
                  placeholder="Doe"
                  maxLength={50}
                  className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-green)]"
                />
              </div>
            </div>

            {/* Email (read-only) */}
            <div>
              <label htmlFor="dash-profile-email" className="block text-sm font-medium text-[var(--color-text)] mb-1">Email</label>
              <input
                id="dash-profile-email"
                type="email"
                value={user?.email ?? ''}
                disabled
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] cursor-not-allowed"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Email cannot be changed</p>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="dash-profile-phone" className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Phone Number <span className="text-[var(--color-text-muted)] font-normal text-xs">(optional)</span>
              </label>
              <input
                id="dash-profile-phone"
                type="tel"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                placeholder="+44 7700 900000"
                autoComplete="tel"
                maxLength={30}
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-green)]"
              />
            </div>

            {/* Bio */}
            <div>
              <label htmlFor="dash-profile-bio" className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Bio <span className="text-[var(--color-text-muted)] font-normal text-xs">(optional)</span>
              </label>
              <textarea
                id="dash-profile-bio"
                value={profileBio}
                onChange={(e) => setProfileBio(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Tell buyers or sellers a bit about yourself..."
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-green)]"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{profileBio.length}/500 characters</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={profileSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                {profileSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={fetchProfile}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-[var(--color-border)] text-sm font-semibold rounded-lg hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Verification Status */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
          <div className="flex items-center gap-3 mb-3">
            <ShieldCheck className="w-5 h-5 text-[var(--color-green)]" aria-hidden="true" />
            <h3 className="font-bold text-[var(--color-text)]">Verification Status</h3>
          </div>
          <div className="flex items-center gap-3">
            {verificationStatus === 'VERIFIED' ? (
              <>
                <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full font-medium">Verified</span>
                <p className="text-sm text-[var(--color-text-muted)]">Your seller status is verified through Trust Lens checks. You can sell on VeriBuy.</p>
              </>
            ) : verificationStatus === 'PENDING' ? (
              <>
                <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full font-medium">Pending</span>
                <p className="text-sm text-[var(--color-text-muted)]">Your verification is being reviewed.</p>
              </>
            ) : verificationStatus === 'REJECTED' ? (
              <>
                <span className="bg-red-100 text-red-700 text-sm px-3 py-1 rounded-full font-medium">Rejected</span>
                <p className="text-sm text-[var(--color-text-muted)]">Verification was rejected due to multiple failed listing reviews.</p>
              </>
            ) : verificationStatus === 'SUSPENDED' ? (
              <>
                <span className="bg-red-100 text-red-700 text-sm px-3 py-1 rounded-full font-medium">Suspended</span>
                <p className="text-sm text-[var(--color-text-muted)]">Your account has been suspended. Please contact support.</p>
              </>
            ) : (
              <>
                <span className="bg-amber-100 text-amber-800 text-sm px-3 py-1 rounded-full font-medium">Unverified</span>
                <p className="text-sm text-[var(--color-text-muted)]">Create a listing with an IMEI to start the verification process.</p>
              </>
            )}
          </div>
          {(verificationStatus === 'UNVERIFIED' || verificationStatus === 'REJECTED') && (
            <Link
              href="/seller-verification"
              className="inline-flex items-center gap-1 mt-4 text-sm text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-medium"
            >
              Learn about verification <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────
  // SETTINGS VIEW
  // ─────────────────────────────────────────────

  const [settingsTab, setSettingsTab] = useState<'security' | 'notifications'>('security');

  const renderSettings = () => (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-[var(--color-text)]">Settings</h2>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-white rounded-xl border border-[var(--color-border)] p-1 w-fit">
        <button
          onClick={() => setSettingsTab('security')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            settingsTab === 'security'
              ? 'bg-[var(--color-primary)] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]',
          )}
        >
          <Lock className="w-4 h-4" aria-hidden="true" />
          Security
        </button>
        <button
          onClick={() => setSettingsTab('notifications')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            settingsTab === 'notifications'
              ? 'bg-[var(--color-primary)] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]',
          )}
        >
          <Bell className="w-4 h-4" aria-hidden="true" />
          Notifications
        </button>
      </div>

      {/* Security */}
      {settingsTab === 'security' && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
          <h3 className="font-bold text-[var(--color-text)] mb-4">Change Password</h3>

          {securitySuccess && (
            <div role="status" aria-live="polite" className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {securitySuccess}
            </div>
          )}
          {securityError && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {securityError}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            <div>
              <label htmlFor="dash-current-pw" className="block text-sm font-medium text-[var(--color-text)] mb-1">Current Password</label>
              <input
                id="dash-current-pw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                autoComplete="current-password"
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-green)]"
              />
            </div>
            <div>
              <label htmlFor="dash-new-pw" className="block text-sm font-medium text-[var(--color-text)] mb-1">New Password</label>
              <input
                id="dash-new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-green)]"
              />
            </div>
            <div>
              <label htmlFor="dash-confirm-pw" className="block text-sm font-medium text-[var(--color-text)] mb-1">Confirm New Password</label>
              <input
                id="dash-confirm-pw"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-green)]"
              />
            </div>
            <button
              type="submit"
              disabled={passwordLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          {/* 2FA placeholder */}
          <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
            <h3 className="font-bold text-[var(--color-text)] mb-2">Two-Factor Authentication</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">Add an extra layer of security to your account.</p>
            <button
              type="button"
              disabled
              className="px-5 py-2.5 border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm font-semibold rounded-lg opacity-50 cursor-not-allowed"
            >
              Enable 2FA (Coming Soon)
            </button>
          </div>
        </div>
      )}

      {/* Notifications */}
      {settingsTab === 'notifications' && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
          <h3 className="font-bold text-[var(--color-text)] mb-4">Email Notifications</h3>
          <div className="space-y-4">
            {[
              { label: 'Listing Updates', desc: 'Get notified when your listing status changes', checked: notifListingUpdates, onChange: setNotifListingUpdates },
              { label: 'Order Notifications', desc: 'Updates about your orders and purchases', checked: notifOrders, onChange: setNotifOrders },
              { label: 'Trust Lens Updates', desc: 'Verification status and reviews', checked: notifTrustLens, onChange: setNotifTrustLens },
              { label: 'Marketing Emails', desc: 'Promotions, tips, and feature updates', checked: notifMarketing, onChange: setNotifMarketing },
            ].map(item => (
              <label key={item.label} className="flex items-center justify-between cursor-pointer py-1">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{item.label}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{item.desc}</p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.onChange(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-[var(--color-border)] rounded-full peer-checked:bg-[var(--color-green)] transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
                </div>
              </label>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
            <h3 className="font-bold text-[var(--color-text)] mb-4">Push Notifications</h3>
            <div className="space-y-4">
              {[
                { label: 'Messages', desc: 'New messages from buyers or sellers', checked: notifMessages, onChange: setNotifMessages },
                { label: 'Price Alerts', desc: 'When similar devices drop in price', checked: notifPriceAlerts, onChange: setNotifPriceAlerts },
              ].map(item => (
                <label key={item.label} className="flex items-center justify-between cursor-pointer py-1">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{item.label}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{item.desc}</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.onChange(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-[var(--color-border)] rounded-full peer-checked:bg-[var(--color-green)] transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
            <button
              type="button"
              disabled
              className="px-5 py-2.5 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg opacity-50 cursor-not-allowed"
            >
              Save Preferences (Coming Soon)
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────
  // LAYOUT
  // ─────────────────────────────────────────────

  const handleNavClick = (id: NavId) => {
    setActiveNav(id);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-[var(--color-surface-alt)]">

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-52 flex flex-col bg-white border-r border-[var(--color-border)] transition-transform duration-200 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[var(--color-border)] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-xs font-extrabold text-white">V</div>
            <span className="font-extrabold text-[var(--color-primary)] text-base tracking-tight">VeriBuy</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3" aria-label="Dashboard navigation">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <div key={item.id}>
                {item.dividerBefore && (
                  <div className="mx-5 my-2 border-t border-[var(--color-border)]" />
                )}
                <button
                  onClick={() => handleNavClick(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors text-left',
                    activeNav === item.id
                      ? 'bg-[var(--color-green)]/10 text-[var(--color-green)] border-r-2 border-[var(--color-green)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]',
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </button>
              </div>
            );
          })}
        </nav>

        {/* User footer with logout */}
        <div className="px-5 py-4 border-t border-[var(--color-border)]">
          <p className="text-xs font-semibold text-[var(--color-text)] truncate">{displayName}</p>
          <p className="text-xs text-[var(--color-text-muted)] truncate mb-3">{user?.email}</p>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-muted)] hover:text-red-600 transition-colors w-full"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            Log out
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
              className="lg:hidden p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base font-bold text-[var(--color-text)]">
              {navItems.find(n => n.id === activeNav)?.label ?? 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/browse"
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors hidden sm:flex items-center gap-1"
            >
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
              Browse
            </Link>
            <Link
              href="/listings/create"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-semibold rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">New Listing</span>
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeNav === 'dashboard'  && renderDashboard()}
          {activeNav === 'purchases'  && renderPurchases()}
          {activeNav === 'listings'   && renderListings()}
          {activeNav === 'sales'      && renderSales()}
          {activeNav === 'earnings'   && renderEarnings()}
          {activeNav === 'analytics'  && renderAnalytics()}
          {activeNav === 'profile'    && renderProfile()}
          {activeNav === 'settings'   && renderSettings()}
        </main>
      </div>

      {/* ── Rating Modal ── */}
      {ratingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeRatingModal}
            aria-hidden="true"
          />
          <div className="relative bg-white rounded-xl border border-[var(--color-border)] p-6 w-full max-w-md mx-4 shadow-lg">
            <button
              onClick={closeRatingModal}
              className="absolute top-4 right-4 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              aria-label="Close rating modal"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-[var(--color-text)] text-lg mb-1">Rate Your Seller</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-5">
              How was your experience with this transaction?
            </p>

            {ratingError && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {ratingError}
              </div>
            )}

            {/* Star selector */}
            <div className="flex items-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRatingValue(i)}
                  onMouseEnter={() => setRatingHover(i)}
                  onMouseLeave={() => setRatingHover(0)}
                  className="p-1 focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] rounded"
                  aria-label={`Rate ${i} star${i > 1 ? 's' : ''}`}
                >
                  <Star
                    className={cn(
                      'w-8 h-8 transition-colors',
                      i <= (ratingHover || ratingValue)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-[var(--color-border)] fill-[var(--color-surface-alt)]',
                    )}
                    aria-hidden="true"
                  />
                </button>
              ))}
              {ratingValue > 0 && (
                <span className="ml-2 text-sm font-semibold text-[var(--color-text)]">
                  {ratingValue}/5
                </span>
              )}
            </div>

            {/* Comment */}
            <div className="mb-5">
              <label htmlFor="rating-comment" className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Comment <span className="text-[var(--color-text-muted)] font-normal text-xs">(optional)</span>
              </label>
              <textarea
                id="rating-comment"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Share your experience..."
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-green)]"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{ratingComment.length}/1000 characters</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleRatingSubmit}
                disabled={ratingValue < 1 || ratingSubmitting}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Star className="w-4 h-4" aria-hidden="true" />
                {ratingSubmitting ? 'Submitting...' : 'Submit Rating'}
              </button>
              <button
                onClick={closeRatingModal}
                className="px-5 py-2.5 border border-[var(--color-border)] text-sm font-semibold rounded-lg hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
