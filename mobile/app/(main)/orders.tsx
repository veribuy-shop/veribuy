import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View, Pressable } from 'react-native';

import { GuestGate } from '@/src/components/GuestGate';
import { Card, EmptyState, Screen, StatusPill } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { ordersService } from '@/src/services';
import { Order } from '@/src/types/entities';
import { shortDate } from '@/src/lib/format';
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
        title="Track your orders"
        subtitle="Sign in to view active purchases, Royal Mail tracking numbers, and seller postage labels."
        icon="cube-outline"
      />
    );
  }

  return (
    <Screen safeTop>
      <Text className="text-[28px] font-bold text-text mb-3">Orders</Text>
      <View className="flex-row mb-3">
        {(['BUYER', 'SELLER'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            className={`px-4 py-2 rounded-full mr-2 ${view === v ? 'bg-primary' : 'bg-surface-alt'}`}
          >
            <Text className={view === v ? 'text-white font-semibold' : 'text-text'}>{v === 'BUYER' ? 'Purchases' : 'Sales'}</Text>
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
              <Text className="text-[15px] font-semibold text-text leading-5" numberOfLines={2}>
                {item.listingTitle || item.listing?.title || `Order ${item.id.slice(0, 8)}`}
              </Text>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-lg font-bold text-text">
                  {formatPrice(item.totalAmount || item.amount, item.currency)}
                </Text>
                <StatusPill status={item.status} />
              </View>
              <View className="flex-row items-center gap-2 mt-2">
                <View className="bg-slate-100 px-2 py-0.5 rounded">
                  <Text className="text-[11px] font-bold text-slate-700">
                    {item.shippingAddress?.deliveryMethod === 'CLICK_AND_COLLECT' ? 'Click & Collect' : 'Royal Mail'}
                  </Text>
                </View>
                {item.trackingNumber ? (
                  <View className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <Text className="text-[11px] font-mono font-bold text-emerald-800">
                      {item.trackingNumber}
                    </Text>
                  </View>
                ) : view === 'SELLER' && item.status !== 'CANCELLED' && item.status !== 'REFUNDED' ? (
                  <View className="bg-amber-100 px-2 py-0.5 rounded">
                    <Text className="text-[11px] font-bold text-amber-900">
                      Post this order
                    </Text>
                  </View>
                ) : null}
              </View>
              <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-borderc/40">
                <Text className="text-text-muted text-xs">
                  Order #{item.orderNumber || item.id.slice(0, 8)}
                </Text>
                <Text className="text-warm-tan text-xs">
                  {shortDate(item.createdAt)}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? undefined : <EmptyState title="No orders found" subtitle="Your purchases and sales will appear here." />
        }
      />
    </Screen>
  );
}
