import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { EXAMPLE_LISTINGS, ExampleListing, ExampleListingCard, ListingCard } from '@/src/components/ListingCard';
import { EmptyState, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { listingsService, messagesService } from '@/src/services';
import { Listing } from '@/src/types/entities';

const CATEGORIES: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'All', value: '', icon: 'grid-outline' },
  { label: 'Phones', value: 'SMARTPHONE', icon: 'phone-portrait-outline' },
  { label: 'Laptops', value: 'LAPTOP', icon: 'laptop-outline' },
  { label: 'Tablets', value: 'TABLET', icon: 'tablet-portrait-outline' },
  { label: 'Watches', value: 'SMARTWATCH', icon: 'watch-outline' },
  { label: 'Earbuds', value: 'AIRPODS', icon: 'headset-outline' },
  { label: 'Gaming', value: 'GAMING_CONSOLE', icon: 'game-controller-outline' },
  { label: 'Desktops', value: 'DESKTOP', icon: 'desktop-outline' },
];

// Showcase devices matching VeriBuy Trust Core specifications
export default function HomeScreen() {
  const { user, isAuthenticated } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loadError, setLoadError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const listRef = useRef<FlatList<Listing | ExampleListing>>(null);

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
        const rows = res?.data ?? [];
        setListings((prev) => (append ? [...prev, ...rows] : rows));
        setTotalPages(res?.pagination?.totalPages ?? 1);
        setPage(targetPage);
        setLoadError('');
      } catch {
        // Never substitute sample listings: show the real state and a retry.
        if (!append) setListings([]);
        setLoadError('We could not load listings. Check your connection and pull down to try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  // Real unread count for the messages shortcut (no decorative dots).
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setUnreadCount(0);
      return;
    }
    messagesService
      .unreadCount(user.id)
      .then((res) => setUnreadCount(Number(res?.count) || 0))
      .catch(() => setUnreadCount(0));
  }, [isAuthenticated, user?.id]);

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
    <View className="mb-2">
      <View className="flex-row items-center justify-between mb-3">
        <BrandLogo height={40} />
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => router.push(isAuthenticated ? '/(main)/messages' : '/(auth)/login')}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `Messages, ${unreadCount} unread` : 'Messages'}
            className="w-10 h-10 rounded-full bg-surface border border-borderc items-center justify-center"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={19} color="#232F3E" />
            {unreadCount > 0 ? (
              <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger items-center justify-center">
                <Text className="text-[11px] font-semibold text-white">{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push(isAuthenticated ? '/(main)/profile' : '/(auth)/login')}
            accessibilityRole="button"
            accessibilityLabel={isAuthenticated ? 'Your account' : 'Sign in'}
            className="w-10 h-10 rounded-full bg-primary items-center justify-center"
          >
            {isAuthenticated && user?.name ? (
              <Text className="text-sm font-semibold text-white">{user.name.slice(0, 1).toUpperCase()}</Text>
            ) : (
              <Ionicons name="person-outline" size={19} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-row items-center bg-surface border border-borderc rounded-xl h-12 pl-3.5 pr-1.5 mb-4">
        <Ionicons name="search-outline" size={18} color="#565959" />
        <TextInput
          placeholder="Search phones, laptops, tablets…"
          placeholderTextColor="#6F7373"
          value={search}
          onChangeText={setSearch}
          className="flex-1 ml-2.5 text-[15px] text-text"
          returnKeyType="search"
          onSubmitEditing={() => load(1, false, search, selectedCategory)}
          accessibilityLabel="Search listings"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Clear search" className="p-2">
            <Ionicons name="close-circle" size={18} color="#8A8A8A" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View className="bg-primary rounded-2xl p-5 mb-5">
        <View className="flex-row items-center gap-1.5 mb-2.5">
          <Ionicons name="shield-checkmark" size={15} color="#8FC4A5" />
          <Text className="text-[13px] font-semibold text-emerald-300">Trust Lens verified</Text>
        </View>
        <Text className="text-white text-[26px] leading-8 font-bold">Pre-owned tech,{'\n'}checked before you buy</Text>
        <Text className="text-white/80 text-sm mt-2.5 leading-5">
          Phones are IMEI-checked and every listing is reviewed. Your payment is held until you confirm delivery.
        </Text>
        <View className="flex-row mt-4 pt-4 border-t border-white/15">
          {[
            { icon: 'lock-closed-outline', title: 'Payment held', note: 'until delivery' },
            { icon: 'time-outline', title: '48 hours', note: 'to report a problem' },
            { icon: 'pricetag-outline', title: '0% seller fee', note: 'keep your payout' },
          ].map((item) => (
            <View key={item.title} className="flex-1 pr-2">
              <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color="#FFB84D" />
              <Text className="text-white text-[13px] font-semibold mt-1.5">{item.title}</Text>
              <Text className="text-white/70 text-[11px] mt-0.5">{item.note}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text className="text-lg font-bold text-text mb-2.5">Shop by category</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-5 -mx-4"
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.value;
          return (
            <TouchableOpacity
              key={cat.label}
              onPress={() => setSelectedCategory(cat.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              className={`flex-row items-center h-11 px-3.5 rounded-full mr-2 border ${
                isSelected ? 'bg-primary border-primary' : 'bg-surface border-borderc'
              }`}
            >
              <Ionicons name={cat.icon} size={17} color={isSelected ? '#FFFFFF' : '#232F3E'} />
              <Text className={`text-sm font-medium ml-1.5 ${isSelected ? 'text-white' : 'text-text'}`}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text className="text-lg font-bold text-text">
        {selectedCategory
          ? CATEGORIES.find((cat) => cat.value === selectedCategory)?.label
          : search
            ? 'Search results'
            : 'Latest listings'}
      </Text>
      {showsExamples ? (
        <Text className="text-[13px] text-text-muted mt-1 mb-1 leading-[18px]">
          Cards marked Example show the kind of devices listed here, not items for sale.
        </Text>
      ) : null}
      <View className="h-2" />
    </View>
  );

  // Default feed mirrors the web homepage: live listings with a photo, topped
  // up with labelled examples. Searching or filtering shows every real result.
  const browsingAll = !search && !selectedCategory;
  const feed: (Listing | ExampleListing)[] = useMemo(() => {
    if (!browsingAll) return listings;
    const withPhotos = listings.filter((listing) => listing.imageUrl || listing.images?.[0]);
    if (loading || loadError) return withPhotos;
    return [...withPhotos, ...EXAMPLE_LISTINGS.slice(0, Math.max(0, 4 - withPhotos.length))];
  }, [browsingAll, listings, loading, loadError]);
  const showsExamples = feed.some((item) => item.id.startsWith('example-'));

  const renderFooter = () => (
    <View className="mt-6 mb-8">
      {/* ── How Trust Lens™ Protects You (Matching screen4.png) ─────────────── */}
      <View className="bg-surface rounded-2xl border border-borderc p-4 mb-4 shadow-sm">
        <View className="flex-row items-center gap-1.5 mb-1">
          <Ionicons name="shield-checkmark" size={14} color="#2D7A4F" />
          <Text className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-widest">
            Buyer protection
          </Text>
        </View>
        <Text className="text-text font-black text-base mb-1">
          How Trust Lens™ Protects You
        </Text>
        <Text className="text-text-muted text-xs mb-3.5 leading-relaxed">
          How listings are checked and how your payment is protected.
        </Text>

        {/* 4 Protocol Steps */}
        <View className="gap-2.5">
          <View className="flex-row gap-3 bg-surface-canvas p-3 rounded-xl border border-borderc">
            <View className="w-7 h-7 rounded-full bg-[#232F3E] items-center justify-center">
              <Text className="text-white text-xs font-black">01</Text>
            </View>
            <View className="flex-1">
              <Text className="text-text font-bold text-xs">Seller Lists Device &amp; IMEI</Text>
              <Text className="text-text-muted text-[11px] leading-tight mt-0.5">
                The seller grades the condition (A/B/C), adds photos, and gives the IMEI for phones.
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
                Phone IMEIs are checked against stolen and blacklist registries; other devices are reviewed by our team.
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3 bg-surface-canvas p-3 rounded-xl border border-borderc">
            <View className="w-7 h-7 rounded-full bg-blue-900 items-center justify-center">
              <Text className="text-white text-xs font-black">03</Text>
            </View>
            <View className="flex-1">
              <Text className="text-text font-bold text-xs">Escrow checkout</Text>
              <Text className="text-text-muted text-[11px] leading-tight mt-0.5">
                Your payment is held by VeriBuy through Stripe. The seller is paid after you confirm delivery.
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3 bg-surface-canvas p-3 rounded-xl border border-borderc">
            <View className="w-7 h-7 rounded-full bg-emerald-600 items-center justify-center">
              <Text className="text-white text-xs font-black">04</Text>
            </View>
            <View className="flex-1">
              <Text className="text-text font-bold text-xs">48 hours to check it</Text>
              <Text className="text-text-muted text-[11px] leading-tight mt-0.5">
                Check the device after delivery. If it doesn’t match the listing, report a problem before releasing payment.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Why VeriBuy vs Classifieds? Table (Matching screen4.png) ────────── */}
      <View className="bg-surface rounded-2xl border border-borderc p-4 mb-4 shadow-sm">
        <View className="flex-row items-center gap-1.5 mb-1">
          <Ionicons name="scale-outline" size={16} color="#565959" />
          <Text className="text-text font-black text-sm">Why VeriBuy vs Classifieds?</Text>
        </View>
        <Text className="text-text-muted text-xs mb-3">
          Protecting buyers and honest sellers from secondary market fraud.
        </Text>

        <View className="gap-2">
          <View className="bg-surface-canvas p-2.5 rounded-xl border border-borderc">
            <Text className="text-[11px] font-bold text-text mb-1">IMEI check on phones</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-bold text-emerald-700">✓ Every phone listing</Text>
              <Text className="text-[11px] text-text-muted">✕ Usually none</Text>
            </View>
          </View>

          <View className="bg-surface-canvas p-2.5 rounded-xl border border-borderc">
            <Text className="text-[11px] font-bold text-text mb-1">Payment Protection</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-bold text-emerald-700">✓ Escrow until delivery</Text>
              <Text className="text-[11px] text-text-muted">✕ Often bank transfer or cash</Text>
            </View>
          </View>

          <View className="bg-surface-canvas p-2.5 rounded-xl border border-borderc">
            <Text className="text-[11px] font-bold text-text mb-1">After delivery</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-bold text-emerald-700">✓ 48h to report a problem</Text>
              <Text className="text-[11px] text-text-muted">✕ Often sold as seen</Text>
            </View>
          </View>

          <View className="bg-surface-canvas p-2.5 rounded-xl border border-borderc">
            <Text className="text-[11px] font-bold text-text mb-1">Seller Platform Fee</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-bold text-emerald-700">✓ 0% seller commission</Text>
              <Text className="text-[11px] text-text-muted">Varies by platform</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Bottom Callout Banner (Matching screen4.png) ───────────────────── */}
      <View className="bg-[#232F3E] rounded-2xl p-5 mb-6 border border-[#37475A]">

        <Text className="text-white text-lg font-black leading-tight mb-1">
          Ready to Upgrade or Liquidate Gear?
        </Text>
        <Text className="text-slate-300 text-xs mb-3.5 leading-relaxed">
          Buy with Buyer Protection, or list a device with 0% seller commission.
        </Text>

        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => load(1, false, '', '')}
            className="flex-1 bg-emerald-600 py-2.5 rounded-xl items-center active:opacity-90"
          >
            <Text className="text-white font-bold text-xs">Browse Deals</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(main)/sell')}
            className="flex-1 bg-white/10 border border-white/20 py-2.5 rounded-xl items-center active:opacity-90"
          >
            <Text className="text-white font-bold text-xs">⊕ Sell a device</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <Screen safeTop>
      <FlatList
        ref={listRef}
        data={feed}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          item.id.startsWith('example-') ? (
            <ExampleListingCard
              example={item as ExampleListing}
              onPress={() => {
                setSelectedCategory((item as ExampleListing).deviceType);
                listRef.current?.scrollToOffset({ offset: 0, animated: true });
              }}
            />
          ) : (
            <ListingCard listing={item as Listing} />
          )
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#2D7A4F" style={{ marginTop: 40 }} />
          ) : loadError ? (
            <View className="items-center mt-6">
              <EmptyState title="Listings unavailable" subtitle={loadError} />
              <TouchableOpacity
                onPress={() => load(1, false, search, selectedCategory)}
                accessibilityRole="button"
                className="bg-[#2D7A4F] px-5 py-3 rounded-xl"
              >
                <Text className="text-white font-bold text-xs">Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <EmptyState
              title={search || selectedCategory ? 'No devices match' : 'No listings yet'}
              subtitle={
                search || selectedCategory
                  ? 'Try clearing filters or searching for another model.'
                  : 'New verified devices will appear here as sellers list them.'
              }
            />
          )
        }
      />
    </Screen>
  );
}
