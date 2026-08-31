import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { Button, Card, Input, Screen, StatusPill } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { ordersService } from '@/src/services';
import { Order } from '@/src/types/entities';

const ACTIONS: Record<string, { label: string; status: string }[]> = {
  SHIPPED: [],
  DELIVERED: [{ label: 'Mark completed', status: 'COMPLETED' }],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [rating, setRating] = useState('');
  const [tracking, setTracking] = useState('');

  const load = async () => {
    try {
      const o = await ordersService.get(id);
      setOrder(o);
      setTracking(o.shippingAddress?.line2 || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const isBuyer = user?.id === order?.buyerId;
  const isSeller = user?.id === order?.sellerId;
  const isAdmin = user?.role === 'ADMIN';

  const onRate = async () => {
    const num = Number(rating);
    if (!Number.isInteger(num) || num < 1 || num > 5) {
      setError('Rating must be a whole number between 1 and 5.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await ordersService.rate(id, { rating: num });
      Alert.alert('Thank you', 'Your rating has been submitted.');
      setRating('');
    } catch (e: any) {
      setError(e?.message || 'Could not submit rating.');
    } finally {
      setBusy(false);
    }
  };

  const onUpdateStatus = async (status: string) => {
    setBusy(true);
    setError('');
    try {
      await ordersService.updateStatus(id, { status, ...(tracking ? { trackingNumber: tracking } : {}) });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not update order.');
    } finally {
      setBusy(false);
    }
  };

  const onRefund = () => {
    Alert.alert('Refund order?', 'This will process a full refund.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Refund',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setError('');
          try {
            await ordersService.refund(id);
            await load();
          } catch (e: any) {
            setError(e?.message || 'Could not refund order.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <Text className="text-text-muted text-center mt-10">Loading…</Text>
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <Text className="text-text-muted text-center mt-10">{error || 'Order not found'}</Text>
      </Screen>
    );
  }

  const price = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: order.currency || 'USD',
  }).format(order.amount);

  const actions = ACTIONS[order.status] || [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Card>
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-text">Order {order.orderNumber || order.id.slice(0, 8)}</Text>
            <StatusPill status={order.status} />
          </View>
          <Text className="text-accent-dark text-xl font-bold mt-2">{price}</Text>
          <Text className="text-text-muted text-sm mt-1">
            Placed {new Date(order.createdAt).toLocaleDateString()}
          </Text>
        </Card>

        <Card>
          <Text className="font-semibold text-text mb-1">Shipping address</Text>
          {order.shippingAddress ? (
            <>
              <Text className="text-text-muted text-sm">{order.shippingAddress.name}</Text>
              <Text className="text-text-muted text-sm">
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
              </Text>
              <Text className="text-text-muted text-sm">
                {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                {order.shippingAddress.postal_code}
              </Text>
              <Text className="text-text-muted text-sm">{order.shippingAddress.country}</Text>
            </>
          ) : (
            <Text className="text-text-muted text-sm">No shipping address on file.</Text>
          )}
        </Card>

        {isSeller && order.status === 'PROCESSING' ? (
          <Card>
            <Text className="font-semibold text-text mb-2">Ship order</Text>
            <Input label="Tracking number" value={tracking} onChangeText={setTracking} />
            <Button onPress={() => onUpdateStatus('SHIPPED')} loading={busy}>
              Mark as shipped
            </Button>
          </Card>
        ) : null}

        {actions.length > 0 && (isBuyer || isSeller) ? (
          <Card>
            <Text className="font-semibold text-text mb-2">Order status</Text>
            {actions.map((a) => (
              <Button key={a.status} onPress={() => onUpdateStatus(a.status)} loading={busy}>
                {a.label}
              </Button>
            ))}
          </Card>
        ) : null}

        {isBuyer && (order.status === 'DELIVERED' || order.status === 'COMPLETED') ? (
          <Card>
            <Text className="font-semibold text-text mb-2">Rate this order</Text>
            <Input
              label="Rating (1–5)"
              value={rating}
              onChangeText={setRating}
              keyboardType="number-pad"
            />
            <Button onPress={onRate} loading={busy}>
              Submit rating
            </Button>
          </Card>
        ) : null}

        {isAdmin ? (
          <Button variant="danger" onPress={onRefund} loading={busy} disabled={order.status === 'REFUNDED' || order.status === 'CANCELLED'}>
            Refund order
          </Button>
        ) : null}

        {error ? <Text className="text-danger text-sm mt-3">{error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}
