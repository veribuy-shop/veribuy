import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ListingCard } from '@/src/components/ListingCard';
import { EmptyState, Screen } from '@/src/components/ui';
import { listingsService } from '@/src/services';
import { Listing } from '@/src/types/entities';

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Smartphones', value: 'SMARTPHONE' },
  { label: 'Tablets', value: 'TABLET' },
  { label: 'Laptops', value: 'LAPTOP' },
  { label: 'Audio', value: 'AUDIO' },
];

export default function HomeScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

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
        setListings((prev) => (append ? [...prev, ...res.data] : res.data));
        setTotalPages(res.pagination.totalPages);
        setPage(targetPage);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [],
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

  return (
    <Screen style={{ paddingTop: 54 }}>
      {/* Header Branding & Value Prop */}
      <View className="mb-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-3xl font-black text-primary tracking-tight">VeriBuy</Text>
          <View className="bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <Text className="text-emerald-800 text-[11px] font-bold">🛡️ Escrow Verified</Text>
          </View>
        </View>
        <Text className="text-text-muted text-xs mt-0.5">
          Verified Electronics &bull; 0% Seller Commission &bull; 48hr Inspection Guarantee
        </Text>
      </View>

      {/* Search Bar */}
      <View className="mb-3">
        <TextInput
          placeholder="Search phones, tablets, laptops…"
          placeholderTextColor="#888888"
          value={search}
          onChangeText={setSearch}
          className="bg-surface border border-borderc rounded-xl px-4 py-3 text-text text-sm"
        />
      </View>

      {/* Category Chips */}
      <View className="mb-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.value;
            return (
              <TouchableOpacity
                key={cat.label}
                onPress={() => setSelectedCategory(cat.value)}
                className={`px-3.5 py-1.5 rounded-full mr-2 border ${
                  isSelected
                    ? 'bg-primary border-primary'
                    : 'bg-surface border-borderc'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    isSelected ? 'text-white' : 'text-text'
                  }`}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Listings List */}
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ListingCard listing={item} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#232F3E" style={{ marginTop: 40 }} />
          ) : (
            <EmptyState
              title="No devices found"
              subtitle="Try clearing filters or search with another keyword."
            />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color="#232F3E" style={{ marginVertical: 12 }} />
          ) : null
        }
      />
    </Screen>
  );
}

