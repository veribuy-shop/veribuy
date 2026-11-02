import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, Text, View } from 'react-native';

import { Button, EmptyState, LoadingState, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { formatPrice } from '@/src/lib/currency';
import { listingsService } from '@/src/services';
import { Listing } from '@/src/types/entities';

function statusFor(listing: Listing): { label: string; className: string } {
  switch (listing.status) {
    case 'ACTIVE':
      return { label: 'Live', className: 'bg-emerald-100 text-emerald-800' };
    case 'SOLD':
      return { label: 'Sold', className: 'bg-surface-container text-text' };
    case 'REJECTED':
      return { label: 'Not approved', className: 'bg-discount-crimson-bg text-danger' };
    case 'DELISTED':
    case 'INACTIVE':
      return { label: 'Not listed', className: 'bg-surface-container text-text-muted' };
    case 'AUCTION_ENDED':
      return { label: 'Auction ended', className: 'bg-surface-container text-text' };
    default:
      return { label: 'In review', className: 'bg-grade-c-bg text-grade-c-text' };
  }
}

/** Everything the seller has listed, including what's still with Trust Lens. */
export default function MyListingsScreen() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setListings(await listingsService.bySeller(user.id));
      setError('');
    } catch (e: any) {
      setError(e?.message || 'We could not load your listings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) return <LoadingState />;

  return (
    <Screen>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        renderItem={({ item }) => {
          const status = statusFor(item);
          const [statusBackground, statusText] = status.className.split(' ');
          const image = item.imageUrl || item.images?.[0];
          return (
            <Pressable
              onPress={() => router.push(`/listing/${item.id}`)}
              accessibilityRole="link"
              className="flex-row bg-surface rounded-2xl border border-borderc p-3 mb-2 active:opacity-90"
            >
              <View className="w-16 h-16 rounded-xl bg-surface-alt overflow-hidden mr-3 items-center justify-center">
                {image ? <Image source={{ uri: image }} className="w-full h-full" /> : null}
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-text leading-5" numberOfLines={2}>
                  {item.title}
                </Text>
                <View className="flex-row items-center justify-between mt-1.5">
                  <Text className="text-[15px] font-bold text-text">{formatPrice(Number(item.price), item.currency)}</Text>
                  <View className={`px-2.5 py-0.5 rounded-full ${statusBackground}`}>
                    <Text className={`text-xs font-semibold ${statusText}`}>{status.label}</Text>
                  </View>
                </View>
                {item.status !== 'SOLD' ? (
                  <Pressable
                    onPress={() => router.push(`/listing/edit/${item.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${item.title}`}
                    hitSlop={8}
                    className="self-start mt-1.5"
                  >
                    <Text className="text-[13px] font-semibold text-primary">Edit</Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View>
            <EmptyState
              title={error ? 'Listings unavailable' : 'No listings yet'}
              subtitle={error || 'List a device and it will appear here.'}
            />
            {!error ? <Button onPress={() => router.push('/(main)/sell')}>Sell a device</Button> : null}
          </View>
        }
      />
    </Screen>
  );
}
