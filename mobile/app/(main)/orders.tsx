import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View, Pressable } from 'react-native';

import { Card, EmptyState, Screen, StatusPill } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { ordersService } from '@/src/services';
import { Order } from '@/src/types/entities';
import { formatPrice } from '@/src/lib/currency';

export default function OrdersScreen() {
  const { user } = useAuth();
  const [view, setView] = useState<'BUYER' | 'SELLER'>('BUYER');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res =
        view === 'BUYER'
          ? await ordersService.buyerOrders(user.id)
          : await ordersService.sellerOrders(user.id);
      setOrders(res);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, view]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen style={{ paddingTop: 64 }}>
      <Text className="text-2xl font-bold text-primary mb-3">Orders &amp; Escrow</Text>
      <View className="flex-row mb-3">
        {(['BUYER', 'SELLER'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            className={`px-4 py-2 rounded-full mr-2 ${view === v ? 'bg-primary' : 'bg-surface-alt'}`}
          >
            <Text className={view === v ? 'text-white font-semibold' : 'text-text'}>{v === 'BUYER' ? 'My Purchases' : 'My Sales'}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/order/${item.id}`)}>
            <Card>
              <View className="flex-row items-center justify-between">
                <Text className="text-text font-bold text-base">
                  {formatPrice(item.totalAmount || item.amount, item.currency)}
                </Text>
                <StatusPill status={item.status} />
              </View>
              {item.listing?.title ? (
                <Text className="text-text-muted text-sm mt-1 font-medium" numberOfLines={1}>
                  {item.listing.title}
                </Text>
              ) : null}
              <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-borderc/40">
                <Text className="text-text-muted text-xs">
                  Order #{item.orderNumber || item.id.slice(0, 8)}
                </Text>
                <Text className="text-warm-tan text-xs">
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? null : <EmptyState title="No orders found" subtitle="Your escrow orders will appear here." />
        }
      />
    </Screen>
  );
}
