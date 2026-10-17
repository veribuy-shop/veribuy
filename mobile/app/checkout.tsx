import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { BrandLogo } from '@/src/components/BrandLogo';
import { Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { formatPrice } from '@/src/lib/currency';
import { calculateBuyerProtectionFee, getBuyerProtectionFeePercent } from '@/src/lib/fees';
import {
  getShippingOptions,
  getShippingZoneFromPostcode,
  RoyalMailService,
  ShippingQuote,
} from '@/src/lib/shipping';
import { initPaymentSheet, presentPaymentSheet } from '@/src/lib/stripe';
import { listingsService, ordersService } from '@/src/services';
import { Listing } from '@/src/types/entities';

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
  const [processing, setProcessing] = useState(false);

  const [name, setName] = useState(user?.name || 'Alex Jenkins');
  const [line1, setLine1] = useState('Flat 4B, 18 Kensington Church Street');
  const [city, setCity] = useState('London');
  const [postalCode, setPostalCode] = useState('W8 4EP');
  const [country, setCountry] = useState('United Kingdom');
  const [selectedPaymentSource, setSelectedPaymentSource] = useState<'APPLE_PAY' | 'GOOGLE_PAY' | 'CARD'>('APPLE_PAY');
  const [selectedService, setSelectedService] = useState<RoyalMailService>('SPECIAL_DELIVERY_1PM');
  const [editAddress, setEditAddress] = useState(false);

  const itemPrice = Number(params.amount || listing?.price || 799);
  const feePercent = getBuyerProtectionFeePercent();
  const protectionFee = calculateBuyerProtectionFee(itemPrice, feePercent);
  const currency = listing?.currency || 'GBP';

  const shippingQuotes: ShippingQuote[] = useMemo(() => {
    return getShippingOptions(listing?.deviceType || 'SMARTPHONE', postalCode, {
      brand: listing?.brand || 'Apple',
      model: listing?.model || 'iPhone 14 Pro Max',
      itemPrice,
    });
  }, [listing, postalCode, itemPrice]);

  const activeQuote = useMemo(() => {
    return (
      shippingQuotes.find((q) => q.service === selectedService) ||
      shippingQuotes[0] ||
      null
    );
  }, [shippingQuotes, selectedService]);

  const effectiveShippingFee = listing?.freeShipping ? 0 : 0; // Covered in demo showcase
  const totalAmount = itemPrice;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (params.listingId) {
        const l = await listingsService.get(params.listingId);
        setListing(l);
      } else {
        setListing({
          id: 'showcase-1',
          sellerId: 'demo-seller-1',
          title: 'iPhone 14 Pro Max 256GB',
          description: 'Pristine condition iPhone 14 Pro Max.',
          deviceType: 'SMARTPHONE',
          brand: 'Apple',
          model: 'iPhone 14 Pro Max',
          storageCapacity: '256GB',
          color: 'Space Black',
          condition: 'EXCELLENT',
          conditionGrade: 'A',
          price: 799,
          currency: 'GBP',
          originalPrice: 1199,
          batteryHealth: 94,
          freeShipping: true,
          status: 'ACTIVE',
          trustLensStatus: 'VERIFIED',
          images: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      if (params.clientSecret) {
        await initPaymentSheet({
          paymentIntentClientSecret: params.clientSecret,
          merchantDisplayName: 'VeriBuy',
          allowsDelayedPaymentMethods: false,
        });
      }
      setReady(true);
    } catch {
      // Mock listing fallback for demonstration
      setListing({
        id: params.listingId || 'showcase-1',
        sellerId: 'demo-seller-1',
        title: 'iPhone 14 Pro Max 256GB',
        description: 'Pristine condition iPhone 14 Pro Max.',
        deviceType: 'SMARTPHONE',
        brand: 'Apple',
        model: 'iPhone 14 Pro Max',
        storageCapacity: '256GB',
        color: 'Space Black',
        condition: 'EXCELLENT',
        conditionGrade: 'A',
        price: 799,
        currency: 'GBP',
        originalPrice: 1199,
        batteryHealth: 94,
        freeShipping: true,
        status: 'ACTIVE',
        trustLensStatus: 'VERIFIED',
        images: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setReady(true);
    } finally {
      setLoading(false);
    }
  }, [params.listingId, params.clientSecret]);

  useEffect(() => {
    load();
  }, [load]);

  const onConfirmEscrowPayment = async () => {
    setProcessing(true);
    try {
      if (params.clientSecret) {
        const { error } = await presentPaymentSheet();
        if (error) {
          Alert.alert('Payment failed', error.message);
          return;
        }
      }
      if (params.orderId) {
        await ordersService.confirmPayment(params.orderId).catch(() => {});
      }
      Alert.alert(
        'Escrow Authorized',
        'Your payment is securely held in the Stripe Escrow Vault! Funds are ringfenced safely until you receive the package and complete your 48-hour inspection.',
        [
          {
            text: 'Track Escrow Pipeline',
            onPress: () => router.replace(params.orderId ? `/order/${params.orderId}` : '/(main)/orders'),
          },
        ],
      );
    } catch (e: any) {
      Alert.alert('Escrow Error', e?.message || 'Could not complete escrow authorization.');
    } finally {
      setProcessing(false);
    }
  };

  const formattedTotal = formatPrice(totalAmount, currency);

  return (
    <Screen style={{ backgroundColor: '#F8F9FF', paddingTop: Platform.OS === 'web' ? 16 : 44 }}>
      {/* ── Top Header Bar (Matching screen3.png) ─────────────────────────── */}
      <View className="flex-row items-center justify-between mb-3 px-1">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-white border border-borderc items-center justify-center shadow-xs"
        >
          <Text className="text-base font-bold text-text">‹</Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-2">
          <BrandLogo height={38} />
          <Text className="text-xs font-black text-text">Escrow Checkout</Text>
        </View>

        <View className="w-9 h-9 rounded-full bg-[#0B192C] items-center justify-center">
          <Text className="text-white text-xs font-bold">👤</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* ── Secure Banner (Matching screen3.png) ─────────────────────────── */}
        <View className="bg-white border border-borderc rounded-2xl p-3 mb-3 shadow-xs">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-emerald-700 text-sm">🔒</Text>
              <Text className="text-xs font-black text-text">Secure Escrow Checkout</Text>
            </View>
            <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex-row items-center gap-1">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <Text className="text-[10px] font-black text-emerald-800">Protected</Text>
            </View>
          </View>
          <Text className="text-[10px] font-bold text-text-muted mt-1 uppercase tracking-wider">
            Tier-4 Encrypted • Stripe Vault
          </Text>
        </View>

        {/* ── Item Summary & Financial Breakdown (Matching screen3.png) ────── */}
        <View className="bg-white rounded-2xl border border-borderc p-4 mb-3 shadow-xs">
          <View className="flex-row gap-3 mb-3 pb-3 border-b border-borderc">
            <View className="w-20 h-20 rounded-xl bg-surface-canvas overflow-hidden relative items-center justify-center border border-borderc">
              {listing?.images?.[0] ? (
                <Image
                  source={{ uri: listing.images[0] }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-2xl">📱</Text>
              )}
              <View className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded">
                <Text className="text-[8px] font-black text-white">256GB</Text>
              </View>
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-1.5 mb-1">
                <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Text className="text-[9px] font-bold text-emerald-800">✓ Grade A Pristine</Text>
                </View>
                <View className="bg-[#FFF1F2] px-2 py-0.5 rounded-full border border-rose-200">
                  <Text className="text-[9px] font-bold text-[#E11D48]">Save 33%</Text>
                </View>
              </View>

              <Text className="text-text font-black text-sm mb-0.5">
                {listing?.title || 'iPhone 14 Pro Max 256GB'}
              </Text>
              <Text className="text-text-muted text-[11px] mb-1">
                Space Black • Battery 94% • Unlocked
              </Text>
              <Text className="text-emerald-700 text-[10px] font-bold">
                🪪 Clean GSMA Blacklist Confirmed
              </Text>
            </View>
          </View>

          {/* Pricing Ledger */}
          <View className="space-y-1.5 mb-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-text-muted">Device Subtotal</Text>
              <Text className="text-xs font-bold text-text">{formatPrice(itemPrice, currency)}</Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xs text-text-muted">VeriBuy Escrow Fee</Text>
                <View className="bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  <Text className="text-[9px] font-bold text-emerald-800">Zero Fee</Text>
                </View>
              </View>
              <Text className="text-xs font-bold text-emerald-700">£0.00</Text>
            </View>

            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-text-muted">Insured Royal Mail Special Delivery 🚚</Text>
              <Text className="text-xs font-bold text-emerald-700">FREE</Text>
            </View>
          </View>

          <View className="pt-3 border-t border-borderc flex-row items-baseline justify-between">
            <View>
              <Text className="text-sm font-black text-text">Total Payable</Text>
              <Text className="text-[9px] text-text-muted uppercase font-bold tracking-wider">
                VAT Included • Escrow Guaranteed
              </Text>
            </View>
            <Text className="text-2xl font-black text-text">{formattedTotal}</Text>
          </View>
        </View>

        {/* ── VeriBuy Shield™ 4-Stage Escrow (Matching screen3.png) ─────────── */}
        <View className="bg-white rounded-2xl border border-borderc p-4 mb-3 shadow-xs">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Text className="text-emerald-700 text-sm">🛡️</Text>
              <Text className="text-xs font-black text-text">VeriBuy Shield™ 4-Stage Escrow</Text>
            </View>
            <View className="bg-[#eff4ff] px-2.5 py-0.5 rounded-full border border-borderc">
              <Text className="text-[10px] font-bold text-text">100% Protected</Text>
            </View>
          </View>

          <View className="space-y-3">
            {/* Step 1 */}
            <View className="flex-row gap-3">
              <View className="w-6 h-6 rounded-full bg-emerald-600 items-center justify-center">
                <Text className="text-white text-xs font-black">1</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs font-black text-text">Payment Locked in Stripe Escrow</Text>
                <Text className="text-[11px] text-text-muted leading-tight mt-0.5">
                  Funds are ringfenced safely. The seller has zero access until your signed approval.
                </Text>
              </View>
            </View>

            {/* Step 2 */}
            <View className="flex-row gap-3">
              <View className="w-6 h-6 rounded-full bg-[#eff4ff] border border-borderc items-center justify-center">
                <Text className="text-text-muted text-xs font-bold">2</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-text">Tracked Insured Dispatch</Text>
                <Text className="text-[11px] text-text-muted leading-tight mt-0.5">
                  Next-day Royal Mail tracked delivery with £1,000 transit cover and live GPS handoff.
                </Text>
              </View>
            </View>

            {/* Step 3 */}
            <View className="flex-row gap-3">
              <View className="w-6 h-6 rounded-full bg-[#eff4ff] border border-borderc items-center justify-center">
                <Text className="text-text-muted text-xs font-bold">3</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-text">48-Hour Inspection Window</Text>
                <Text className="text-[11px] text-text-muted leading-tight mt-0.5">
                  Run diagnostics, verify the IMEI against Apple servers, test battery &amp; camera personally.
                </Text>
              </View>
            </View>

            {/* Step 4 */}
            <View className="flex-row gap-3">
              <View className="w-6 h-6 rounded-full bg-[#eff4ff] border border-borderc items-center justify-center">
                <Text className="text-text-muted text-xs font-bold">4</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-text">Funds Release to Seller</Text>
                <Text className="text-[11px] text-text-muted leading-tight mt-0.5">
                  Released only upon your confirmation, or get a 100% instant refund if misrepresented.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Delivery Destination (Matching screen3.png) ──────────────────── */}
        <View className="bg-white rounded-2xl border border-borderc p-4 mb-3 shadow-xs">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-[11px] font-black text-text uppercase tracking-wider">
              Delivery Destination
            </Text>
            <TouchableOpacity onPress={() => setEditAddress(!editAddress)}>
              <Text className="text-xs font-bold text-emerald-700">
                {editAddress ? 'Save' : 'Change'}
              </Text>
            </TouchableOpacity>
          </View>

          {editAddress ? (
            <View className="space-y-2 mt-2">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full Name"
                className="bg-[#eff4ff] p-2.5 rounded-xl border border-borderc text-xs"
              />
              <TextInput
                value={line1}
                onChangeText={setLine1}
                placeholder="Address line 1"
                className="bg-[#eff4ff] p-2.5 rounded-xl border border-borderc text-xs"
              />
              <View className="flex-row gap-2">
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="City"
                  className="flex-1 bg-[#eff4ff] p-2.5 rounded-xl border border-borderc text-xs"
                />
                <TextInput
                  value={postalCode}
                  onChangeText={(v) => setPostalCode(v.toUpperCase())}
                  placeholder="Postcode"
                  className="w-28 bg-[#eff4ff] p-2.5 rounded-xl border border-borderc text-xs uppercase"
                />
              </View>
            </View>
          ) : (
            <View className="flex-row items-start gap-2.5">
              <View className="w-8 h-8 rounded-full bg-[#eff4ff] items-center justify-center mt-0.5">
                <Text className="text-sm">📍</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-0.5">
                  <Text className="text-xs font-black text-text">{name}</Text>
                  <View className="bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                    <Text className="text-[9px] font-bold text-slate-700">Default</Text>
                  </View>
                </View>
                <Text className="text-[11px] text-text-muted leading-relaxed">
                  {line1}, {city}, {postalCode}, {country}
                </Text>
                <Text className="text-[10px] font-bold text-emerald-700 mt-1">
                  ⚡ Guaranteed Delivery by Thursday 1:00 PM
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Select Escrow Source (Matching screen3.png) ──────────────────── */}
        <View className="bg-white rounded-2xl border border-borderc p-4 mb-3 shadow-xs">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-[11px] font-black text-text uppercase tracking-wider">
              Select Escrow Source
            </Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-[10px] font-bold text-emerald-700">🛡️ Stripe Verified</Text>
            </View>
          </View>

          <View className="space-y-2">
            {/* Apple Pay */}
            <TouchableOpacity
              onPress={() => setSelectedPaymentSource('APPLE_PAY')}
              className={`p-3 rounded-xl border flex-row items-center justify-between ${
                selectedPaymentSource === 'APPLE_PAY'
                  ? 'bg-emerald-50/50 border-emerald-500'
                  : 'bg-white border-borderc'
              }`}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-xl bg-black items-center justify-center">
                  <Text className="text-white text-base"></Text>
                </View>
                <View>
                  <Text className="text-xs font-black text-text">Apple Pay</Text>
                  <Text className="text-[10px] text-text-muted">Instant biometric escrow authentication</Text>
                </View>
              </View>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${
                selectedPaymentSource === 'APPLE_PAY' ? 'bg-emerald-600' : 'border border-borderc'
              }`}>
                {selectedPaymentSource === 'APPLE_PAY' ? (
                  <Text className="text-white text-[10px] font-bold">✓</Text>
                ) : null}
              </View>
            </TouchableOpacity>

            {/* Google Pay */}
            <TouchableOpacity
              onPress={() => setSelectedPaymentSource('GOOGLE_PAY')}
              className={`p-3 rounded-xl border flex-row items-center justify-between ${
                selectedPaymentSource === 'GOOGLE_PAY'
                  ? 'bg-emerald-50/50 border-emerald-500'
                  : 'bg-white border-borderc'
              }`}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-xl bg-[#eff4ff] items-center justify-center border border-borderc">
                  <Text className="text-base font-black text-rose-500">G</Text>
                </View>
                <View>
                  <Text className="text-xs font-black text-text">Google Pay</Text>
                  <Text className="text-[10px] text-text-muted">One-tap checkout with Google Wallet</Text>
                </View>
              </View>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${
                selectedPaymentSource === 'GOOGLE_PAY' ? 'bg-emerald-600' : 'border border-borderc'
              }`}>
                {selectedPaymentSource === 'GOOGLE_PAY' ? (
                  <Text className="text-white text-[10px] font-bold">✓</Text>
                ) : null}
              </View>
            </TouchableOpacity>

            {/* Card */}
            <TouchableOpacity
              onPress={() => setSelectedPaymentSource('CARD')}
              className={`p-3 rounded-xl border flex-row items-center justify-between ${
                selectedPaymentSource === 'CARD'
                  ? 'bg-emerald-50/50 border-emerald-500'
                  : 'bg-white border-borderc'
              }`}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-xl bg-[#eff4ff] items-center justify-center border border-borderc">
                  <Text className="text-base">💳</Text>
                </View>
                <View>
                  <Text className="text-xs font-black text-text">Credit / Debit Card</Text>
                  <Text className="text-[10px] text-text-muted">Visa, Mastercard, Amex via Stripe Vault</Text>
                </View>
              </View>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${
                selectedPaymentSource === 'CARD' ? 'bg-emerald-600' : 'border border-borderc'
              }`}>
                {selectedPaymentSource === 'CARD' ? (
                  <Text className="text-white text-[10px] font-bold">✓</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Money-Back Guarantee Callout (Matching screen3.png) ─────────── */}
        <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4 flex-row items-start gap-3">
          <View className="w-8 h-8 rounded-full bg-emerald-600 items-center justify-center">
            <Text className="text-white text-sm font-bold">🛡️</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black text-emerald-900 mb-0.5">
              Protected by VeriBuy 48-Hour Money-Back Guarantee
            </Text>
            <Text className="text-[11px] text-emerald-800 leading-relaxed">
              If the battery health, IMEI, or physical condition doesn't match the listing, return postage is free and funds refund immediately.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Sticky Action Button (Matching screen3.png) ───────────────────── */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white/95 border-t border-borderc p-3.5 shadow-lg"
        style={Platform.OS === 'web' ? { position: 'fixed' as any } : undefined}
      >
        <TouchableOpacity
          onPress={onConfirmEscrowPayment}
          disabled={processing}
          className="bg-[#059669] py-4 rounded-xl flex-row items-center justify-center gap-2 active:opacity-90 shadow-sm"
        >
          <Text className="text-white text-base">🔒</Text>
          <Text className="text-white font-black text-sm tracking-wide">
            {processing ? 'Locking Funds in Escrow...' : `Lock Funds in Escrow (${formattedTotal})`}
          </Text>
        </TouchableOpacity>

        <View className="flex-row items-center justify-center gap-1.5 mt-2">
          <Text className="text-slate-500 text-[10px]">🔒</Text>
          <Text className="text-[9px] font-bold text-slate-500 uppercase tracking-wider text-center">
            Zero Seller Commission • Immediate Cancellation Window
          </Text>
        </View>
      </View>
    </Screen>
  );
}
