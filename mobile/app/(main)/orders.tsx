import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View, Pressable } from 'react-native';

import { GuestGate } from '@/src/components/GuestGate';
import { Card, EmptyState, Screen, StatusPill } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { ordersService } from '@/src/services';
import { Order } from '@/src/types/entities';
import { formatPrice } from '@/src/lib/currency';

export default function OrdersScreen() {
  const { user, isAuthenticated } = useAuth();
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

  if (!isAuthenticated) {
    return (
      <GuestGate
        title="Track Your Orders & Escrow"
        subtitle="Sign in to view active purchases, Royal Mail tracking numbers, and seller fulfillment labels."
        icon="📦"
      />
    );
  }

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
              <View className="flex-row items-center gap-2 mt-2">
                <View className="bg-slate-100 px-2 py-0.5 rounded">
                  <Text className="text-[10px] font-bold text-slate-700">
                    {item.shippingAddress?.deliveryMethod === 'CLICK_AND_COLLECT' ? '🏪 Click & Collect' : '🚚 Royal Mail'}
                  </Text>
                </View>
                {item.trackingNumber ? (
                  <View className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <Text className="text-[10px] font-mono font-bold text-emerald-800">
                      {item.trackingNumber}
                    </Text>
                  </View>
                ) : view === 'SELLER' && item.status !== 'CANCELLED' && item.status !== 'REFUNDED' ? (
                  <View className="bg-amber-100 px-2 py-0.5 rounded">
                    <Text className="text-[10px] font-bold text-amber-900">
                      Print 4x6&quot; Label / QR
                    </Text>
                  </View>
                ) : null}
              </View>
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
