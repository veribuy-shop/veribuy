import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';

import { Button, Card, Input, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { ordersService } from '@/src/services';
import { Listing } from '@/src/types/entities';
import { listingsService } from '@/src/services';

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
  const [country, setCountry] = useState('');

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
    if (!name || !line1 || !city || !state || !postalCode || !country) {
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
      Alert.alert('Payment complete', 'Your order was confirmed.', [
        { text: 'OK', onPress: () => {} },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong.');
    }
  };

  const shippingComplete =
    name && line1 && city && state && postalCode && country;

  if (loading) {
    return (
      <Screen>
        <Text className="text-text-muted text-center mt-10">Preparing checkout…</Text>
      </Screen>
    );
  }

  return (
    <Screen style={{ paddingTop: 20 }}>
      <ScrollView>
        <Text className="text-2xl font-bold text-primary mb-1">Checkout</Text>
        {listing ? (
          <Text className="text-text-muted mb-4">
            {listing.title} ·{' '}
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(listing.price)}
          </Text>
        ) : null}

        <Card>
          <Text className="font-semibold text-text mb-3">Shipping address</Text>
          <Input label="Full name *" value={name} onChangeText={setName} />
          <Input label="Address line 1 *" value={line1} onChangeText={setLine1} />
          <Input label="Address line 2" value={line2} onChangeText={setLine2} />
          <View className="flex-row">
            <View className="flex-1 mr-1"><Input label="City *" value={city} onChangeText={setCity} /></View>
            <View className="flex-1 ml-1"><Input label="State *" value={state} onChangeText={setState} /></View>
          </View>
          <View className="flex-row">
            <View className="flex-1 mr-1"><Input label="Postal code *" value={postalCode} onChangeText={setPostalCode} /></View>
            <View className="flex-1 ml-1"><Input label="Country *" value={country} onChangeText={setCountry} /></View>
          </View>
        </Card>

        <Button onPress={onPay} loading={!ready} disabled={!shippingComplete}>
          Pay {listing ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(listing.price) : ''}
        </Button>
      </ScrollView>
    </Screen>
  );
}
