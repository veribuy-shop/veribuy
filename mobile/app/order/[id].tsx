import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Button, Card, Input, Screen, StatusPill } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { formatPrice } from '@/src/lib/currency';
import { calculateBuyerProtectionFee } from '@/src/lib/fees';
import { ordersService } from '@/src/services';
import { Order } from '@/src/types/entities';

interface TimelineStep {
  title: string;
  description: string;
  status: 'completed' | 'current' | 'upcoming';
  timestamp?: string;
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [rating, setRating] = useState(5);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('Royal Mail');

  const load = async () => {
    try {
      const o = await ordersService.get(id);
      setOrder(o);
      if (o.trackingNumber) {
        setTrackingNumber(o.trackingNumber);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load order.');
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

  const onDispatch = async () => {
    if (!trackingNumber.trim()) {
      Alert.alert('Tracking Required', 'Please enter a courier tracking number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await ordersService.updateStatus(id, {
        status: 'SHIPPED',
        trackingNumber: trackingNumber.trim(),
      });
      Alert.alert('Order Dispatched', 'Tracking details updated and buyer notified via email.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not update dispatch status.');
    } finally {
      setBusy(false);
    }
  };

  const onUpdateStatus = async (status: string, confirmationMessage?: string) => {
    const proceed = async () => {
      setBusy(true);
      setError('');
      try {
        await ordersService.updateStatus(id, { status });
        await load();
      } catch (e: any) {
        setError(e?.message || 'Could not update order.');
      } finally {
        setBusy(false);
      }
    };

    if (confirmationMessage) {
      Alert.alert('Confirm Action', confirmationMessage, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: proceed },
      ]);
    } else {
      await proceed();
    }
  };

  const onRate = async () => {
    setBusy(true);
    setError('');
    try {
      await ordersService.rate(id, { rating });
      Alert.alert('Thank you', 'Your feedback rating has been submitted.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not submit rating.');
    } finally {
      setBusy(false);
    }
  };

  const onRefund = () => {
    Alert.alert('Refund Order', 'Are you sure you want to refund this order in full?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Issue Refund',
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
        <ActivityIndicator size="large" color="#232F3E" style={{ marginTop: 60 }} />
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

  const protectionFee = order.protectionFee ?? calculateBuyerProtectionFee(order.amount);
  const shippingFee = order.shippingFee ?? 0;
  const totalDue = order.totalAmount ?? order.amount + protectionFee + shippingFee;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getTimeline = (): TimelineStep[] => {
    const steps: TimelineStep[] = [];

    // Step 1: Placed / Escrow
    if (order.status === 'PENDING') {
      steps.push({
        title: 'Checkout Awaiting Payment',
        description: 'Order initiated — awaiting payment clearance from buyer.',
        status: 'current',
        timestamp: order.createdAt,
      });
      steps.push({
        title: 'Payment Secured in Escrow',
        description: 'Funds safely vaulted in VeriBuy Escrow protection once paid.',
        status: 'upcoming',
      });
    } else {
      steps.push({
        title: 'Order Placed & Escrow Secured',
        description: 'Payment verified and held safely in VeriBuy Escrow protection.',
        status: 'completed',
        timestamp: order.createdAt,
      });
    }

    // Step 2: Device Prep
    if (order.status === 'ESCROW_HELD' || order.status === 'PAYMENT_RECEIVED') {
      steps.push({
        title: 'Seller Preparing Device',
        description: 'Seller is packaging the verified device for tracked dispatch.',
        status: 'current',
      });
    } else if (order.status === 'SHIPPED' || order.status === 'DELIVERED' || order.status === 'COMPLETED') {
      steps.push({
        title: 'Device Packaged & Dispatched',
        description: 'Device handed over to tracked courier service.',
        status: 'completed',
        timestamp: order.dispatchedAt ?? undefined,
      });
    } else {
      steps.push({
        title: 'Device Preparation',
        description: 'Waiting for seller to package item.',
        status: 'upcoming',
      });
    }

    // Step 3: In Transit
    if (order.status === 'SHIPPED') {
      steps.push({
        title: 'In Transit with Courier',
        description: 'Package en route to delivery address with tracking.',
        status: 'current',
        timestamp: order.dispatchedAt ?? undefined,
      });
    } else if (order.status === 'DELIVERED' || order.status === 'COMPLETED') {
      steps.push({
        title: 'In Transit with Courier',
        description: 'Courier delivery completed to destination.',
        status: 'completed',
        timestamp: order.dispatchedAt ?? undefined,
      });
    } else {
      steps.push({
        title: 'Courier Dispatch',
        description: 'Waiting for courier tracking scan.',
        status: 'upcoming',
      });
    }

    // Step 4: Delivered (48h Inspection)
    if (order.status === 'DELIVERED') {
      steps.push({
        title: 'Delivered — 48-Hour Inspection Active',
        description: 'Verify device condition matches Trust Lens™ certificate.',
        status: 'current',
        timestamp: order.deliveredAt ?? undefined,
      });
    } else if (order.status === 'COMPLETED') {
      steps.push({
        title: 'Delivered & Inspected',
        description: 'Buyer inspected device condition successfully.',
        status: 'completed',
        timestamp: order.deliveredAt ?? undefined,
      });
    } else {
      steps.push({
        title: 'Delivery & 48-Hour Inspection',
        description: 'Awaiting courier delivery drop-off.',
        status: 'upcoming',
      });
    }

    // Step 5: Completed / Escrow Released
    if (order.status === 'COMPLETED') {
      steps.push({
        title: 'Order Complete & Payout Released',
        description: 'Buyer satisfied; escrow dispatches funds to seller.',
        status: 'completed',
        timestamp: order.completedAt ?? undefined,
      });
    } else {
      steps.push({
        title: 'Escrow Release',
        description: 'Payout released upon inspection confirmation.',
        status: 'upcoming',
      });
    }

    return steps;
  };

  const timeline = getTimeline();
  const listingImage = order.listing?.images?.[0] || order.listing?.imageUrl;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header Summary */}
        <Card>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Order #{order.orderNumber || order.id.slice(0, 8)}
              </Text>
              <Text className="text-xl font-bold text-text mt-0.5">
                {order.listing?.title || `Order ${order.id.slice(0, 8)}`}
              </Text>
            </View>
            <StatusPill status={order.status} />
          </View>

          <View className="mt-4 pt-3 border-t border-border flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Text className="text-sm font-semibold text-primary">🛡️ Escrow Protection Active</Text>
            </View>
            <Text className="text-xs text-text-muted">
              Placed {formatDate(order.createdAt)}
            </Text>
          </View>
        </Card>

        {/* Listing & Financial Breakdown */}
        <Card>
          <Text className="font-semibold text-text text-base mb-3">Order Summary</Text>
          {order.listing ? (
            <View className="flex-row items-center mb-4 pb-3 border-b border-border">
              {listingImage ? (
                <Image
                  source={{ uri: listingImage }}
                  className="w-14 h-14 rounded-lg mr-3 bg-warm-beige"
                  resizeMode="cover"
                />
              ) : null}
              <View className="flex-1">
                <Text className="font-bold text-text text-sm">{order.listing.title}</Text>
                <Text className="text-xs text-text-muted mt-0.5">
                  {order.listing.brand} · {order.listing.model} {order.listing.condition ? `· ${order.listing.condition}` : ''}
                </Text>
              </View>
            </View>
          ) : null}

          <View className="space-y-1.5">
            <View className="flex-row justify-between py-1">
              <Text className="text-sm text-text-muted">Item Price</Text>
              <Text className="text-sm font-medium text-text">
                {formatPrice(order.amount, order.currency)}
              </Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-sm text-text-muted">Buyer Protection Fee</Text>
              <Text className="text-sm font-medium text-text">
                {formatPrice(protectionFee, order.currency)}
              </Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-sm text-text-muted">Tracked Shipping</Text>
              <Text className="text-sm font-medium text-text">
                {shippingFee === 0 ? 'Free' : formatPrice(shippingFee, order.currency)}
              </Text>
            </View>
            <View className="flex-row justify-between pt-2 border-t border-border mt-1">
              <Text className="text-base font-bold text-text">Total Paid</Text>
              <Text className="text-base font-bold text-primary">
                {formatPrice(totalDue, order.currency)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Tracking Number Card */}
        {(order.trackingNumber || trackingNumber) ? (
          <Card>
            <Text className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
              Courier Tracking Details
            </Text>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-semibold text-text">
                  {order.carrier || carrier}
                </Text>
                <Text className="text-sm font-mono font-bold text-primary mt-0.5">
                  {order.trackingNumber || trackingNumber}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Tracking Copied', order.trackingNumber || trackingNumber);
                }}
                className="px-3 py-1.5 rounded-lg bg-warm-beige"
              >
                <Text className="text-xs font-semibold text-accent">Copy ID</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        {/* Escrow Milestone Timeline */}
        <Card>
          <Text className="font-semibold text-text text-base mb-4">
            Escrow & Fulfillment Timeline
          </Text>
          <View className="space-y-4">
            {timeline.map((step, idx) => {
              const isDone = step.status === 'completed';
              const isCur = step.status === 'current';

              return (
                <View key={idx} className="flex-row items-start mb-3">
                  <View className="items-center mr-3">
                    <View
                      className={`w-7 h-7 rounded-full items-center justify-center ${
                        isDone
                          ? 'bg-primary'
                          : isCur
                          ? 'bg-accent border-2 border-primary'
                          : 'bg-warm-beige border border-border'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isDone || isCur ? 'text-white' : 'text-text-muted'
                        }`}
                      >
                        {isDone ? '✓' : idx + 1}
                      </Text>
                    </View>
                    {idx < timeline.length - 1 ? (
                      <View
                        className={`w-0.5 h-8 mt-1 ${
                          isDone ? 'bg-primary' : 'bg-border'
                        }`}
                      />
                    ) : null}
                  </View>

                  <View className="flex-1 pt-0.5">
                    <Text
                      className={`text-sm font-bold ${
                        isDone
                          ? 'text-text'
                          : isCur
                          ? 'text-primary'
                          : 'text-text-muted'
                      }`}
                    >
                      {step.title}
                    </Text>
                    <Text className="text-xs text-text-muted mt-0.5 leading-relaxed">
                      {step.description}
                    </Text>
                    {step.timestamp ? (
                      <Text className="text-xs text-text-muted font-mono mt-1">
                        {formatDate(step.timestamp)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Seller Dispatch Action */}
        {isSeller && (order.status === 'ESCROW_HELD' || order.status === 'PAYMENT_RECEIVED' || order.status === 'PROCESSING') ? (
          <Card>
            <Text className="font-bold text-text text-base mb-1">Dispatch Device</Text>
            <Text className="text-xs text-text-muted mb-3">
              Enter courier tracking ID. The buyer will be notified with live tracking updates.
            </Text>
            <Input
              label="Courier"
              value={carrier}
              onChangeText={setCarrier}
              placeholder="e.g. Royal Mail Tracked 24"
            />
            <Input
              label="Tracking Number"
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              placeholder="e.g. GB123456789RM"
            />
            <Button onPress={onDispatch} loading={busy}>
              Mark as Dispatched
            </Button>
          </Card>
        ) : null}

        {/* Buyer Delivery Confirmation Action */}
        {isBuyer && order.status === 'SHIPPED' ? (
          <Card>
            <Text className="font-bold text-text text-base mb-1">Has your parcel arrived?</Text>
            <Text className="text-xs text-text-muted mb-4 leading-relaxed">
              Confirm once you have received the package. Your <Text className="font-bold text-text">48-Hour (2 Days)</Text> inspection window will begin.
            </Text>
            <Button
              onPress={() =>
                onUpdateStatus('DELIVERED', 'Are you sure you have received this parcel from the courier?')
              }
              loading={busy}
            >
              Confirm Delivery Received
            </Button>
          </Card>
        ) : null}

        {/* Buyer 48-Hour Inspection & Release Action */}
        {isBuyer && order.status === 'DELIVERED' ? (
          <Card>
            <Text className="font-bold text-text text-base mb-1">48-Hour Inspection Active</Text>
            <Text className="text-xs text-text-muted mb-4 leading-relaxed">
              Inspect device hardware, screen, and battery against the Trust Lens™ report. Confirming satisfaction immediately releases escrow funds to the seller.
            </Text>
            <Button
              onPress={() =>
                onUpdateStatus(
                  'COMPLETED',
                  'Confirm that the device is in expected condition? This will release payment from escrow to the seller.',
                )
              }
              loading={busy}
            >
              Confirm Receipt & Release Escrow
            </Button>

            <TouchableOpacity
              onPress={() =>
                onUpdateStatus(
                  'DISPUTED',
                  'Are you sure you want to report an issue? Escrow will be frozen and our Trust & Safety team will assist.',
                )
              }
              className="mt-3 py-3 items-center rounded-xl bg-warm-beige border border-border"
            >
              <Text className="text-danger font-semibold text-sm">Report Issue / Dispute</Text>
            </TouchableOpacity>
          </Card>
        ) : null}

        {/* Dispute Notice */}
        {order.status === 'DISPUTED' ? (
          <Card>
            <Text className="font-bold text-danger text-base mb-1">⚠️ Dispute Under Review</Text>
            <Text className="text-xs text-text-muted leading-relaxed">
              This transaction is currently being reviewed by VeriBuy Trust & Safety. Escrow funds remain safely frozen until resolution.
            </Text>
          </Card>
        ) : null}

        {/* Buyer Rating Action */}
        {isBuyer && order.status === 'COMPLETED' ? (
          <Card>
            <Text className="font-bold text-text text-base mb-1">Rate Your Experience</Text>
            <Text className="text-xs text-text-muted mb-3">
              How satisfied were you with this verified electronics transaction?
            </Text>
            <View className="flex-row items-center justify-around py-2 mb-3 bg-warm-beige rounded-xl">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} className="p-2">
                  <Text className={`text-2xl ${star <= rating ? 'text-accent' : 'text-border'}`}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button onPress={onRate} loading={busy}>
              Submit {rating}-Star Rating
            </Button>
          </Card>
        ) : null}

        {/* Shipping Address */}
        <Card>
          <Text className="font-semibold text-text mb-2">Delivery Address</Text>
          {order.shippingAddress ? (
            <>
              <Text className="text-text font-medium text-sm">{order.shippingAddress.name}</Text>
              <Text className="text-text-muted text-sm mt-0.5">
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
            <Text className="text-text-muted text-sm">No delivery address recorded.</Text>
          )}
        </Card>

        {/* Admin Refund */}
        {isAdmin ? (
          <Button
            variant="danger"
            onPress={onRefund}
            loading={busy}
            disabled={order.status === 'REFUNDED' || order.status === 'CANCELLED'}
          >
            Issue Admin Refund
          </Button>
        ) : null}

        {error ? <Text className="text-danger text-sm mt-3 text-center">{error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}
