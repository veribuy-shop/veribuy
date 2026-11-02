import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  ScrollViewInstance,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, KeyboardArea } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { formatPrice } from '@/src/lib/currency';
import { calculateBuyerProtectionFee, getBuyerProtectionFeePercent } from '@/src/lib/fees';
import {
  formatShippingService,
  getShippingOptions,
  RoyalMailService,
  ShippingQuote,
} from '@/src/lib/shipping';
import { initPaymentSheet, presentPaymentSheet } from '@/src/lib/stripe';
import { evidenceService, listingsService, ordersService, usersService } from '@/src/services';
import { ApiError } from '@/src/types/api';
import { Listing, Order } from '@/src/types/entities';

interface CheckoutParams extends Record<string, string | string[]> {
  listingId: string;
  offerId: string;
}

/** A Royal Mail / PUDO location exactly as the API returned it (sent back on update). */
interface CollectionPoint {
  id: string;
  name: string;
  addressLine1: string;
  town: string;
  postcode: string;
  distanceMiles?: number;
  openingHours?: Record<string, string>;
  [key: string]: unknown;
}

type FieldKey = 'name' | 'line1' | 'city' | 'postalCode' | 'collectionPoint' | 'cardholderName';

/** Muted so example text is never mistaken for a pre-filled value. */
const PLACEHOLDER_COLOR = '#8A8A8A';
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const CARDHOLDER_NAME = /^[a-zA-Z\s\-'.]+$/;

function deviceIcon(deviceType?: string): keyof typeof Ionicons.glyphMap {
  switch (deviceType) {
    case 'LAPTOP':
      return 'laptop-outline';
    case 'TABLET':
      return 'tablet-portrait-outline';
    case 'SMARTWATCH':
      return 'watch-outline';
    case 'AIRPODS':
      return 'headset-outline';
    case 'GAMING_CONSOLE':
      return 'game-controller-outline';
    case 'DESKTOP':
      return 'desktop-outline';
    default:
      return 'phone-portrait-outline';
  }
}

function errorMessage(err: unknown, fallback: string): string {
  // Server faults say nothing useful to a buyer, so keep the friendly fallback.
  if (err instanceof ApiError && err.status >= 500) return fallback;
  if (err instanceof ApiError || err instanceof Error) return err.message || fallback;
  return fallback;
}

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<CheckoutParams>();
  const { user } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [clientSecret, setClientSecret] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  // Delivery address — filled from the buyer's saved profile, never invented.
  const [name, setName] = useState(user?.name || '');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [county, setCounty] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressPrefilled, setAddressPrefilled] = useState(false);
  const [cardholderName, setCardholderName] = useState(user?.name || '');

  const [deliveryMethod, setDeliveryMethod] = useState<'HOME' | 'CLICK_AND_COLLECT'>('HOME');
  const [selectedService, setSelectedService] = useState<RoyalMailService>('TRACKED_48');
  const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>([]);
  const [selectedCollectionPoint, setSelectedCollectionPoint] = useState<CollectionPoint | null>(null);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [pointsError, setPointsError] = useState('');
  const [donateToCharity, setDonateToCharity] = useState(false);

  const scrollRef = useRef<ScrollViewInstance>(null);
  const fieldOffsets = useRef<Partial<Record<FieldKey, number>>>({});

  // The server-priced order is authoritative (an accepted offer or a winning
  // bid differs from the listing price). Fall back to the listing for display.
  const itemPrice = Number(order?.amount ?? listing?.price ?? 0);
  const protectionFee =
    order?.protectionFee != null
      ? Number(order.protectionFee)
      : calculateBuyerProtectionFee(itemPrice, getBuyerProtectionFeePercent());
  const currency = listing?.currency || 'GBP';

  const shippingQuotes: ShippingQuote[] = useMemo(() => {
    if (!listing) return [];
    return getShippingOptions(listing.deviceType, postalCode, {
      brand: listing.brand,
      model: listing.model,
      itemPrice,
    });
  }, [listing, postalCode, itemPrice]);

  const activeQuote = shippingQuotes.find((q) => q.service === selectedService) || shippingQuotes[0] || null;
  const effectiveShippingFee = listing?.freeShipping ? 0 : activeQuote?.totalFee || 0;
  const donationAmount = donateToCharity ? 1.0 : 0;
  const localTotal = Math.round((itemPrice + protectionFee + effectiveShippingFee + donationAmount) * 100) / 100;
  // The server's figure wins if it ever differs (say, rates changed since this
  // app version shipped). Any change to the quote inputs clears it.
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  useEffect(() => setServerTotal(null), [localTotal]);
  const totalAmount = serverTotal ?? localTotal;
  const formattedTotal = formatPrice(totalAmount, currency);

  // Depend on the user's id/role, not the object: a token refresh replaces the
  // object and must not reload checkout over what the buyer has typed.
  const userId = user?.id;
  const userRole = user?.role;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      if (!userId) {
        router.replace('/(auth)/login');
        return;
      }
      if (userRole === 'ADMIN') {
        throw new Error('Administrator accounts cannot buy listings. Please sign in with a buyer account.');
      }
      if (!params.listingId) {
        throw new Error('No item was selected. Please choose a device to buy.');
      }

      const l = await listingsService.get(params.listingId);
      setListing(l);
      // Listing details don't include the photo, so fetch it for the summary (best effort).
      evidenceService
        .forListing(l.id)
        .then((items) => {
          const photo = items.find((item) => item.url)?.url;
          if (photo) setListing((current) => (current ? { ...current, imageUrl: photo } : current));
        })
        .catch(() => {});

      // Create (or resume) the pending order now so the price shown is the
      // server's price and the item is held while the buyer checks out.
      const created = await ordersService.create({
        buyerId: userId,
        sellerId: l.sellerId,
        listingId: l.id,
        amount: Number(l.price),
        currency: l.currency,
        shippingService: 'TRACKED_48',
        ...(params.offerId ? { offerId: params.offerId } : {}),
      });
      setOrder(created.order);
      setClientSecret(created.clientSecret);
      setPaymentIntentId(created.paymentIntentId);

      // Pre-fill from the saved profile (best effort).
      try {
        const profile = await usersService.getProfile(userId);
        const addr = profile.address ?? null;
        const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
        if (fullName) {
          setName((prev) => prev || fullName);
          setCardholderName((prev) => prev || fullName);
        }
        if (addr?.line1) {
          // Fill only empty fields so nothing the buyer typed is overwritten.
          setLine1((prev) => prev || addr.line1 || '');
          setLine2((prev) => prev || addr.line2 || '');
          setCity((prev) => prev || addr.city || '');
          setCounty((prev) => prev || addr.state || addr.city || '');
          setPostalCode((prev) => prev || (addr.postalCode || '').toUpperCase());
          setAddressPrefilled(true);
        }
      } catch {
        // The buyer can type the address.
      }
    } catch (err) {
      setLoadError(errorMessage(err, 'We could not start checkout for this item. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [params.listingId, params.offerId, userId, userRole]);

  useEffect(() => {
    load();
  }, [load]);

  const fetchPoints = useCallback(async (pc: string) => {
    if (!UK_POSTCODE.test(pc.trim())) {
      setPointsError('Enter a full UK postcode to find pickup points.');
      return;
    }
    setLoadingPoints(true);
    setPointsError('');
    try {
      const res = await ordersService.getCollectionPoints(pc.trim());
      const points = (res?.locations || []) as CollectionPoint[];
      setCollectionPoints(points);
      setSelectedCollectionPoint(points[0] ?? null);
      if (points.length === 0) setPointsError('No pickup points found near that postcode.');
    } catch (err) {
      setCollectionPoints([]);
      setSelectedCollectionPoint(null);
      setPointsError(errorMessage(err, 'Could not load pickup points. Please try again.'));
    } finally {
      setLoadingPoints(false);
    }
  }, []);

  useEffect(() => {
    if (deliveryMethod === 'CLICK_AND_COLLECT' && UK_POSTCODE.test(postalCode.trim())) {
      fetchPoints(postalCode);
    }
  }, [deliveryMethod, postalCode, fetchPoints]);

  const validate = (): Partial<Record<FieldKey, string>> => {
    const errors: Partial<Record<FieldKey, string>> = {};
    if (name.trim().length < 2) errors.name = 'Enter the recipient’s full name.';
    if (deliveryMethod === 'HOME') {
      if (line1.trim().length < 5) errors.line1 = 'Enter the first line of the address (at least 5 characters).';
      if (city.trim().length < 2) errors.city = 'Enter the town or city.';
      if (!UK_POSTCODE.test(postalCode.trim())) errors.postalCode = 'Enter a valid UK postcode, e.g. M1 1AE.';
    } else if (!selectedCollectionPoint) {
      errors.collectionPoint = 'Choose a pickup point.';
    }
    const card = cardholderName.trim();
    if (card.length < 2) {
      errors.cardholderName = 'Enter the name exactly as it appears on your card.';
    } else if (!CARDHOLDER_NAME.test(card)) {
      errors.cardholderName = 'Use letters, spaces, hyphens, apostrophes and full stops only.';
    }
    return errors;
  };

  const scrollToFirstError = (errors: Partial<Record<FieldKey, string>>) => {
    const order: FieldKey[] = ['name', 'line1', 'city', 'postalCode', 'collectionPoint', 'cardholderName'];
    const first = order.find((k) => errors[k]);
    const y = first ? fieldOffsets.current[first] : undefined;
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
  };

  const onPay = async () => {
    if (!order || !listing || !clientSecret || !paymentIntentId) return;
    const errors = validate();
    setFieldErrors(errors);
    const count = Object.keys(errors).length;
    if (count > 0) {
      setFormError(count === 1 ? Object.values(errors)[0]! : `Please fix ${count} highlighted fields before paying.`);
      scrollToFirstError(errors);
      return;
    }
    setFormError('');
    setProcessing(true);
    try {
      // 1. Save delivery details on the order. The server recomputes shipping
      //    and syncs the Stripe amount, so the buyer is charged what they see.
      const address =
        deliveryMethod === 'CLICK_AND_COLLECT' && selectedCollectionPoint
          ? {
              name: name.trim(),
              line1: `${selectedCollectionPoint.name}, ${selectedCollectionPoint.addressLine1}`,
              city: selectedCollectionPoint.town,
              state: selectedCollectionPoint.town,
              postal_code: selectedCollectionPoint.postcode,
              country: 'GB',
            }
          : {
              name: name.trim(),
              line1: line1.trim(),
              ...(line2.trim() ? { line2: line2.trim() } : {}),
              city: city.trim(),
              state: county.trim() || city.trim(),
              postal_code: postalCode.trim().toUpperCase(),
              country: 'GB',
            };
      const priced = await ordersService.updateShipping(order.id, {
        shippingFee: effectiveShippingFee,
        shippingService: selectedService,
        deliveryMethod,
        donationAmount,
        ...(deliveryMethod === 'CLICK_AND_COLLECT' ? { collectionPoint: selectedCollectionPoint } : {}),
        shippingAddress: address,
      });

      // Never open payment for an amount the buyer hasn't been shown.
      const chargedTotal = Number(priced?.totalAmount);
      if (Number.isFinite(chargedTotal) && Math.abs(chargedTotal - totalAmount) >= 0.01) {
        setServerTotal(chargedTotal);
        setFormError(
          `Your total is now ${formatPrice(chargedTotal, currency)} after the latest postage price. You have not been charged. Check it and tap Pay again.`,
        );
        return;
      }

      // 2. Take payment with Stripe's PaymentSheet. Nothing is shown as paid
      //    unless Stripe completes.
      const init = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'VeriBuy',
        returnURL: 'veribuy://stripe-redirect',
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: { name: cardholderName.trim(), address: { country: 'GB' } },
      });
      if (init.error) {
        // Setup errors are written for developers, so never show them to buyers.
        if (__DEV__) console.warn('initPaymentSheet failed:', init.error.message);
        throw new Error('We could not start the payment. You have not been charged. Please try again.');
      }

      const result = await presentPaymentSheet();
      if (result.error) {
        // Closing the sheet isn't an error worth an alert.
        if ((result.error as { code?: string }).code === 'Canceled') return;
        throw new Error(result.error.message);
      }

      // 3. Record the payment. If this call fails the Stripe webhook still
      //    settles the order, so tell the buyer honestly rather than erroring.
      let confirmed = true;
      try {
        await ordersService.confirmPayment(order.id, paymentIntentId);
      } catch {
        confirmed = false;
      }

      Alert.alert(
        'Payment received',
        confirmed
          ? `${formattedTotal} is held securely until you confirm the device arrived as described. We've told the seller to post it.`
          : `Your payment went through. We're finishing setting up your order — it will appear in Orders shortly.`,
        [
          {
            text: 'View order',
            onPress: () => {
              // Clear checkout from the stack so Back can't re-open a paid order.
              if (router.canDismiss()) router.dismissAll();
              router.push(`/order/${order.id}`);
            },
          },
        ],
      );
    } catch (err) {
      const message = errorMessage(err, 'Your payment did not go through. You have not been charged.');
      // Shown inline as well: alerts are easy to dismiss and don't exist on web.
      setFormError(message);
      Alert.alert('Payment not completed', message);
    } finally {
      setProcessing(false);
    }
  };

  const recordOffset = (key: FieldKey) => (e: { nativeEvent: { layout: { y: number } } }) => {
    fieldOffsets.current[key] = e.nativeEvent.layout.y;
  };

  const inputClass = (key: FieldKey) =>
    `bg-[#F5F5F0] p-3 rounded-xl border text-sm ${fieldErrors[key] ? 'border-rose-500' : 'border-borderc'}`;

  const FieldError = ({ k }: { k: FieldKey }) =>
    fieldErrors[k] ? <Text className="text-rose-600 text-[11px] font-semibold mt-1">{fieldErrors[k]}</Text> : null;

  if (loading) {
    return (
      <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2D7A4F" />
        <Text className="text-text-muted text-xs mt-3">Preparing secure checkout…</Text>
      </Screen>
    );
  }

  if (loadError || !listing || !order) {
    return (
      <Screen style={{ justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text className="text-lg font-black text-text mb-2 text-center">Checkout unavailable</Text>
        <Text className="text-sm text-text-muted text-center mb-5">
          {loadError || 'We could not start checkout for this item.'}
        </Text>
        <TouchableOpacity onPress={load} className="bg-[#2D7A4F] px-5 py-3 rounded-xl mb-3" accessibilityRole="button">
          <Text className="text-white font-bold">Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text className="text-emerald-700 font-bold">Go back</Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  const coverImage = listing.imageUrl || listing.images?.[0];
  const verified = listing.trustLensStatus === 'PASSED';

  return (
    <Screen>
      <KeyboardArea>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        {/* Item & price breakdown */}
        <View className="bg-white rounded-2xl border border-borderc p-4 mb-3">
          <View className="flex-row gap-3 mb-3 pb-3 border-b border-borderc">
            <View className="w-20 h-20 rounded-xl bg-surface-canvas overflow-hidden items-center justify-center border border-borderc">
              {coverImage ? (
                <Image source={{ uri: coverImage }} className="w-full h-full" resizeMode="cover" accessibilityIgnoresInvertColors />
              ) : (
                <Ionicons name={deviceIcon(listing.deviceType)} size={26} color="#565959" />
              )}
            </View>
            <View className="flex-1">
              {verified ? (
                <View className="self-start bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 mb-1">
                  <Text className="text-[11px] font-bold text-emerald-800">✓ Trust Lens verified</Text>
                </View>
              ) : null}
              <Text className="text-text font-black text-sm mb-0.5">{listing.title}</Text>
              <Text className="text-text-muted text-[11px]">
                {[listing.color, listing.conditionGrade ? `Grade ${listing.conditionGrade}` : null].filter(Boolean).join(' • ')}
              </Text>
            </View>
          </View>

          <View className="gap-2 mb-3">
            <Row label="Item price" value={formatPrice(itemPrice, currency)} />
            <Row label={`Buyer Protection (${getBuyerProtectionFeePercent()}%)`} value={formatPrice(protectionFee, currency)} />
            <Row
              label={formatShippingService(selectedService)}
              value={listing.freeShipping ? 'Free (seller pays)' : formatPrice(effectiveShippingFee, currency)}
            />
            {donateToCharity ? <Row label="Donation to Good Things Foundation" value={formatPrice(1, currency)} /> : null}
          </View>

          <View className="pt-3 border-t border-borderc flex-row items-baseline justify-between">
            <View>
              <Text className="text-sm font-black text-text">Total</Text>
              <Text className="text-[11px] text-text-muted">Held in escrow until you confirm delivery</Text>
            </View>
            <Text className="text-2xl font-black text-text">{formattedTotal}</Text>
          </View>
        </View>

        {/* Delivery */}
        <View className="bg-white rounded-2xl border border-borderc p-4 mb-3">
          <Text className="text-[11px] font-black text-text uppercase tracking-wider mb-3">Delivery</Text>
          <View className="flex-row gap-2 mb-4">
            {(['HOME', 'CLICK_AND_COLLECT'] as const).map((m) => {
              const selected = deliveryMethod === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setDeliveryMethod(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  className={`flex-1 p-3 rounded-xl border ${selected ? 'bg-emerald-50/60 border-emerald-500' : 'bg-white border-borderc'}`}
                >
                  <Text className="text-xs font-black text-text">{m === 'HOME' ? 'Home delivery' : 'Click & Collect'}</Text>
                  <Text className="text-[11px] text-text-muted mt-0.5">
                    {m === 'HOME' ? 'Royal Mail to your door' : 'Post Office or pickup point'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View onLayout={recordOffset('name')} className="mb-3">
            <Text className="text-xs font-bold text-text mb-1">Full name</Text>
            <TextInput
                placeholderTextColor={PLACEHOLDER_COLOR}
              value={name}
              onChangeText={setName}
              placeholder="Recipient full name"
              autoComplete="name"
              accessibilityLabel="Recipient full name"
              className={inputClass('name')}
            />
            <FieldError k="name" />
          </View>

          {deliveryMethod === 'HOME' ? (
            <>
              {addressPrefilled ? (
                <Text className="text-[11px] text-text-muted mb-2">
                  ✓ Filled in from your saved address. Change anything that’s different for this order.
                </Text>
              ) : null}
              <View onLayout={recordOffset('line1')} className="mb-3">
                <Text className="text-xs font-bold text-text mb-1">Address line 1</Text>
                <TextInput
                placeholderTextColor={PLACEHOLDER_COLOR} value={line1} onChangeText={setLine1} placeholder="1 Example Street" autoComplete="address-line1" accessibilityLabel="Address line 1" className={inputClass('line1')} />
                <FieldError k="line1" />
              </View>
              <View className="mb-3">
                <Text className="text-xs font-bold text-text mb-1">Address line 2 (optional)</Text>
                <TextInput
                placeholderTextColor={PLACEHOLDER_COLOR} value={line2} onChangeText={setLine2} placeholder="Flat 4B" autoComplete="address-line2" accessibilityLabel="Address line 2" className="bg-[#F5F5F0] p-3 rounded-xl border border-borderc text-sm" />
              </View>
              <View className="flex-row gap-2 mb-3">
                <View className="flex-1" onLayout={recordOffset('city')}>
                  <Text className="text-xs font-bold text-text mb-1">Town or city</Text>
                  <TextInput
                placeholderTextColor={PLACEHOLDER_COLOR} value={city} onChangeText={setCity} placeholder="London" accessibilityLabel="Town or city" className={inputClass('city')} />
                  <FieldError k="city" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-text mb-1">County (optional)</Text>
                  <TextInput
                placeholderTextColor={PLACEHOLDER_COLOR} value={county} onChangeText={setCounty} placeholder="Greater London" accessibilityLabel="County" className="bg-[#F5F5F0] p-3 rounded-xl border border-borderc text-sm" />
                </View>
              </View>
            </>
          ) : null}

          <View onLayout={recordOffset('postalCode')} className="mb-3">
            <Text className="text-xs font-bold text-text mb-1">Postcode</Text>
            <TextInput
                placeholderTextColor={PLACEHOLDER_COLOR}
              value={postalCode}
              onChangeText={(v) => setPostalCode(v.toUpperCase())}
              placeholder="M1 1AE"
              autoCapitalize="characters"
              autoComplete="postal-code"
              accessibilityLabel="Postcode"
              className={`${inputClass('postalCode')} font-mono`}
            />
            <FieldError k="postalCode" />
          </View>

          {deliveryMethod === 'CLICK_AND_COLLECT' ? (
            <View onLayout={recordOffset('collectionPoint')} className="gap-2">
              {loadingPoints ? <ActivityIndicator size="small" color="#2D7A4F" /> : null}
              {pointsError ? <Text className="text-[11px] text-rose-600">{pointsError}</Text> : null}
              {collectionPoints.map((pt) => {
                const selected = selectedCollectionPoint?.id === pt.id;
                return (
                  <TouchableOpacity
                    key={pt.id}
                    onPress={() => setSelectedCollectionPoint(pt)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    className={`p-3 rounded-xl border ${selected ? 'bg-emerald-50/50 border-emerald-500' : 'bg-slate-50 border-borderc'}`}
                  >
                    <Text className="text-xs font-black text-text">{pt.name}</Text>
                    <Text className="text-[11px] text-text-muted mt-0.5">
                      {pt.addressLine1}, {pt.town} {pt.postcode}
                      {pt.distanceMiles != null ? ` · ${pt.distanceMiles} mi` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <FieldError k="collectionPoint" />
            </View>
          ) : null}

          {deliveryMethod === 'HOME' && shippingQuotes.length > 0 ? (
            <View className="mt-2 pt-3 border-t border-borderc gap-2">
              <Text className="text-[11px] font-black text-text uppercase tracking-wider">Delivery speed</Text>
              {shippingQuotes.map((quote) => {
                const selected = selectedService === quote.service;
                return (
                  <TouchableOpacity
                    key={quote.service}
                    onPress={() => setSelectedService(quote.service)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    className={`p-3 rounded-xl border flex-row items-center justify-between ${selected ? 'bg-emerald-50/60 border-emerald-500' : 'bg-white border-borderc'}`}
                  >
                    <View className="flex-1 mr-2">
                      <Text className="text-xs font-black text-text">{quote.label}</Text>
                      <Text className="text-[11px] text-text-muted mt-0.5">
                        {quote.estimate} • covered up to £{quote.insuranceCover}
                      </Text>
                    </View>
                    <Text className="text-xs font-black text-text">
                      {listing.freeShipping ? 'Free' : formatPrice(quote.totalFee, currency)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Payment */}
        <View className="bg-white rounded-2xl border border-borderc p-4 mb-3" onLayout={recordOffset('cardholderName')}>
          <Text className="text-[11px] font-black text-text uppercase tracking-wider mb-1">Payment</Text>
          <Text className="text-[11px] text-text-muted mb-3">
            You’ll choose card, Klarna or Clearpay in Stripe’s secure payment sheet.
          </Text>
          <Text className="text-xs font-bold text-text mb-1">Name on card</Text>
          <TextInput
                placeholderTextColor={PLACEHOLDER_COLOR}
            value={cardholderName}
            onChangeText={(t) => setCardholderName(t)}
            placeholder="As printed on your card"
            autoComplete="name"
            accessibilityLabel="Name on card"
            className={inputClass('cardholderName')}
          />
          <FieldError k="cardholderName" />
          <Text className="text-[11px] text-text-muted mt-1.5">
            Letters, spaces, hyphens, apostrophes and full stops only. Your bank may use it for security checks.
          </Text>
        </View>

        {/* Optional donation */}
        <TouchableOpacity
          onPress={() => setDonateToCharity(!donateToCharity)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: donateToCharity }}
          className={`bg-white rounded-2xl border p-4 mb-3 flex-row items-start gap-3 ${donateToCharity ? 'border-rose-400' : 'border-borderc'}`}
        >
          <View className={`w-6 h-6 rounded-lg items-center justify-center ${donateToCharity ? 'bg-rose-500' : 'border border-slate-300'}`}>
            {donateToCharity ? <Text className="text-white text-xs font-bold">✓</Text> : null}
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black text-text">Add £1.00 for Good Things Foundation</Text>
            <Text className="text-[11px] text-text-muted">Optional donation supporting digital inclusion in the UK.</Text>
          </View>
        </TouchableOpacity>

        <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4">
          <Text className="text-xs font-black text-emerald-900 mb-0.5">How Buyer Protection works</Text>
          <Text className="text-[11px] text-emerald-800 leading-relaxed">
            Your payment is held until you confirm the device arrived as described. If it doesn’t match the listing,
            report a problem from your order before you release payment.
          </Text>
        </View>
      </ScrollView>
      </KeyboardArea>

      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-borderc p-3.5"
        style={[{ paddingBottom: 14 + insets.bottom }, Platform.OS === 'web' ? { position: 'fixed' as any } : null]}
      >
        {formError ? (
          <Text accessibilityLiveRegion="polite" className="text-rose-600 text-xs font-semibold mb-2 text-center">
            {formError}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={onPay}
          disabled={processing}
          accessibilityRole="button"
          accessibilityState={{ disabled: processing, busy: processing }}
          className="bg-[#2D7A4F] py-4 rounded-xl flex-row items-center justify-center gap-2"
        >
          {processing ? <ActivityIndicator size="small" color="#fff" /> : null}
          <Text className="text-white font-black text-sm">
            {processing ? 'Processing…' : `Pay ${formattedTotal}`}
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-xs text-text-muted">{label}</Text>
      <Text className="text-xs font-bold text-text">{value}</Text>
    </View>
  );
}
