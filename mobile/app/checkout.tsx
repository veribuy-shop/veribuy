import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';

import { Button, Card, Input, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { ordersService } from '@/src/services';
import { Listing } from '@/src/types/entities';
import { listingsService } from '@/src/services';
import { formatPrice } from '@/src/lib/currency';
import { calculateBuyerProtectionFee, getBuyerProtectionFeePercent } from '@/src/lib/fees';

interface CheckoutParams extends Record<string, string | string[]> {
  listingId: string;
  clientSecret: string;
  orderId: string;
  amount: string;
}

export default function CheckoutScreen() {
  const params = useLocalSearchParams<CheckoutParams>();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  const [name, setName] = useState(user?.name || '');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('United Kingdom');

  const itemPrice = Number(params.amount || listing?.price || 0);
  const feePercent = getBuyerProtectionFeePercent();
  const protectionFee = calculateBuyerProtectionFee(itemPrice, feePercent);
  const totalAmount = itemPrice + protectionFee;
  const currency = listing?.currency || 'GBP';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const l = await listingsService.get(params.listingId);
      setListing(l);
      await initPaymentSheet({
        paymentIntentClientSecret: params.clientSecret,
        merchantDisplayName: 'VeriBuy',
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          name,
          address: {
            line1,
            line2: line2 || undefined,
            city,
            state,
            postalCode,
            country,
          },
        },
      });
      setReady(true);
    } catch (e: any) {
      Alert.alert('Checkout error', e?.message || 'Could not initialize payment.');
    } finally {
      setLoading(false);
    }
  }, [params.listingId, params.clientSecret]);

  useEffect(() => {
    load();
  }, [load]);

  const onPay = async () => {
    if (!name || !line1 || !city || !postalCode || !country) {
      Alert.alert('Missing fields', 'Please complete your shipping address.');
      return;
    }
    try {
      const { error } = await presentPaymentSheet();
      if (error) {
        Alert.alert('Payment failed', error.message);
        return;
      }
      await ordersService.confirmPayment(params.orderId);
      Alert.alert('Payment complete', 'Your payment is safely held in escrow! The seller has been notified to dispatch your item.', [
        { text: 'View Order', onPress: () => router.replace(`/order/${params.orderId}`) },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong.');
    }
  };

  const shippingComplete = name && line1 && city && postalCode && country;

  if (loading) {
    return (
      <Screen>
        <Text className="text-text-muted text-center mt-10">Preparing secure checkout…</Text>
      </Screen>
    );
  }

  return (
    <Screen style={{ paddingTop: 20 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 36 }}>
        <Text className="text-2xl font-bold text-primary mb-1">Escrow Checkout</Text>
        {listing ? (
          <Text className="text-text-muted mb-4">
            {listing.title} ({listing.brand} {listing.model})
          </Text>
        ) : null}

        {/* Escrow Guarantee Banner */}
        <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4">
          <View className="flex-row items-center mb-1">
            <Text className="text-emerald-800 font-bold text-sm">🔒 100% Escrow Protection</Text>
          </View>
          <Text className="text-xs text-emerald-700 leading-relaxed mb-2">
            Your funds are vaulted securely by Stripe. The seller will only receive payout after you receive the item and complete your 48-hour (2 days) hands-on inspection window.
          </Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
              48-Hour Money-Back Guarantee
            </Text>
            <Text className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
              Tracked Courier
            </Text>
          </View>
        </View>

        {/* Shipping Address */}
        <Card>
          <Text className="font-semibold text-text mb-3">Delivery address</Text>
          <Input label="Recipient full name *" value={name} onChangeText={setName} />
          <Input label="Address line 1 *" value={line1} onChangeText={setLine1} />
          <Input label="Address line 2 (Optional)" value={line2} onChangeText={setLine2} />
          <View className="flex-row">
            <View className="flex-1 mr-1"><Input label="Town / City *" value={city} onChangeText={setCity} /></View>
            <View className="flex-1 ml-1"><Input label="County / State" value={state} onChangeText={setState} /></View>
          </View>
          <View className="flex-row">
            <View className="flex-1 mr-1"><Input label="Postcode *" value={postalCode} onChangeText={setPostalCode} /></View>
            <View className="flex-1 ml-1"><Input label="Country *" value={country} onChangeText={setCountry} /></View>
          </View>
        </Card>

        {/* Itemized Order Summary */}
        <Card>
          <Text className="font-semibold text-text mb-3">Order summary</Text>
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-text-muted">Item price</Text>
            <Text className="text-sm font-medium text-text">{formatPrice(itemPrice, currency)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <View>
              <Text className="text-sm text-text-muted">Buyer Protection Fee ({feePercent}%)</Text>
              <Text className="text-[10px] text-text-muted">Escrow &amp; 48hr inspection warranty</Text>
            </View>
            <Text className="text-sm font-medium text-indigo-700">{formatPrice(protectionFee, currency)}</Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-sm text-text-muted">Royal Mail Tracked Delivery</Text>
            <Text className="text-sm font-medium text-emerald-700">Included</Text>
          </View>
          <View className="flex-row justify-between pt-3 border-t border-borderc">
            <Text className="text-base font-bold text-text">Total due now</Text>
            <Text className="text-xl font-black text-primary">{formatPrice(totalAmount, currency)}</Text>
          </View>
        </Card>

        <Button onPress={onPay} loading={!ready} disabled={!shippingComplete}>
          Pay {formatPrice(totalAmount, currency)}
        </Button>
      </ScrollView>
    </Screen>
  );
}

