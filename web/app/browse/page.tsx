'use client';

import { useState, useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/lib/currency';
import {
  Smartphone,
  Tablet,
  Watch,
  Package,
  Search,
  SlidersHorizontal,
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

const DEVICE_ICONS: Record<DeviceType, { icon: React.ReactNode; bg: string; label: string }> = {
  SMARTPHONE: { icon: <Smartphone className="w-10 h-10 text-[var(--color-text-muted)]" />, bg: 'bg-[var(--color-surface-alt)]', label: 'Smartphone' },
  TABLET:     { icon: <Tablet className="w-10 h-10 text-[var(--color-text-muted)]" />,     bg: 'bg-[var(--color-surface-alt)]', label: 'Tablet' },
  SMARTWATCH: { icon: <Watch className="w-10 h-10 text-[var(--color-text-muted)]" />,      bg: 'bg-[var(--color-surface-alt)]', label: 'Smartwatch' },
};

const DEVICE_TYPES: { value: DeviceType; label: string }[] = [
  { value: 'SMARTPHONE', label: 'Smartphones' },
  { value: 'TABLET', label: 'Tablets' },
  { value: 'SMARTWATCH', label: 'Smartwatches' },
];

/** Fallback icon config for device types no longer offered (legacy data). */
const DEVICE_ICON_FALLBACK = { icon: <Package className="w-10 h-10 text-[var(--color-text-muted)]" />, bg: 'bg-[var(--color-surface-alt)]', label: 'Device' };
const getDeviceIcon = (type: string) =>
  DEVICE_ICONS[type as DeviceType] ?? DEVICE_ICON_FALLBACK;

export default function BrowsePage() {
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
  // PERF-10: Server-side pagination. page resets to 1 whenever filters/sort change.
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // PERF-02: Debounce search input — only trigger a new fetch after 300ms of inactivity
  // to avoid firing a network request on every keypress.
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filterPanelId = 'browse-filter-panel';
  const searchId = useId();
  const minPriceId = useId();
  const maxPriceId = useId();
  const sortId = useId();

  // Debounce the search field: update debouncedSearch 300ms after the user stops typing
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [filters.search]);

  // Re-fetch when any filter (except raw search — use debouncedSearch) or sortBy changes
  useEffect(() => {
    fetchListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.deviceType, filters.conditionGrades, filters.verifiedOnly, filters.minPrice, filters.maxPrice, debouncedSearch, sortBy, page]);

  // Reset to page 1 whenever filters or sort order change (but not when page itself changes).
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

      // PERF-02: Use debouncedSearch (updated with 300ms delay) so we don't fire
      // a fetch on every keypress.
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      // PERF-03: Push conditionGrades and price filtering to the API instead of
      // filtering client-side after receiving all listings.
      if (filters.conditionGrades.length > 0) {
        // Send as repeated params: conditionGrade=A&conditionGrade=B
        filters.conditionGrades.forEach(g => params.append('conditionGrade', g));
      }

      if (filters.minPrice) {
        params.append('minPrice', filters.minPrice);
      }

      if (filters.maxPrice) {
        params.append('maxPrice', filters.maxPrice);
      }

      // Pass sort order to API so results arrive pre-sorted
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

      // Only fetch ACTIVE listings for browse page
      params.append('status', 'ACTIVE');

      // PERF-10: Pass current page to the API (default page size = 12)
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
      // Handle paginated response: { data: [...], pagination: {...} }
      const rawListings: Listing[] = Array.isArray(data) ? data : (data.data || []);

      // SEC-14 / PERF-03: The N+1 per-listing evidence fetch has been removed.
      // The listing API should include imageUrl directly on the listing object.
      // If imageUrl is missing, the card gracefully falls back to a device-type icon.
      setListings(rawListings);

      // PERF-10: Extract totalPages from the pagination envelope when present
      if (!Array.isArray(data) && data.pagination?.totalPages) {
        setTotalPages(data.pagination.totalPages);
      } else {
        setTotalPages(1);
      }
    } catch (err: any) {
      // Network-level failure (service unreachable) vs HTTP error
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

  // PERF-03: Filtering and sorting are now handled server-side (passed as API query params).
  // listings already arrives filtered, sorted, and paginated from the backend.
  const sortedListings = listings;

  const getTrustBadge = (status: TrustLensStatus) => {
    if (status === 'PASSED') {
      return <span className="bg-[var(--color-success)] text-white text-xs px-2 py-0.5 rounded-full font-medium">Verified</span>;
    }
    if (status === 'IN_PROGRESS' || status === 'REQUIRES_REVIEW') {
      return <span className="bg-[var(--color-accent)] text-[var(--color-text)] text-xs px-2 py-0.5 rounded-full font-medium">Under Review</span>;
    }
    return null;
  };

  const getConditionBadge = (grade?: ConditionGrade) => {
    if (!grade) return null;
    
    const config: Record<ConditionGrade, { bg: string; text: string }> = {
      A: { bg: 'bg-[var(--color-primary)]', text: 'text-white' },
      B: { bg: 'bg-[var(--color-green)]', text: 'text-white' },
      C: { bg: 'bg-[var(--color-accent)]', text: 'text-[var(--color-text)]' },
    };

    return (
      <span className={`${config[grade].bg} ${config[grade].text} text-xs px-2 py-0.5 rounded-full font-medium`}>
        Grade {grade}
      </span>
    );
  };

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <label htmlFor={searchId} className="block font-semibold text-sm mb-2">Search</label>
        <input
          id={searchId}
          type="search"
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          placeholder="Search devices..."
          autoComplete="off"
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
        />
      </div>

      {/* Category */}
      <div>
        <h3 className="font-semibold text-sm mb-2" id="category-filter-heading">Category</h3>
        <ul className="space-y-1 text-sm text-[var(--color-text-muted)]" aria-labelledby="category-filter-heading">
          <li>
            <button
              onClick={() => setFilters(prev => ({ ...prev, deviceType: '' }))}
              aria-pressed={!filters.deviceType}
              className={`hover:text-[var(--color-text)] ${!filters.deviceType ? 'font-semibold text-[var(--color-green)]' : ''}`}
            >
              All Devices
            </button>
          </li>
          {DEVICE_TYPES.map(type => (
            <li key={type.value}>
              <button
                onClick={() => setFilters(prev => ({ ...prev, deviceType: type.value }))}
                aria-pressed={filters.deviceType === type.value}
                className={`hover:text-[var(--color-text)] ${filters.deviceType === type.value ? 'font-semibold text-[var(--color-green)]' : ''}`}
              >
                {type.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Condition Grade */}
      <fieldset>
        <legend className="font-semibold text-sm mb-2">Condition Grade</legend>
        <ul className="space-y-2 text-sm">
          {(['A', 'B', 'C'] as ConditionGrade[]).map((grade) => {
            const labels = { A: 'Grade A — Excellent', B: 'Grade B — Good', C: 'Grade C — Fair' };
            const gradeId = `condition-grade-${grade}`;
            return (
              <li key={grade}>
                <label htmlFor={gradeId} className="flex items-center gap-2 cursor-pointer">
                  <input
                    id={gradeId}
                    type="checkbox"
                    checked={filters.conditionGrades.includes(grade)}
                    onChange={() => toggleConditionGrade(grade)}
                    className="rounded"
                  />
                  <span>{labels[grade]}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {/* Verification */}
      <fieldset>
        <legend className="font-semibold text-sm mb-2">Verification</legend>
        <label htmlFor="verified-only" className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            id="verified-only"
            type="checkbox"
            checked={filters.verifiedOnly}
            onChange={(e) => setFilters(prev => ({ ...prev, verifiedOnly: e.target.checked }))}
            className="rounded"
          />
          <span>Trust Lens Verified only</span>
        </label>
      </fieldset>

      {/* Price Range */}
      <div>
        <h3 className="font-semibold text-sm mb-2" id="price-range-heading">Price Range</h3>
        <div className="flex gap-2" aria-labelledby="price-range-heading">
          <div className="flex-1">
            <label htmlFor={minPriceId} className="sr-only">Minimum price</label>
            <input
              id={minPriceId}
              type="number"
              placeholder="Min"
              min={0}
              value={filters.minPrice}
              onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
              className="w-full px-2 py-1 border border-[var(--color-border)] rounded text-sm focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
            />
          </div>
          <div className="flex-1">
            <label htmlFor={maxPriceId} className="sr-only">Maximum price</label>
            <input
              id={maxPriceId}
              type="number"
              placeholder="Max"
              min={0}
              value={filters.maxPrice}
              onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
              className="w-full px-2 py-1 border border-[var(--color-border)] rounded text-sm focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Clear Filters */}
      <button
        onClick={() => setFilters({
          deviceType: '',
          conditionGrades: [],
          verifiedOnly: true,
          search: '',
          minPrice: '',
          maxPrice: '',
        })}
        className="w-full px-4 py-2 text-sm text-[var(--color-green)] border border-[var(--color-green)] rounded-md hover:bg-[var(--color-green)]/10"
      >
        Clear All Filters
      </button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Mobile filter toggle — visible below lg */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          aria-expanded={filtersOpen}
          aria-controls={filterPanelId}
          className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium hover:bg-[var(--color-surface-alt)]"
        >
          <SlidersHorizontal aria-hidden="true" className="w-4 h-4" />
          {filtersOpen ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Filters — always shown on lg+, togglable below */}
        <aside
          id={filterPanelId}
          aria-label="Listing filters"
          className={`w-full lg:w-64 lg:shrink-0 ${filtersOpen ? 'block' : 'hidden'} lg:block`}
        >
          <h2 className="font-bold text-lg mb-4">Filters</h2>
          <FilterContent />
        </aside>

        {/* Listings Grid */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
            <h1 className="text-2xl font-bold text-[var(--color-text)]">
              {filters.deviceType 
                ? DEVICE_TYPES.find(t => t.value === filters.deviceType)?.label 
                : 'All Devices'}
              {sortedListings.length > 0 && (
                <span className="ml-2 text-base text-[var(--color-text-muted)] font-normal">
                  ({sortedListings.length} {sortedListings.length === 1 ? 'listing' : 'listings'})
                </span>
              )}
            </h1>
            <div>
              <label htmlFor={sortId} className="sr-only">Sort listings by</label>
              <select
                id={sortId}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
              >
                <option value="newest">Newest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {loading && (
            <div role="status" className="text-center py-12">
              <div aria-hidden="true" className="inline-block motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-green)]"></div>
              <span className="sr-only">Loading listings...</span>
              <p aria-hidden="true" className="mt-4 text-[var(--color-text-muted)]">Loading listings...</p>
            </div>
          )}

          {error && (
            <div role="alert" className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg p-4 text-center">
              <p className="text-[var(--color-danger)]">{error}</p>
              <button
                onClick={fetchListings}
                className="mt-3 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && sortedListings.length === 0 && (
            <div className="text-center py-12">
              <div aria-hidden="true" className="mb-4 flex justify-center">
                {filters.deviceType ? (
                  <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-surface-alt)]">
                    {getDeviceIcon(filters.deviceType).icon}
                  </span>
                ) : (
                  <Search className="w-16 h-16 text-[var(--color-text-muted)]" />
                )}
              </div>
              <h3 className="text-xl font-semibold text-[var(--color-text)] mb-2">No listings found</h3>
              <p className="text-[var(--color-text-muted)] mb-6">Try adjusting your filters or check back later</p>
              <Link
                href="/listings/create"
                className="inline-block px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90"
              >
                Create First Listing
              </Link>
            </div>
          )}

          {!loading && !error && sortedListings.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-label="Device listings">
              {sortedListings.map((listing) => (
                <li key={listing.id}>
                  <Link
                    href={`/listings/${listing.id}`}
                    className="block bg-white rounded-xl overflow-hidden transition-shadow border border-[var(--color-border)] hover:border-[var(--color-green)] hover:shadow-md h-full"
                  >
                    {listing.imageUrl ? (
                      <div className="h-48 overflow-hidden bg-[var(--color-surface-alt)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={listing.imageUrl}
                          alt={listing.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className={`${getDeviceIcon(listing.deviceType).bg} h-48 flex items-center justify-center`}>
                        <div className="text-center">
                          <div aria-hidden="true" className="mb-1 flex justify-center">{getDeviceIcon(listing.deviceType).icon}</div>
                          <p className="text-xs text-[var(--color-text-muted)] font-medium">
                            {getDeviceIcon(listing.deviceType).label}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {getTrustBadge(listing.trustLensStatus)}
                        {getConditionBadge(listing.conditionGrade)}
                      </div>
                      <h3 className="font-semibold text-sm mb-1 text-[var(--color-text)] line-clamp-2">
                        {listing.title}
                      </h3>
                      <p className="text-xs text-[var(--color-text-muted)] mb-2">
                        {listing.brand} {listing.model}
                      </p>
                      <div className="flex justify-between items-center">
                        <p className="text-lg font-bold text-[var(--color-text)]">
                          {formatPrice(listing.price, listing.currency)}
                        </p>
                        <span className="text-sm text-[var(--color-green)] hover:text-[var(--color-green-dark)] hover:underline" aria-hidden="true">
                          View Details →
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* PERF-10: Previous / Next pagination controls */}
          {!loading && !error && totalPages > 1 && (
            <nav
              aria-label="Listings pagination"
              className="flex items-center justify-center gap-4 mt-8"
            >
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="px-4 py-2 border border-[var(--color-border)] rounded-md text-sm font-medium hover:bg-[var(--color-surface-alt)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span aria-hidden="true">←</span> Previous
              </button>

              <span className="text-sm text-[var(--color-text-muted)]">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="px-4 py-2 border border-[var(--color-border)] rounded-md text-sm font-medium hover:bg-[var(--color-surface-alt)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <span aria-hidden="true">→</span>
              </button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
