import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { BrandLogo } from '@/src/components/BrandLogo';
import { ListingCard } from '@/src/components/ListingCard';
import { EmptyState, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { listingsService } from '@/src/services';
import { Listing } from '@/src/types/entities';

const CATEGORIES = [
  { label: 'All', value: '', icon: '⚡', subtitle: 'All devices' },
  { label: 'Smartphones', value: 'SMARTPHONE', icon: '📱', subtitle: 'iPhone, Pixel, Galaxy' },
  { label: 'Laptops', value: 'LAPTOP', icon: '💻', subtitle: 'Apple Silicon & PC' },
  { label: 'Tablets', value: 'TABLET', icon: '📟', subtitle: 'iPad, Galaxy Tab' },
  { label: 'Smartwatches', value: 'SMARTWATCH', icon: '⌚', subtitle: 'Apple Watch, Garmin' },
  { label: 'Audio', value: 'AIRPODS', icon: '🎧', subtitle: 'AirPods, Sony' },
  { label: 'Gaming', value: 'GAMING_CONSOLE', icon: '🎮', subtitle: 'PS5, Xbox, Switch' },
  { label: 'Desktops', value: 'DESKTOP', icon: '🖥️', subtitle: 'Mac Studio, PC' },
];

// Showcase devices matching VeriBuy Trust Core specifications
const SHOWCASE_LISTINGS: Listing[] = [
  {
    id: 'showcase-1',
    sellerId: 'demo-seller-1',
    title: 'iPhone 14 Pro Max 256GB',
    description: 'Pristine condition iPhone 14 Pro Max. Battery health 94%. Unlocked to all UK networks. Fully certified via Trust Lens™.',
    deviceType: 'SMARTPHONE',
    brand: 'Apple',
    model: 'iPhone 14 Pro Max',
    storageCapacity: '256GB',
    color: 'Space Black',
    condition: 'EXCELLENT',
    conditionGrade: 'A',
    price: 799,
    originalPrice: 1199,
    batteryHealth: 94,
    checksSummary: ['OLED Screen OEM', 'Face ID Active', '0 Scratches'],
    currency: 'GBP',
    freeShipping: true,
    status: 'ACTIVE',
    trustLensStatus: 'VERIFIED',
    images: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'showcase-2',
    sellerId: 'demo-seller-2',
    title: 'Galaxy S23 Ultra 512GB',
    description: 'Like new Samsung Galaxy S23 Ultra with S-Pen included. Factory unlocked, dual SIM, 5G ready.',
    deviceType: 'SMARTPHONE',
    brand: 'Samsung',
    model: 'Galaxy S23 Ultra',
    storageCapacity: '512GB',
    color: 'Phantom Black',
    condition: 'EXCELLENT',
    conditionGrade: 'A',
    price: 699,
    originalPrice: 1249,
    batteryHealth: 97,
    checksSummary: ['Knox Unbroken', 'S-Pen Latency Normal', '100x Zoom Verified'],
    currency: 'GBP',
    freeShipping: true,
    status: 'ACTIVE',
    trustLensStatus: 'VERIFIED',
    images: ['https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'showcase-3',
    sellerId: 'demo-seller-3',
    title: 'Pixel 8 Pro 128GB',
    description: 'Google Pixel 8 Pro in Porcelain with Google Tensor G3. Clean GSMA registry and immaculate cameras.',
    deviceType: 'SMARTPHONE',
    brand: 'Google',
    model: 'Pixel 8 Pro',
    storageCapacity: '128GB',
    color: 'Porcelain',
    condition: 'GOOD',
    conditionGrade: 'B',
    price: 519,
    originalPrice: 999,
    batteryHealth: 91,
    checksSummary: ['Clean Camera Visor', 'Thermometer OK', 'Micro-nick on bezel'],
    currency: 'GBP',
    freeShipping: false,
    status: 'ACTIVE',
    trustLensStatus: 'VERIFIED',
    images: ['https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'showcase-4',
    sellerId: 'demo-seller-4',
    title: 'iPhone 13 128GB',
    description: 'Midnight iPhone 13 with Dual Camera system. Clean IMEI and 96% original battery health.',
    deviceType: 'SMARTPHONE',
    brand: 'Apple',
    model: 'iPhone 13',
    storageCapacity: '128GB',
    color: 'Midnight',
    condition: 'EXCELLENT',
    conditionGrade: 'A',
    price: 349,
    originalPrice: 599,
    batteryHealth: 96,
    checksSummary: ['Original Screen', 'TrueTone Active', 'Original Box'],
    currency: 'GBP',
    freeShipping: true,
    status: 'ACTIVE',
    trustLensStatus: 'VERIFIED',
    images: ['https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'showcase-5',
    sellerId: 'demo-seller-5',
    title: 'MacBook Pro 14" M2 Pro 16GB / 512GB',
    description: 'Apple Silicon M2 Pro 10-core CPU, 16-core GPU, Liquid Retina XDR display. Battery health 100%, 32 cycles.',
    deviceType: 'LAPTOP',
    brand: 'Apple',
    model: 'MacBook Pro 14"',
    storageCapacity: '512GB',
    color: 'Space Grey',
    condition: 'EXCELLENT',
    conditionGrade: 'A',
    price: 1399,
    originalPrice: 1999,
    batteryHealth: 100,
    checksSummary: ['100% Battery', '32 Cycles', 'MagSafe Included'],
    currency: 'GBP',
    freeShipping: false,
    status: 'ACTIVE',
    trustLensStatus: 'VERIFIED',
    images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'showcase-6',
    sellerId: 'demo-seller-6',
    title: 'iPad Air 5th Gen 256GB Wi-Fi',
    description: 'M1 chip iPad Air in Starlight. Crisp 10.9-inch Liquid Retina display with True Tone. Great battery.',
    deviceType: 'TABLET',
    brand: 'Apple',
    model: 'iPad Air (5th Gen)',
    storageCapacity: '256GB',
    color: 'Starlight',
    condition: 'GOOD',
    conditionGrade: 'B',
    price: 489,
    originalPrice: 699,
    batteryHealth: 92,
    checksSummary: ['Clean Screen', 'TrueTone Active', 'Box Included'],
    currency: 'GBP',
    freeShipping: true,
    status: 'ACTIVE',
    trustLensStatus: 'VERIFIED',
    images: ['https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=80'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function HomeScreen() {
  const { user, isAuthenticated } = useAuth();
  const [listings, setListings] = useState<Listing[]>(SHOWCASE_LISTINGS);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const filterShowcase = useCallback((term: string, cat: string) => {
    let result = SHOWCASE_LISTINGS;
    if (cat) {
      result = result.filter((item) => item.deviceType === cat);
    }
    if (term) {
      const q = term.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.brand.toLowerCase().includes(q) ||
          item.model.toLowerCase().includes(q),
      );
    }
    return result;
  }, []);

  const load = useCallback(
    async (targetPage = 1, append = false, term?: string, cat?: string) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await listingsService.list({
          page: targetPage,
          limit: 10,
          status: 'ACTIVE',
          search: term || undefined,
          deviceType: cat || undefined,
        });
        if (res?.data && res.data.length > 0) {
          setListings((prev) => (append ? [...prev, ...res.data] : res.data));
          setTotalPages(res.pagination.totalPages);
          setPage(targetPage);
        } else {
          const showcaseFiltered = filterShowcase(term || '', cat || '');
          setListings((prev) => (append ? prev : showcaseFiltered));
          setTotalPages(1);
          setPage(1);
        }
      } catch {
        const showcaseFiltered = filterShowcase(term || '', cat || '');
        setListings(showcaseFiltered);
        setTotalPages(1);
        setPage(1);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [filterShowcase],
  );

  useEffect(() => {
    load(1, false, search, selectedCategory);
  }, [load, search, selectedCategory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(1, false, search, selectedCategory);
  }, [load, search, selectedCategory]);

  const onEndReached = useCallback(() => {
    if (page < totalPages && !loadingMore) {
      load(page + 1, true, search, selectedCategory);
    }
  }, [page, totalPages, loadingMore, load, search, selectedCategory]);

  const renderHeader = () => (
    <View className="mb-4">
      {/* ── Top Navbar: Brand Logo & Actions (Matching screen4.png) ─────────── */}
      <View className="flex-row items-center justify-between mb-3 pt-2">
        <View className="flex-row items-center gap-2">
          <BrandLogo height={46} />
          <View className="hidden sm:flex">
            <Text className="text-xs font-bold text-text-muted">Explore Marketplace</Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2.5">
          <TouchableOpacity
            onPress={() => router.push('/(main)')}
            className="w-9 h-9 rounded-full bg-surface border border-borderc items-center justify-center shadow-xs"
          >
            <Text className="text-sm">🔍</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(main)/orders')}
            className="w-9 h-9 rounded-full bg-surface border border-borderc items-center justify-center relative shadow-xs"
          >
            <Text className="text-sm">🔔</Text>
            <View className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push(isAuthenticated ? '/(main)/profile' : '/login')}
            className="w-9 h-9 rounded-full bg-[#0B192C] items-center justify-center shadow-xs"
          >
            <Text className="text-xs font-bold text-white">
              {isAuthenticated ? user?.name?.slice(0, 1).toUpperCase() || '👤' : '👤'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search Bar (Matching screen4.png) ────────────────────────────────── */}
      <View className="flex-row items-center bg-[#eff4ff] border border-borderc rounded-2xl p-1 mb-4 shadow-xs">
        <View className="pl-3 pr-2">
          <Text className="text-sm text-text-muted">🔍</Text>
        </View>
        <TextInput
          placeholder="Search IMEI, model, serial (e.g. iPhone 1..."
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
          className="flex-1 py-2 text-text text-xs font-medium"
          returnKeyType="search"
          onSubmitEditing={() => load(1, false, search, selectedCategory)}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} className="px-2">
            <Text className="text-xs text-text-muted">✕</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => load(1, false, search, selectedCategory)}
          className="bg-[#0B192C] px-4 py-2 rounded-xl items-center justify-center active:opacity-90"
        >
          <Text className="text-white font-bold text-xs">Search</Text>
        </TouchableOpacity>
      </View>

      {/* ── Deep Navy Hero Banner (Matching screen4.png) ───────────────────── */}
      <View className="bg-[#0B192C] rounded-2xl p-4.5 mb-4 shadow-md border border-[#16273e]">
        <View className="flex-row items-center justify-between mb-2">
          <View className="bg-emerald-500/20 border border-emerald-400/50 px-2.5 py-0.5 rounded-full">
            <Text className="text-[10px] font-extrabold text-emerald-300 tracking-wider">
              🛡️ Trust Lens™ Certified
            </Text>
          </View>
          <Text className="text-[10px] font-extrabold text-slate-300 tracking-widest">
            UK ESCROW
          </Text>
        </View>

        <Text className="text-white text-xl font-black leading-tight tracking-tight mt-1">
          Buy &amp; Sell Electronics
        </Text>
        <Text className="text-[#86f2e4] text-xl font-black leading-tight tracking-tight">
          With 100% Escrow
        </Text>
        <Text className="text-slate-300 text-xs mt-1.5 leading-relaxed font-normal">
          Every device has its IMEI, cloud lock status, and battery authenticated before going live. Zero scams. Zero hidden defects.
        </Text>

        {/* 3 Grid Badges */}
        <View className="grid grid-cols-3 flex-row gap-2 mt-3.5 pt-3 border-t border-slate-700/60">
          <View className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2 items-center text-center">
            <Text className="text-xs mb-0.5">🔒</Text>
            <Text className="text-[11px] font-bold text-white">100% Escrow</Text>
            <Text className="text-[9px] text-slate-300">Funds Safe</Text>
          </View>
          <View className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2 items-center text-center">
            <Text className="text-xs mb-0.5">🛡️</Text>
            <Text className="text-[11px] font-bold text-white">48h Return</Text>
            <Text className="text-[9px] text-slate-300">Inspection</Text>
          </View>
          <View className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2 items-center text-center">
            <Text className="text-xs mb-0.5">%</Text>
            <Text className="text-[11px] font-bold text-white">0% Seller Fee</Text>
            <Text className="text-[9px] text-slate-300">Keep Payout</Text>
          </View>
        </View>
      </View>

      {/* ── Shop by Category (Matching screen4.png) ────────────────────────── */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-2.5">
          <View>
            <Text className="text-sm font-black text-text">Shop by Category</Text>
            <Text className="text-[11px] text-text-muted">Pre-inspected tier-1 hardware</Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedCategory('')}>
            <Text className="text-xs font-bold text-emerald-700">All (1.4k) ›</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.value;
            return (
              <TouchableOpacity
                key={cat.label}
                onPress={() => setSelectedCategory(cat.value)}
                className={`flex-row items-center p-3 rounded-2xl mr-2.5 border shadow-xs min-w-[140px] ${
                  isSelected
                    ? 'bg-[#0B192C] border-[#0B192C]'
                    : 'bg-surface border-borderc'
                }`}
              >
                <Text className="text-2xl mr-2">{cat.icon}</Text>
                <View>
                  <Text
                    className={`text-xs font-black ${
                      isSelected ? 'text-white' : 'text-text'
                    }`}
                  >
                    {cat.label}
                  </Text>
                  <Text
                    className={`text-[9px] ${
                      isSelected ? 'text-slate-300' : 'text-text-muted'
                    }`}
                    numberOfLines={1}
                  >
                    {cat.subtitle}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Live Escrow Auction Spotlight Card (Matching screen4.png) ───────── */}
      <View className="bg-surface rounded-2xl border border-borderc p-3.5 mb-4 shadow-sm">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-1.5">
            <View className="w-2 h-2 rounded-full bg-rose-500" />
            <Text className="text-[10px] font-black text-rose-600 tracking-wider uppercase">
              Live Escrow Auction
            </Text>
          </View>
          <View className="bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
            <Text className="text-[9px] font-bold text-slate-700">🛡️ Anti-Sniping Soft Close</Text>
          </View>
        </View>

        <View className="flex-row items-center gap-3">
          <View className="w-24 h-24 rounded-xl bg-surface-canvas overflow-hidden items-center justify-center border border-borderc">
            <Text className="text-3xl">📟</Text>
            <View className="absolute bottom-1 bg-black/75 px-1.5 py-0.5 rounded text-center">
              <Text className="text-[8px] font-black text-white">1TB M2</Text>
            </View>
          </View>

          <View className="flex-1">
            <Text className="text-text font-black text-sm">iPad Pro 11" M2 (128GB)</Text>
            <Text className="text-text-muted text-[11px] mb-1.5">
              Space Grey • Wi-Fi • Mint Condition
            </Text>

            <View className="flex-row items-baseline gap-1.5 mb-1">
              <Text className="text-text-muted text-[10px]">Current Bid</Text>
              <Text className="text-text font-black text-base">£420.00</Text>
            </View>

            <View className="flex-row items-center justify-between mt-1">
              <Text className="text-rose-600 font-bold text-[10px]">⏱ 02h 14m 27s left</Text>
              <TouchableOpacity
                onPress={() => router.push('/(main)')}
                className="bg-[#0B192C] px-3 py-1.5 rounded-xl flex-row items-center gap-1"
              >
                <Text className="text-white text-[10px] font-bold">Place Bid 🔨</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View className="mt-2.5 pt-2 border-t border-borderc flex-row items-center justify-between">
          <Text className="text-[10px] font-semibold text-emerald-700">
            🛡️ 16 Authenticated Bidders
          </Text>
          <Text className="text-[10px] text-text-muted">100% Escrow Backed</Text>
        </View>
      </View>

      {/* ── Section Title: Just Verified (Matching screen4.png) ─────────────── */}
      <View className="flex-row items-center justify-between mt-2 mb-2 pt-2 border-t border-borderc">
        <View>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-xs text-emerald-600 font-bold">✓</Text>
            <Text className="text-sm font-black text-text">Just Verified</Text>
          </View>
          <Text className="text-[10px] text-text-muted">Cleared GSMA &amp; battery diagnostic today</Text>
        </View>
        <TouchableOpacity onPress={() => setSelectedCategory('')}>
          <Text className="text-xs font-bold text-emerald-700">View All ({listings.length}) ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFooter = () => (
    <View className="mt-6 mb-8">
      {/* ── How Trust Lens™ Protects You (Matching screen4.png) ─────────────── */}
      <View className="bg-surface rounded-2xl border border-borderc p-4 mb-4 shadow-sm">
        <View className="flex-row items-center gap-1.5 mb-1">
          <Text className="text-xs text-emerald-600 font-bold">🛡️</Text>
          <Text className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest">
            Complete Protection Protocol
          </Text>
        </View>
        <Text className="text-text font-black text-base mb-1">
          How Trust Lens™ Protects You
        </Text>
        <Text className="text-text-muted text-xs mb-3.5 leading-relaxed">
          Our 4-stage automated and physical verification eliminates blacklists, cloud locks, and non-disclosure.
        </Text>

        {/* 4 Protocol Steps */}
        <View className="space-y-2.5">
          <View className="flex-row gap-3 bg-surface-canvas p-3 rounded-xl border border-borderc">
            <View className="w-7 h-7 rounded-full bg-[#0B192C] items-center justify-center">
              <Text className="text-white text-xs font-black">01</Text>
            </View>
            <View className="flex-1">
              <Text className="text-text font-bold text-xs">Seller Lists Device &amp; IMEI</Text>
              <Text className="text-text-muted text-[11px] leading-tight mt-0.5">
                Seller provides condition tier (A/B/C), 15-digit IMEI, and timestamped photo proof of physical state.
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3 bg-surface-canvas p-3 rounded-xl border border-borderc">
            <View className="w-7 h-7 rounded-full bg-emerald-700 items-center justify-center">
              <Text className="text-white text-xs font-black">02</Text>
            </View>
            <View className="flex-1">
              <Text className="text-text font-bold text-xs">Trust Lens™ Authentication</Text>
              <Text className="text-text-muted text-[11px] leading-tight mt-0.5">
                Automated queries cross-reference GSMA worldwide database, police loss registries, and iCloud/Knox locks.
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3 bg-surface-canvas p-3 rounded-xl border border-borderc">
            <View className="w-7 h-7 rounded-full bg-blue-900 items-center justify-center">
              <Text className="text-white text-xs font-black">03</Text>
            </View>
            <View className="flex-1">
              <Text className="text-text font-bold text-xs">100% Escrow Checkout</Text>
              <Text className="text-text-muted text-[11px] leading-tight mt-0.5">
                Buyer payment is secured via Stripe escrow vault. Seller cannot touch funds until tracked delivery is logged.
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3 bg-surface-canvas p-3 rounded-xl border border-borderc">
            <View className="w-7 h-7 rounded-full bg-emerald-600 items-center justify-center">
              <Text className="text-white text-xs font-black">04</Text>
            </View>
            <View className="flex-1">
              <Text className="text-text font-bold text-xs">48-Hour Inspection Window</Text>
              <Text className="text-text-muted text-[11px] leading-tight mt-0.5">
                You test the hardware for 48 hours. Satisfied? Funds disburse to the seller with £0 seller commission deducted.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Why VeriBuy vs Classifieds? Table (Matching screen4.png) ────────── */}
      <View className="bg-surface rounded-2xl border border-borderc p-4 mb-4 shadow-sm">
        <View className="flex-row items-center gap-1.5 mb-1">
          <Text className="text-sm">⚖️</Text>
          <Text className="text-text font-black text-sm">Why VeriBuy vs Classifieds?</Text>
        </View>
        <Text className="text-text-muted text-xs mb-3">
          Protecting buyers and honest sellers from secondary market fraud.
        </Text>

        <View className="space-y-2">
          <View className="bg-surface-canvas p-2.5 rounded-xl border border-borderc">
            <Text className="text-[11px] font-bold text-text mb-1">GSMA &amp; IMEI Blacklist Check</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-bold text-emerald-700">✓ 100% Pre-Screened</Text>
              <Text className="text-[10px] text-text-muted">✕ None (High Risk)</Text>
            </View>
          </View>

          <View className="bg-surface-canvas p-2.5 rounded-xl border border-borderc">
            <Text className="text-[11px] font-bold text-text mb-1">Payment Protection</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-bold text-emerald-700">✓ 100% Escrow Vault</Text>
              <Text className="text-[10px] text-text-muted">✕ Bank / Cash Only</Text>
            </View>
          </View>

          <View className="bg-surface-canvas p-2.5 rounded-xl border border-borderc">
            <Text className="text-[11px] font-bold text-text mb-1">Inspection Guarantee</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-bold text-emerald-700">✓ 48h Return Window</Text>
              <Text className="text-[10px] text-text-muted">✕ Sold As Seen</Text>
            </View>
          </View>

          <View className="bg-surface-canvas p-2.5 rounded-xl border border-borderc">
            <Text className="text-[11px] font-bold text-text mb-1">Seller Platform Fee</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-bold text-emerald-700">✓ 0% Commission</Text>
              <Text className="text-[10px] text-text-muted">✕ 10% – 15% Fees</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Bottom Callout Banner (Matching screen4.png) ───────────────────── */}
      <View className="bg-[#0B192C] rounded-2xl p-4.5 mb-6 border border-[#16273e]">
        <Text className="text-[10px] font-extrabold text-emerald-400 tracking-wider uppercase mb-1">
          Zero Risk Guarantee
        </Text>
        <Text className="text-white text-lg font-black leading-tight mb-1">
          Ready to Upgrade or Liquidate Gear?
        </Text>
        <Text className="text-slate-300 text-xs mb-3.5 leading-relaxed">
          Join thousands of UK tech enthusiasts buying and selling with certified protection.
        </Text>

        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => load(1, false, '', '')}
            className="flex-1 bg-emerald-600 py-2.5 rounded-xl items-center active:opacity-90"
          >
            <Text className="text-white font-bold text-xs">🔍 Browse Deals</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(main)/sell')}
            className="flex-1 bg-white/10 border border-white/20 py-2.5 rounded-xl items-center active:opacity-90"
          >
            <Text className="text-white font-bold text-xs">⊕ Sell at 0% Fee</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <Screen style={{ paddingTop: Platform.OS === 'web' ? 16 : 46 }}>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ListingCard listing={item} />}
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: Platform.OS === 'web' ? 12 : 0 }}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#059669" style={{ marginTop: 40 }} />
          ) : (
            <EmptyState
              title="No devices found"
              subtitle="Try clearing filters or search with another device model."
            />
          )
        }
      />
    </Screen>
  );
}
