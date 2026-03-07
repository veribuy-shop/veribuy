'use client';

import { useState, useEffect, useId } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/lib/currency';

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

const DEVICE_ICONS: Record<DeviceType, { icon: string; bg: string; label: string }> = {
  SMARTPHONE: { icon: '📱', bg: 'from-blue-50 to-blue-100',     label: 'Smartphone' },
  TABLET:     { icon: '⬜', bg: 'from-indigo-50 to-indigo-100', label: 'Tablet' },
  SMARTWATCH: { icon: '⌚', bg: 'from-purple-50 to-purple-100', label: 'Smartwatch' },
};

const DEVICE_TYPES: { value: DeviceType; label: string }[] = [
  { value: 'SMARTPHONE', label: 'Smartphones' },
  { value: 'TABLET', label: 'Tablets' },
  { value: 'SMARTWATCH', label: 'Smartwatches' },
];

/** Fallback icon config for device types no longer offered (legacy data). */
const DEVICE_ICON_FALLBACK = { icon: '📦', bg: 'from-gray-50 to-gray-100', label: 'Device' };
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

  const filterPanelId = 'browse-filter-panel';
  const searchId = useId();
  const minPriceId = useId();
  const maxPriceId = useId();
  const sortId = useId();

  useEffect(() => {
    fetchListings();
  }, [filters]);

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

      if (filters.search) {
        params.append('search', filters.search);
      }

      // Only fetch ACTIVE listings for browse page
      params.append('status', 'ACTIVE');

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

      // Fetch first evidence image for each listing in parallel (best-effort — never fails the page)
      const withImages = await Promise.all(
        rawListings.map(async (listing) => {
          try {
            const evRes = await fetch(`/api/evidence?listingId=${listing.id}`);
            if (evRes.ok) {
              const evData = await evRes.json();
              const firstImage = (evData.items ?? []).find(
                (item: { type: string; fileUrl?: string }) =>
                  item.type === 'DEVICE_IMAGE' && item.fileUrl,
              );
              if (firstImage?.fileUrl) {
                return { ...listing, imageUrl: firstImage.fileUrl };
              }
            }
          } catch {
            // Ignore — fall back to emoji icon
          }
          return listing;
        }),
      );

      setListings(withImages);
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

  const filteredListings = listings.filter(listing => {
    // Filter by condition grade
    if (filters.conditionGrades.length > 0) {
      if (!listing.conditionGrade || !filters.conditionGrades.includes(listing.conditionGrade)) {
        return false;
      }
    }

    // Filter by price range
    const priceValue = typeof listing.price === 'string' ? parseFloat(listing.price) : listing.price;
    if (filters.minPrice && priceValue < parseFloat(filters.minPrice)) {
      return false;
    }
    if (filters.maxPrice && priceValue > parseFloat(filters.maxPrice)) {
      return false;
    }

    return true;
  });

  const sortedListings = [...filteredListings].sort((a, b) => {
    const priceA = typeof a.price === 'string' ? parseFloat(a.price) : a.price;
    const priceB = typeof b.price === 'string' ? parseFloat(b.price) : b.price;
    
    switch (sortBy) {
      case 'price-asc':
        return priceA - priceB;
      case 'price-desc':
        return priceB - priceA;
      case 'newest':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const getTrustBadge = (status: TrustLensStatus) => {
    if (status === 'PASSED') {
      return <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">Verified</span>;
    }
    if (status === 'IN_PROGRESS' || status === 'REQUIRES_REVIEW') {
      // bg-yellow-600 meets WCAG AA contrast on white text (4.5:1)
      return <span className="bg-yellow-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">Under Review</span>;
    }
    return null;
  };

  const getConditionBadge = (grade?: ConditionGrade) => {
    if (!grade) return null;
    
    const colors = {
      A: 'bg-blue-500',
      B: 'bg-green-500',
      // bg-yellow-600 meets WCAG AA contrast on white text
      C: 'bg-yellow-600',
    };

    return (
      <span className={`${colors[grade]} text-white text-xs px-2 py-0.5 rounded-full font-medium`}>
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
        />
      </div>

      {/* Category */}
      <div>
        <h3 className="font-semibold text-sm mb-2" id="category-filter-heading">Category</h3>
        <ul className="space-y-1 text-sm text-[var(--color-text-secondary)]" aria-labelledby="category-filter-heading">
          <li>
            <button
              onClick={() => setFilters(prev => ({ ...prev, deviceType: '' }))}
              aria-pressed={!filters.deviceType}
              className={`hover:text-[var(--color-text)] ${!filters.deviceType ? 'font-semibold text-[var(--color-primary)]' : ''}`}
            >
              All Devices
            </button>
          </li>
          {DEVICE_TYPES.map(type => (
            <li key={type.value}>
              <button
                onClick={() => setFilters(prev => ({ ...prev, deviceType: type.value }))}
                aria-pressed={filters.deviceType === type.value}
                className={`hover:text-[var(--color-text)] ${filters.deviceType === type.value ? 'font-semibold text-[var(--color-primary)]' : ''}`}
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
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
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
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
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
        className="w-full px-4 py-2 text-sm text-[var(--color-primary)] border border-[var(--color-primary)] rounded-md hover:bg-blue-50"
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
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
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
                <span className="ml-2 text-base text-gray-500 font-normal">
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
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              >
                <option value="newest">Newest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {loading && (
            <div role="status" className="text-center py-12">
              <div aria-hidden="true" className="inline-block motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
              <span className="sr-only">Loading listings...</span>
              <p aria-hidden="true" className="mt-4 text-gray-600">Loading listings...</p>
            </div>
          )}

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-600">{error}</p>
              <button
                onClick={fetchListings}
                className="mt-3 px-4 py-2 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && sortedListings.length === 0 && (
            <div className="text-center py-12">
              <div aria-hidden="true" className="text-6xl mb-4">
                {filters.deviceType ? getDeviceIcon(filters.deviceType).icon : '🔍'}
              </div>
              <h3 className="text-xl font-semibold text-[var(--color-text)] mb-2">No listings found</h3>
              <p className="text-gray-600 mb-6">Try adjusting your filters or check back later</p>
              <Link
                href="/listings/create"
                className="inline-block px-6 py-3 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90"
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
                    className="block bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow border border-gray-200 h-full"
                  >
                    {listing.imageUrl ? (
                      <div className="h-48 overflow-hidden bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={listing.imageUrl}
                          alt={listing.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className={`bg-gradient-to-br ${getDeviceIcon(listing.deviceType).bg} h-48 flex items-center justify-center`}>
                        <div className="text-center">
                          <div aria-hidden="true" className="text-5xl mb-1">{getDeviceIcon(listing.deviceType).icon}</div>
                          <p className="text-xs text-gray-400 font-medium">
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
                      <p className="text-xs text-gray-500 mb-2">
                        {listing.brand} {listing.model}
                      </p>
                      <div className="flex justify-between items-center">
                        <p className="text-lg font-bold text-[var(--color-primary)]">
                          {formatPrice(listing.price, listing.currency)}
                        </p>
                        <span className="text-sm text-[var(--color-primary)] hover:underline" aria-hidden="true">
                          View Details →
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
