'use client';

import { useState, useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatPrice } from '@/lib/currency';
import {
  Smartphone,
  Tablet,
  Watch,
  Package,
  Search,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  X,
  RotateCcw,
  Check,
  Tag,
  ArrowRight,
  Filter,
} from 'lucide-react';

type DeviceType = 'SMARTPHONE' | 'TABLET' | 'SMARTWATCH';
type ConditionGrade = 'A' | 'B' | 'C';
type TrustLensStatus = 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'REQUIRES_REVIEW';

interface Listing {
  id: string;
  title: string;
  description: string;
  deviceType: DeviceType;
  brand: string;
  model: string;
  price: number | string;
  currency: string;
  conditionGrade?: ConditionGrade;
  trustLensStatus: TrustLensStatus;
  status: string;
  createdAt: string;
  imageUrl?: string;
}

const DEVICE_CATEGORIES: { value: DeviceType | ''; label: string; icon: typeof Smartphone }[] = [
  { value: '', label: 'All Devices', icon: Package },
  { value: 'SMARTPHONE', label: 'Smartphones', icon: Smartphone },
  { value: 'TABLET', label: 'Tablets', icon: Tablet },
  { value: 'SMARTWATCH', label: 'Smartwatches', icon: Watch },
];

const GRADE_CONFIG: Record<ConditionGrade, { label: string; title: string; badgeClass: string; desc: string }> = {
  A: {
    label: 'Grade A',
    title: 'Pristine / Like New',
    badgeClass: 'bg-[var(--color-green)] text-white',
    desc: 'Flawless condition, zero/minimal scratches',
  },
  B: {
    label: 'Grade B',
    title: 'Good Condition',
    badgeClass: 'bg-blue-600 text-white',
    desc: 'Minor cosmetic marks, 100% functional',
  },
  C: {
    label: 'Grade C',
    title: 'Fair / Budget',
    badgeClass: 'bg-amber-600 text-white',
    desc: 'Visible wear/scuffs, 100% functional',
  },
};

export default function BrowseContent() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    deviceType: '' as DeviceType | '',
    conditionGrades: [] as ConditionGrade[],
    verifiedOnly: true,
    search: '',
    minPrice: '',
    maxPrice: '',
  });
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filterPanelId = 'browse-filter-panel';
  const searchId = useId();
  const minPriceId = useId();
  const maxPriceId = useId();
  const sortId = useId();

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [filters.search]);

  useEffect(() => {
    fetchListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.deviceType, filters.conditionGrades, filters.verifiedOnly, filters.minPrice, filters.maxPrice, debouncedSearch, sortBy, page]);

  useEffect(() => {
    setPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.deviceType, filters.conditionGrades, filters.verifiedOnly, filters.minPrice, filters.maxPrice, debouncedSearch, sortBy]);

  const fetchListings = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();

      if (filters.deviceType) {
        params.append('deviceType', filters.deviceType);
      }

      if (filters.verifiedOnly) {
        params.append('trustLensStatus', 'PASSED');
      }

      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      if (filters.conditionGrades.length > 0) {
        filters.conditionGrades.forEach(g => params.append('conditionGrade', g));
      }

      if (filters.minPrice) {
        params.append('minPrice', filters.minPrice);
      }

      if (filters.maxPrice) {
        params.append('maxPrice', filters.maxPrice);
      }

      if (sortBy === 'price-asc') {
        params.append('sortBy', 'price');
        params.append('sortOrder', 'asc');
      } else if (sortBy === 'price-desc') {
        params.append('sortBy', 'price');
        params.append('sortOrder', 'desc');
      } else {
        params.append('sortBy', 'createdAt');
        params.append('sortOrder', 'desc');
      }

      params.append('status', 'ACTIVE');
      params.append('page', String(page));
      params.append('limit', '12');

      const response = await fetch(`/api/listings?${params.toString()}`);

      if (!response.ok) {
        if (response.status >= 500) {
          throw new Error('The listings service is temporarily unavailable. Please try again in a moment.');
        }
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch listings');
      }

      const data = await response.json();
      const rawListings: Listing[] = Array.isArray(data) ? data : (data.data || []);
      setListings(rawListings);

      if (!Array.isArray(data) && data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
        setTotalCount(data.pagination.total ?? rawListings.length);
      } else {
        setTotalPages(1);
        setTotalCount(rawListings.length);
      }
    } catch (err: any) {
      const isNetworkError = err instanceof TypeError && err.message.includes('fetch');
      setError(isNetworkError
        ? 'Unable to reach the listings service. Please check your connection and try again.'
        : (err.message || 'Failed to load listings'));
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleConditionGrade = (grade: ConditionGrade) => {
    setFilters(prev => ({
      ...prev,
      conditionGrades: prev.conditionGrades.includes(grade)
        ? prev.conditionGrades.filter(g => g !== grade)
        : [...prev.conditionGrades, grade],
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      deviceType: '',
      conditionGrades: [],
      verifiedOnly: false,
      search: '',
      minPrice: '',
      maxPrice: '',
    });
  };

  const hasActiveFilters = Boolean(
    filters.deviceType ||
    filters.conditionGrades.length > 0 ||
    !filters.verifiedOnly ||
    filters.search ||
    filters.minPrice ||
    filters.maxPrice
  );

  const activeFilterCount =
    (filters.deviceType ? 1 : 0) +
    filters.conditionGrades.length +
    (!filters.verifiedOnly ? 1 : 0) +
    (filters.search ? 1 : 0) +
    (filters.minPrice || filters.maxPrice ? 1 : 0);

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header Banner */}
      <div className="bg-white border-b border-[var(--color-border)] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--color-green)]/15 text-[var(--color-green)] border border-[var(--color-green)]/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Trust Lens™ Verified Marketplace
                </span>
                <span className="text-xs text-[var(--color-text-muted)] hidden sm:inline">
                  • GSMA Blacklist Checked & Escrow Protected
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-[var(--color-text)] tracking-tight">
                Explore Verified Devices
              </h1>
              <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-2xl">
                Every smartphone, tablet, and smartwatch is hardware-authenticated with timestamped evidence before dispatch.
              </p>
            </div>

            {/* Quick search input */}
            <div className="w-full md:w-80 relative">
              <label htmlFor={searchId} className="sr-only">Search verified devices</label>
              <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                id={searchId}
                type="search"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Search iPhone, Galaxy, iPad..."
                className="w-full pl-10 pr-10 py-2.5 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent transition-all"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Category Tabs Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pt-6 pb-1 scrollbar-none">
            {DEVICE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = filters.deviceType === cat.value;
              return (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => setFilters(prev => ({ ...prev, deviceType: isSelected && cat.value !== '' ? '' : cat.value }))}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-[var(--color-green)] text-white shadow-sm ring-2 ring-[var(--color-green)]/20'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-text)] hover:bg-[var(--color-border)]/60 border border-[var(--color-border)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {cat.label}
                </button>
              );
            })}

            <div className="h-6 w-px bg-[var(--color-border)] mx-1 shrink-0" />

            {/* Quick Condition Chips */}
            <button
              type="button"
              onClick={() => toggleConditionGrade('A')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                filters.conditionGrades.includes('A')
                  ? 'bg-[var(--color-green)]/15 text-[var(--color-green)] border-[var(--color-green)] ring-1 ring-[var(--color-green)]'
                  : 'bg-white text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-text-muted)]/40'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Grade A (Pristine)
            </button>

            <button
              type="button"
              onClick={() => setFilters(prev => ({ ...prev, maxPrice: prev.maxPrice === '300' ? '' : '300' }))}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                filters.maxPrice === '300'
                  ? 'bg-[var(--color-green)]/15 text-[var(--color-green)] border-[var(--color-green)] ring-1 ring-[var(--color-green)]'
                  : 'bg-white text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-text-muted)]/40'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              Under £300
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Mobile Filter & Sort Bar */}
        <div className="lg:hidden flex items-center justify-between gap-3 mb-6">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
            aria-controls={filterPanelId}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[var(--color-border)] rounded-xl text-sm font-bold text-[var(--color-text)] shadow-sm"
          >
            <Filter className="w-4 h-4 text-[var(--color-green)]" />
            <span>Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
          </button>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2.5 bg-white border border-[var(--color-border)] rounded-xl text-sm font-semibold text-[var(--color-text)] shadow-sm focus:ring-2 focus:ring-[var(--color-green)]"
            >
              <option value="newest">Newest First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Desktop Filter Sidebar */}
          <aside
            id={filterPanelId}
            aria-label="Listing filters"
            className={`w-full lg:w-72 lg:shrink-0 ${filtersOpen ? 'block' : 'hidden'} lg:block`}
          >
            <div className="bg-white border border-[var(--color-border)] rounded-2xl p-6 shadow-sm sticky top-24 space-y-6">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[var(--color-green)]" />
                  <h2 className="font-bold text-base text-[var(--color-text)]">Filters</h2>
                  {activeFilterCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[var(--color-green)] text-white text-xs flex items-center justify-center font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </div>

                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    type="button"
                    className="text-xs font-semibold text-[var(--color-green)] hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>

              {/* Verification Filter */}
              <div>
                <label htmlFor="verified-only" className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-border)]/40 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-[var(--color-green)]" />
                    <div>
                      <span className="text-xs font-bold text-[var(--color-text)] block">Verified Only</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">Trust Lens™ passed</span>
                    </div>
                  </div>
                  <input
                    id="verified-only"
                    type="checkbox"
                    checked={filters.verifiedOnly}
                    onChange={(e) => setFilters(prev => ({ ...prev, verifiedOnly: e.target.checked }))}
                    className="w-4 h-4 text-[var(--color-green)] rounded focus:ring-[var(--color-green)]"
                  />
                </label>
              </div>

              {/* Condition Grade Filter */}
              <fieldset>
                <legend className="font-bold text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                  Condition Grade
                </legend>
                <div className="space-y-2.5">
                  {(['A', 'B', 'C'] as ConditionGrade[]).map((grade) => {
                    const cfg = GRADE_CONFIG[grade];
                    const isChecked = filters.conditionGrades.includes(grade);
                    const gradeId = `filter-grade-${grade}`;
                    return (
                      <label
                        key={grade}
                        htmlFor={gradeId}
                        className={`flex items-start justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          isChecked
                            ? 'border-[var(--color-green)] bg-[var(--color-green)]/5'
                            : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]/40 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            id={gradeId}
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleConditionGrade(grade)}
                            className="mt-0.5 w-4 h-4 text-[var(--color-green)] rounded focus:ring-[var(--color-green)]"
                          />
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${cfg.badgeClass}`}>
                                {cfg.label}
                              </span>
                              <span className="text-xs font-bold text-[var(--color-text)]">{cfg.title}</span>
                            </div>
                            <p className="text-[11px] text-[var(--color-text-muted)]">{cfg.desc}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {/* Price Range */}
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-3" id="price-range-heading">
                  Price Range (£)
                </h3>
                <div className="flex items-center gap-2" aria-labelledby="price-range-heading">
                  <div className="flex-1">
                    <label htmlFor={minPriceId} className="sr-only">Min price</label>
                    <input
                      id={minPriceId}
                      type="number"
                      placeholder="Min £"
                      min={0}
                      value={filters.minPrice}
                      onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
                      className="w-full px-3 py-2 border border-[var(--color-border)] rounded-xl text-xs focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                    />
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">—</span>
                  <div className="flex-1">
                    <label htmlFor={maxPriceId} className="sr-only">Max price</label>
                    <input
                      id={maxPriceId}
                      type="number"
                      placeholder="Max £"
                      min={0}
                      value={filters.maxPrice}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                      className="w-full px-3 py-2 border border-[var(--color-border)] rounded-xl text-xs focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex gap-1.5 mt-2">
                  {['150', '300', '500'].map((price) => (
                    <button
                      key={price}
                      type="button"
                      onClick={() => setFilters(prev => ({ ...prev, maxPrice: price }))}
                      className="flex-1 py-1 text-[11px] font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-alt)] hover:bg-[var(--color-border)] rounded-lg transition-colors"
                    >
                      &le; £{price}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Listings Section */}
          <div className="flex-1 min-w-0">
            {/* Active Filters bar & Sort */}
            <div className="bg-white border border-[var(--color-border)] rounded-2xl p-4 mb-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[var(--color-text)]">
                  {totalCount !== null ? `${totalCount} ${totalCount === 1 ? 'device' : 'devices'}` : 'Listings'}
                </span>

                {filters.deviceType && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--color-surface-alt)] text-[var(--color-text)] border border-[var(--color-border)]">
                    {DEVICE_CATEGORIES.find(c => c.value === filters.deviceType)?.label}
                    <button type="button" onClick={() => setFilters(prev => ({ ...prev, deviceType: '' }))} aria-label="Remove category filter">
                      <X className="w-3 h-3 hover:text-red-500" />
                    </button>
                  </span>
                )}

                {filters.conditionGrades.map((g) => (
                  <span key={g} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                    Grade {g}
                    <button type="button" onClick={() => toggleConditionGrade(g)} aria-label={`Remove Grade ${g} filter`}>
                      <X className="w-3 h-3 hover:text-red-500" />
                    </button>
                  </span>
                ))}

                {(filters.minPrice || filters.maxPrice) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--color-surface-alt)] text-[var(--color-text)] border border-[var(--color-border)]">
                    £{filters.minPrice || '0'} - £{filters.maxPrice || '∞'}
                    <button type="button" onClick={() => setFilters(prev => ({ ...prev, minPrice: '', maxPrice: '' }))} aria-label="Remove price filter">
                      <X className="w-3 h-3 hover:text-red-500" />
                    </button>
                  </span>
                )}
              </div>

              {/* Desktop Sort Dropdown */}
              <div className="hidden lg:flex items-center gap-2">
                <label htmlFor={sortId} className="text-xs text-[var(--color-text-muted)] font-medium">Sort by:</label>
                <select
                  id={sortId}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1.5 border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] bg-white focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                >
                  <option value="newest">Newest First</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* Loading Skeletons */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6" aria-label="Loading listings">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-white rounded-2xl border border-[var(--color-border)] p-4 space-y-3 animate-pulse">
                    <div className="aspect-[4/3] bg-gray-200 rounded-xl" />
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-6 bg-gray-200 rounded w-1/3 pt-2" />
                  </div>
                ))}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div role="alert" className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-2xl p-8 text-center">
                <p className="text-sm font-semibold text-[var(--color-danger)] mb-4">{error}</p>
                <button
                  onClick={fetchListings}
                  className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-xl font-bold hover:opacity-90 text-sm shadow-sm"
                >
                  Retry Search
                </button>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && listings.length === 0 && (
              <div className="bg-white border border-[var(--color-border)] rounded-2xl p-12 text-center shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-[var(--color-text-muted)]" />
                </div>
                <h3 className="text-xl font-bold text-[var(--color-text)] mb-2">No verified devices found</h3>
                <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto mb-6">
                  We couldn&apos;t find any devices matching your current filter criteria. Try broadening your search or resetting filters.
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <button
                    onClick={clearAllFilters}
                    className="px-6 py-2.5 bg-[var(--color-green)] text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-sm"
                  >
                    Clear All Filters
                  </button>
                  <Link
                    href="/listings/create"
                    className="px-6 py-2.5 bg-[var(--color-surface-alt)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl text-sm font-bold hover:bg-[var(--color-border)] transition-colors"
                  >
                    Sell Your Device
                  </Link>
                </div>
              </div>
            )}

            {/* Device Listings Grid */}
            {!loading && !error && listings.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6" aria-label="Device listings">
                {listings.map((item) => {
                  const grade = item.conditionGrade ? GRADE_CONFIG[item.conditionGrade] : null;
                  const itemPrice = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
                  return (
                    <Link
                      key={item.id}
                      href={`/listings/${item.id}`}
                      className="group bg-white rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-green)]/80 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col"
                    >
                      {/* Image container */}
                      <div className="relative aspect-[4/3] bg-[var(--color-surface-alt)] overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-[var(--color-text-muted)]">
                            <Smartphone className="w-12 h-12 stroke-[1.25] mb-1 opacity-60" />
                            <span className="text-xs font-semibold capitalize">{item.deviceType.toLowerCase()}</span>
                          </div>
                        )}

                        {/* Top Badges */}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          {grade && (
                            <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg shadow-sm ${grade.badgeClass}`}>
                              {grade.label}
                            </span>
                          )}
                          {item.trustLensStatus === 'PASSED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/95 text-[var(--color-green)] backdrop-blur-sm shadow-sm border border-emerald-100">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Verified
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                            {item.brand} {item.model}
                          </p>
                          <h3 className="font-bold text-sm text-[var(--color-text)] line-clamp-2 leading-snug group-hover:text-[var(--color-green)] transition-colors mb-2">
                            {item.title}
                          </h3>
                        </div>

                        <div className="pt-3 border-t border-[var(--color-border)]/60 flex items-end justify-between mt-3">
                          <div>
                            <span className="text-xs text-[var(--color-text-muted)] block">Total Price</span>
                            <span className="text-lg font-black text-[var(--color-text)]">
                              {formatPrice(itemPrice, item.currency)}
                            </span>
                          </div>

                          <span className="text-xs font-bold text-[var(--color-green)] group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                            View Device <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && !error && totalPages > 1 && (
              <nav
                aria-label="Listings pagination"
                className="flex items-center justify-center gap-4 mt-10"
              >
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                  className="px-5 py-2.5 bg-white border border-[var(--color-border)] rounded-xl text-sm font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-alt)] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                  &larr; Previous
                </button>

                <span className="text-xs font-semibold text-[var(--color-text-muted)] bg-white px-3.5 py-2 border border-[var(--color-border)] rounded-xl shadow-sm">
                  Page {page} of {totalPages}
                </span>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                  className="px-5 py-2.5 bg-white border border-[var(--color-border)] rounded-xl text-sm font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-alt)] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                  Next &rarr;
                </button>
              </nav>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
