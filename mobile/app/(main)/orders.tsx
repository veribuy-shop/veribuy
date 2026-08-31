import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View, Pressable } from 'react-native';

import { Card, EmptyState, Screen, StatusPill } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { ordersService } from '@/src/services';
import { Order } from '@/src/types/entities';

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
      <Text className="text-2xl font-bold text-primary mb-3">Orders</Text>
      <View className="flex-row mb-3">
        {(['BUYER', 'SELLER'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            className={`px-4 py-2 rounded-full mr-2 ${view === v ? 'bg-primary' : 'bg-surface-alt'}`}
          >
            <Text className={view === v ? 'text-white' : 'text-text'}>{v}</Text>
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
                <Text className="text-text font-semibold">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD' }).format(item.amount)}
                </Text>
                <StatusPill status={item.status} />
              </View>
              <Text className="text-warm-tan text-xs mt-1">
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? null : <EmptyState title="No orders" subtitle="Orders will appear here." />
        }
      />
    </Screen>
  );
}
