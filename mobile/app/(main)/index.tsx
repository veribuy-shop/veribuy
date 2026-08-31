import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ListingCard } from '@/src/components/ListingCard';
import { EmptyState, Screen } from '@/src/components/ui';
import { listingsService } from '@/src/services';
import { Listing } from '@/src/types/entities';

export default function HomeScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async (targetPage = 1, append = false, term?: string) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await listingsService.list({
        page: targetPage,
        limit: 10,
        status: 'ACTIVE',
        search: term || undefined,
      });
      setListings((prev) => (append ? [...prev, ...res.data] : res.data));
      setTotalPages(res.pagination.totalPages);
      setPage(targetPage);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load(1, false, search);
  }, [load, search]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(1, false, search);
  }, [load, search]);

  const onEndReached = useCallback(() => {
    if (page < totalPages && !loadingMore) {
      load(page + 1, true, search);
    }
  }, [page, totalPages, loadingMore, load, search]);

  return (
    <Screen style={{ paddingTop: 64 }}>
      <Text className="text-3xl font-bold text-primary mb-2">VeriBuy</Text>
      <View className="mb-3">
        <TextInput
          placeholder="Search verified electronics…"
          placeholderTextColor="#AAAAAA"
          value={search}
          onChangeText={setSearch}
          className="bg-surface border border-borderc rounded-lg px-3 py-3 text-text"
        />
      </View>
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
            <EmptyState title="No listings found" subtitle="Check back soon or adjust your search." />
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
