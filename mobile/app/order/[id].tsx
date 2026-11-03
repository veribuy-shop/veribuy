import { checkoutMinutesLeft } from '@veribuy/common/checkout';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Share,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';

import { GuestGate } from '@/src/components/GuestGate';
import { Button, Input, Screen, KeyboardArea } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { ApiError } from '@/src/types/api';
import { formatPrice } from '@/src/lib/currency';
import { formatShippingService, resolveDeviceWeightProfile } from '@/src/lib/shipping';
import { offersService, ordersService } from '@/src/services';
import { Order } from '@/src/types/entities';

interface DropoffLocation {
  id: string;
  name: string;
  type: string;
  addressLine1: string;
  town: string;
  postcode: string;
  distanceMiles: number;
  openingHours: Record<string, string>;
  features: string[];
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [downloadingLabel, setDownloadingLabel] = useState(false);
  const [showProblemForm, setShowProblemForm] = useState(false);
  const [problemReason, setProblemReason] = useState('');
  const [problemError, setProblemError] = useState('');
  const [rating, setRating] = useState<{ rating: number; comment?: string | null } | null>(null);
  const [stars, setStars] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingError, setRatingError] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Seller role view & fulfillment
  const [showQrModal, setShowQrModal] = useState(false);
  const [trackingInput, setTrackingInput] = useState('');
  const [dropoffLocations, setDropoffLocations] = useState<DropoffLocation[]>([]);
  const [dropoffPostcode, setDropoffPostcode] = useState('');
  const [searchingDropoff, setSearchingDropoff] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const o = await ordersService.get(id);
      setOrder(o);
      if (o?.trackingNumber) {
        setTrackingInput(o.trackingNumber);
      }
      if (o?.status === 'COMPLETED') {
        // Best effort: the order is still worth showing if this fails.
        ordersService.rating(id).then(setRating).catch(() => {});
      }
    } catch (e: any) {
      // Never show a sample order in place of the real one.
      setOrder(null);
      setError(e?.status === 404 ? 'We could not find this order.' : e?.message || 'We could not load this order. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  const onConfirmDelivery = async () => {
    setBusy(true);
    try {
      await ordersService.updateStatus(id, { status: 'DELIVERED' });
      Alert.alert('Delivery confirmed', 'Check the device, then release the payment or report a problem.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not confirm delivery.');
    } finally {
      setBusy(false);
    }
  };

  const onReleaseEscrow = async () => {
    Alert.alert(
      'Release payment?',
      'Are you satisfied with the device? This will release the payment to the seller.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Release',
          onPress: async () => {
            setBusy(true);
            try {
              await ordersService.updateStatus(id, { status: 'COMPLETED' });
              Alert.alert('Payment released', 'The seller has been paid. Thanks for using VeriBuy.');
              await load();
            } catch (e: any) {
              setError(e?.message || 'We could not release the payment. Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const onReportProblem = async () => {
    if (problemReason.trim().length < 10) {
      setProblemError('Please describe the problem in at least 10 characters.');
      return;
    }
    setBusy(true);
    setProblemError('');
    try {
      await ordersService.updateStatus(id, { status: 'DISPUTED', reason: problemReason.trim() });
      setShowProblemForm(false);
      Alert.alert('Problem reported', 'Your payment stays frozen while our team reviews this.');
      await load();
    } catch (e: any) {
      setProblemError(e?.message || 'We could not send your report. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onRate = async () => {
    if (!stars) {
      setRatingError('Choose from 1 to 5 stars.');
      return;
    }
    setBusy(true);
    setRatingError('');
    try {
      const comment = ratingComment.trim();
      await ordersService.rate(id, { rating: stars, ...(comment ? { comment } : {}) });
      setRating({ rating: stars, comment });
    } catch (e: any) {
      setRatingError(e?.message || 'Your rating was not sent. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onContinueCheckout = async () => {
    if (!order?.listingId) return;
    setBusy(true);
    try {
      // An order doesn't record its offer, and without it checkout would charge the full price.
      const offers = await offersService.mine('buyer').catch(() => []);
      const offer = offers.find((item) => item.listingId === order.listingId && item.status === 'ACCEPTED');
      router.replace({
        pathname: '/checkout',
        params: { listingId: order.listingId, ...(offer ? { offerId: offer.id } : {}) },
      });
    } finally {
      setBusy(false);
    }
  };

  const onCancelCheckout = () => {
    Alert.alert('Cancel this checkout?', 'The item goes back on sale for other buyers. You haven’t been charged.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel checkout',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setError('');
          try {
            await ordersService.cancelCheckout(id);
            router.replace('/(main)/orders');
          } catch (e: any) {
            setError(e?.message || 'We could not cancel this checkout. Please try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const onDownloadLabel = async () => {
    setDownloadingLabel(true);
    try {
      const label = await ordersService.downloadShippingLabel(id);
      // expo-sharing rejects this valid cache file on iOS 27 ("You don't have
      // access"), so iOS uses the system share sheet directly.
      if (Platform.OS === 'ios') {
        await Share.share({ url: label.uri, title: 'Royal Mail label' });
      } else {
        await Sharing.shareAsync(label.uri, { mimeType: 'application/pdf', dialogTitle: 'Royal Mail label' });
      }
    } catch (e: any) {
      const needsAddress = /address/i.test(e?.message ?? '');
      Alert.alert(
        needsAddress ? 'Add your address first' : 'Label not ready',
        needsAddress
          ? 'Your label needs a return address. Add yours to your profile, then try again.'
          : e instanceof ApiError
            ? e.message
            : 'We could not open your shipping label. Please try again.',
        needsAddress
          ? [{ text: 'Not now', style: 'cancel' }, { text: 'Add address', onPress: () => router.push('/profile-edit') }]
          : undefined,
      );
    } finally {
      setDownloadingLabel(false);
    }
  };

  const onMarkAsDispatched = async () => {
    if (!trackingInput.trim()) {
      Alert.alert('Tracking number needed', 'Please enter a Royal Mail tracking number (or use generated drop-off tracking).');
      return;
    }
    setBusy(true);
    try {
      await ordersService.updateStatus(id, {
        status: 'SHIPPED',
        trackingNumber: trackingInput.trim(),
      });
      Alert.alert('Marked as posted', 'We’ve told the buyer and shared the tracking number.');
      await load();
    } catch (e: any) {
      Alert.alert('Not updated', e?.message || 'We could not update this order. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const searchDropoff = async () => {
    const pc = dropoffPostcode.trim() || order?.shippingAddress?.postal_code || '';
    if (!pc) {
      Alert.alert('Postcode needed', 'Enter a postcode to find drop-off points near you.');
      return;
    }
    setSearchingDropoff(true);
    try {
      const res = await ordersService.getDropoffLocations(id, pc);
      setDropoffLocations(res?.locations ?? []);
      if (!res?.locations?.length) {
        Alert.alert('No drop-off points found', 'Try a different postcode.');
      }
    } catch (e: any) {
      setDropoffLocations([]);
      Alert.alert('Drop-off points unavailable', e?.message || 'Please try again in a moment.');
    } finally {
      setSearchingDropoff(false);
    }
  };

  if (!isAuthenticated) {
    return <GuestGate title="Sign in to see this order" subtitle="Your orders and their progress are kept in your account." />;
  }

  if (loading) {
    return (
      <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2D7A4F" />
        <Text className="text-text-muted text-xs mt-3">Loading Order Details...</Text>
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen style={{ justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text className="text-base font-black text-text mb-2 text-center">{error || 'Order not found'}</Text>
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            load();
          }}
          accessibilityRole="button"
          className="bg-[#2D7A4F] px-5 py-3 rounded-xl mb-3"
        >
          <Text className="text-white font-bold">Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(main)/orders')} accessibilityRole="button">
          <Text className="text-emerald-700 font-bold">Back to orders</Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  const orderRef = `#VB-${order.id.slice(-5).toUpperCase()}`;
  // What the buyer paid and escrow holds: item, Buyer Protection and shipping.
  // Each person sees only their side of the order; the server enforces this too.
  const isSellerView = user?.id === order.sellerId;

  // Nothing is held on these, so none of the payment protection wording below applies.
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED' || (order.status === 'PENDING' && isSellerView)) {
    const refunded = order.status === 'REFUNDED';
    const amount = formatPrice(order.totalAmount || order.amount, order.currency);
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <View className="items-center mb-5">
          <View className="w-16 h-16 rounded-2xl bg-surface-container items-center justify-center mb-4">
            <Ionicons name={refunded ? 'return-down-back-outline' : 'close-circle-outline'} size={30} color="#565959" />
          </View>
          <Text className="text-2xl font-bold text-text text-center">
            {refunded ? 'Order refunded' : order.status === 'PENDING' ? 'Waiting for payment' : 'Checkout cancelled'}
          </Text>
          <Text className="text-sm text-text-muted text-center mt-2 leading-5">
            {refunded
              ? isSellerView
                ? `${amount} was returned to the buyer.`
                : `${amount} was returned to your original payment method.`
              : order.status === 'PENDING'
                ? 'The buyer hasn’t paid yet, so there’s nothing to post.'
                : isSellerView
                  ? 'This order wasn’t paid, so there’s nothing to post.'
                  : `This order wasn’t paid, so you weren’t charged, and ${order.listingTitle || 'the item'} is no longer held for you.`}
          </Text>
        </View>
        <Button onPress={() => router.replace('/(main)/orders')}>Back to orders</Button>
      </Screen>
    );
  }

  if (order.status === 'PENDING' && !isSellerView) {
    const minutesLeft = checkoutMinutesLeft(order.createdAt);
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <View className="items-center mb-5">
          <View className="w-16 h-16 rounded-2xl bg-amber-100 items-center justify-center mb-4">
            <Ionicons name="time-outline" size={30} color="#92400E" />
          </View>
          <Text className="text-2xl font-bold text-text text-center">Payment not completed</Text>
          <Text className="text-sm text-text-muted text-center mt-2 leading-5">
            You haven’t been charged.{' '}
            {minutesLeft > 0
              ? `We’re holding ${order.listingTitle || 'this item'} for you for ${minutesLeft} more ${minutesLeft === 1 ? 'minute' : 'minutes'}.`
              : 'Your hold on this item has ended.'}
          </Text>
        </View>
        {error ? <Text className="text-sm text-danger text-center mb-3">{error}</Text> : null}
        {minutesLeft > 0 ? (
          <>
            <Button variant="green" onPress={onContinueCheckout} loading={busy}>
              Continue checkout
            </Button>
            <Pressable onPress={onCancelCheckout} disabled={busy} accessibilityRole="button" className="min-h-11 items-center justify-center mt-2">
              <Text className="text-sm font-medium text-text-muted">Cancel and release this item</Text>
            </Pressable>
          </>
        ) : (
          <Button onPress={() => router.replace('/(main)')}>Back to Explore</Button>
        )}
      </Screen>
    );
  }
  const isBuyerView = user?.id === order.buyerId;
  const amountFormatted = formatPrice(order.totalAmount ?? order.amount, order.currency || 'GBP');
  const isDispatched =
    order.status === 'SHIPPED' || order.status === 'DELIVERED' || order.status === 'COMPLETED';
  const isDelivered = order.status === 'DELIVERED' || order.status === 'COMPLETED';
  const isCompleted = order.status === 'COMPLETED';
  const isDisputed = order.status === 'DISPUTED';
  const canReportProblem =
    isBuyerView && ['ESCROW_HELD', 'SHIPPED', 'DELIVERED'].includes(order.status);
  const weightGrams = order.parcelWeightGrams ?? null;
  const isSpecialDelivery = order.shippingService === 'SPECIAL_DELIVERY_1PM';

  return (
    <Screen>
      <KeyboardArea>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Central Hero Icon & Escrow Status ──────────────────────────── */}
        <View className="items-center my-3">
          <View className="w-16 h-16 rounded-2xl bg-emerald-600 items-center justify-center shadow-md mb-3">
            <Ionicons name="shield-checkmark" size={30} color="#FFFFFF" />
          </View>

          <View className="bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full mb-2">
            <Text className="text-emerald-800 text-[11px] font-black">
              {isCompleted ? 'Paid' : isDisputed ? 'Payment frozen' : 'Payment protected'}
            </Text>
          </View>

          <Text className="text-text font-black text-2xl mb-1">
            {isDisputed
              ? 'Problem reported'
              : isCompleted
                ? 'Order complete'
                : isSellerView
                  ? isDispatched
                    ? 'Posted to the buyer'
                    : 'Dispatch this order'
                  : 'Payment held securely'}
          </Text>
          <Text className="text-text-muted text-xs text-center px-6 leading-relaxed mb-4">
            {isDisputed
              ? 'The payment stays frozen while our team reviews this. We’ll message you with the outcome.'
              : isCompleted
                ? isSellerView
                  ? 'The buyer confirmed the device and your payment has been released.'
                  : 'You confirmed the device and the seller has been paid.'
                : isSellerView
              ? isDispatched
                ? 'You’re paid once the buyer confirms the device arrived as described.'
                : 'The buyer’s payment is held securely. Download your label below, or use a Post Office QR code if you have one.'
              : 'The seller is only paid after you check the device and confirm it matches the listing.'}
          </Text>

          {/* Reference & Amount Split Card */}
          <View className="bg-white rounded-2xl border border-borderc p-3.5 w-full flex-row items-center justify-between shadow-xs">
            <View>
              <Text className="text-[11px] font-bold text-text-muted">Order reference</Text>
              <Text className="text-sm font-black text-text mt-0.5">{orderRef}</Text>
            </View>
            <View className="items-end">
              <Text className="text-[11px] font-bold text-text-muted">
                {isSellerView ? 'Your sale price' : isCompleted ? 'Amount paid' : 'Amount held'}
              </Text>
              <Text className="text-base font-black text-emerald-700 mt-0.5">{isSellerView ? formatPrice(order.amount, order.currency || 'GBP') : amountFormatted}</Text>
            </View>
          </View>
        </View>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* ── SELLER FULFILLMENT SECTION (If SELLER Tab) ─────────────────── */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {isSellerView && !isDispatched && (
          <View className="gap-3.5 mb-3.5">
            {/* Royal Mail Shipping Specifications */}
            <View className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <View className="flex-row items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="mail-outline" size={18} color="#565959" />
                  <Text className="text-xs font-black text-slate-900">
                    Royal Mail postage
                  </Text>
                </View>
                <View className="bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  <Text className="text-[11px] font-bold text-[#D81E05]">
                    {formatShippingService(order.shippingService)}
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 mb-3">
                <View className="flex-1">
                  <Text className="text-[11px] text-slate-400">Packed weight</Text>
                  <Text className="text-xs font-bold text-slate-800">{weightGrams != null ? `${weightGrams}g` : 'Calculated at dispatch'}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] text-slate-400">Parcel size</Text>
                  <Text className="text-xs font-bold text-slate-800">
                    {order.parcelFormat === 'MEDIUM_PARCEL' ? 'Medium parcel' : 'Small parcel'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] text-slate-400">Delivery cover</Text>
                  <Text className="text-xs font-bold text-slate-800">
                    {isSpecialDelivery ? 'Up to £750' : 'Up to £150'}
                  </Text>
                </View>
              </View>

              {/* 2 Drop-off Pathways */}
              <Text className="text-[11px] font-bold text-slate-800 mb-2">
                How to send it
              </Text>

              {/* Pathway 1: Post Office Digital QR Code */}
              <TouchableOpacity
                onPress={() => setShowQrModal(true)}
                className="bg-emerald-50 border border-emerald-400 p-3.5 rounded-xl mb-2.5 active:opacity-90"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="phone-portrait-outline" size={18} color="#565959" />
                    <Text className="text-xs font-black text-emerald-900">
                      Post Office QR drop-off
                    </Text>
                  </View>
                  <View className="bg-emerald-600 px-2 py-0.5 rounded-full">
                    <Text className="text-[11px] font-bold text-white">No printer needed</Text>
                  </View>
                </View>
                <Text className="text-[11px] text-emerald-800 leading-snug">
                  Show your digital QR code at any Post Office counter. They scan it and print the shipping label for you free of charge.
                </Text>
              </TouchableOpacity>

              {/* Pathway 2: Download 4x6" PDF Shipping Label */}
              <TouchableOpacity
                onPress={onDownloadLabel}
                disabled={downloadingLabel}
                className="bg-primary p-3.5 rounded-xl flex-row items-center justify-between active:opacity-90"
              >
                <View className="flex-1 flex-row items-center gap-2.5 mr-2">
                  <Ionicons name="print-outline" size={20} color="#FFFFFF" />
                  <View className="flex-1">
                    <Text className="text-xs font-black text-white">
                      Download 4x6&quot; label
                    </Text>
                    <Text className="text-[11px] text-slate-300">
                      PDF to print at home, ready to stick on
                    </Text>
                  </View>
                </View>
                {downloadingLabel ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>

            {/* Nearby Royal Mail Drop-off Point Finder */}
            <View className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <View className="flex-row items-center justify-between mb-2.5">
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="location-outline" size={16} color="#565959" />
                  <Text className="text-xs font-black text-slate-900">
                    Find a drop-off point
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={searchDropoff}
                  disabled={searchingDropoff}
                  className="bg-slate-800 px-3 py-1 rounded-lg"
                >
                  <Text className="text-white text-[11px] font-bold">
                    {searchingDropoff ? 'Searching...' : 'Search nearby'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                value={dropoffPostcode}
                onChangeText={setDropoffPostcode}
                placeholder="Postcode, e.g. W8 7RG"
                autoCapitalize="characters"
                className="bg-slate-50 border border-slate-300 p-2 rounded-lg text-xs mb-2.5"
              />

              {dropoffLocations.length > 0 && (
                <View className="gap-2">
                  {dropoffLocations.map((loc) => (
                    <View key={loc.id} className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                      <View className="flex-row justify-between mb-0.5">
                        <Text className="text-xs font-bold text-slate-900">{loc.name}</Text>
                        <Text className="text-[11px] font-bold text-slate-500">
                          {loc.distanceMiles} mi
                        </Text>
                      </View>
                      <Text className="text-[11px] text-slate-600">{loc.addressLine1}, {loc.postcode}</Text>
                      <Text className="text-[11px] text-emerald-700 font-bold mt-1">
                        {loc.openingHours?.monday ? `Mon-Fri: ${loc.openingHours.monday}` : 'Open Mon-Sat'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Seller Mark As Dispatched Box */}
            <View className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <Text className="text-xs font-black text-slate-900 mb-1">
                Confirm you’ve posted it
              </Text>
              <Text className="text-[11px] text-slate-500 mb-2.5">
                Once Royal Mail has it, add the tracking number so the buyer can follow it.
              </Text>

              <TextInput
                value={trackingInput}
                onChangeText={setTrackingInput}
                placeholder="Tracking number, e.g. RM892041284GB"
                autoCapitalize="characters"
                className="bg-surface border border-border-strong px-3.5 min-h-12 rounded-xl text-[15px] text-text mb-3"
              />

              <TouchableOpacity
                onPress={onMarkAsDispatched}
                disabled={busy}
                className="bg-emerald-600 py-3.5 rounded-xl items-center flex-row justify-center gap-2 active:opacity-90 shadow-sm"
              >
                <Ionicons name="paper-plane-outline" size={14} color="#FFFFFF" />
                <Text className="text-white font-black text-xs">
                  {busy ? 'Updating…' : 'Confirm posted'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* ── BUYER PROTOCOL & ESCROW TRACKING ──────────────────────────── */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {order.shippingAddress?.deliveryMethod === 'CLICK_AND_COLLECT' && (
          <View className="bg-emerald-50/70 border-2 border-emerald-500/40 rounded-2xl p-4 mb-3.5 shadow-xs">
            <View className="flex-row items-center justify-between mb-2.5">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="storefront-outline" size={18} color="#565959" />
                <Text className="text-xs font-black text-text">Click & Collect pass</Text>
              </View>
              <View className="bg-emerald-600 px-2 py-0.5 rounded-full">
                <Text className="text-[11px] font-black text-white">Pickup pass</Text>
              </View>
            </View>

            <View className="bg-white p-3 rounded-xl border border-emerald-200 mb-2.5">
              <Text className="text-[11px] font-bold text-text-muted mb-0.5">
                Collection location
              </Text>
              <Text className="text-xs font-black text-text">
                {order.shippingAddress.collectionPoint?.name || 'Your chosen collection point'}
              </Text>
              <Text className="text-[11px] text-text-muted mt-0.5">
                {[
                  order.shippingAddress.collectionPoint?.address || order.shippingAddress.line1,
                  order.shippingAddress.collectionPoint?.postcode || order.shippingAddress.postal_code,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            </View>

            {!isSellerView ? <View className="bg-white p-3 rounded-xl border border-emerald-200 flex-row items-center justify-between">
              <View>
                <Text className="text-[11px] font-bold text-text-muted">Collection PIN</Text>
                <Text className="text-xl font-black text-emerald-800 tracking-widest mt-0.5">
                  {order.shippingAddress.collectionPin || 'Sent when dispatched'}
                </Text>
              </View>
            </View> : null}
          </View>
        )}

        {/* Charity Donation Acknowledgment */}
        {order.shippingAddress?.donation && (
          <View className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 mb-3.5 flex-row items-center justify-between shadow-xs">
            <View className="flex-row items-center gap-2 flex-1 mr-2">
              <Ionicons name="heart-outline" size={18} color="#565959" />
              <View className="flex-1">
                <Text className="text-xs font-black text-rose-900">Charity donation</Text>
                <Text className="text-[11px] text-rose-700 leading-tight">
                  £1.00 donated to Good Things Foundation (Reg. #1165209). Thank you!
                </Text>
              </View>
            </View>
            <View className="bg-rose-200/80 px-2 py-0.5 rounded-full">
              <Text className="text-[11px] font-bold text-rose-900">+£1.00</Text>
            </View>
          </View>
        )}

        {/* Order progress */}
        <View className="bg-white rounded-2xl border border-borderc p-4 mb-3.5 shadow-xs">
          <View className="flex-row items-center justify-between mb-3.5 pb-2.5 border-b border-borderc">
            <View className="flex-row items-center gap-2">
              <Ionicons name="time-outline" size={16} color="#2D7A4F" />
              <Text className="text-xs font-black text-text">Order progress</Text>
            </View>
            <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Text className="text-[11px] font-bold text-emerald-800">
                {isDelivered ? 'Step 4 of 4' : isDispatched ? 'Step 3 of 4' : 'Step 2 of 4'}
              </Text>
            </View>
          </View>

          <View className="gap-3.5">
            {/* Step 1 */}
            <View className="flex-row gap-3">
              <View className="w-7 h-7 rounded-full bg-emerald-600 items-center justify-center">
                <Text className="text-white text-xs font-bold">✓</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-black text-text">1. Payment held</Text>
                  <Text className="text-[11px] font-bold text-emerald-700">Protected</Text>
                </View>
                <Text className="text-[11px] text-text-muted leading-tight mt-0.5">
                  {isSellerView ? 'The buyer’s payment is held securely by Stripe.' : `${amountFormatted} held securely by Stripe.`}
                </Text>
              </View>
            </View>

            {/* Step 2 */}
            <View className="bg-[#F5F5F0] p-3 rounded-xl border border-borderc">
              <View className="flex-row gap-3 items-start">
                <View className="w-7 h-7 rounded-full bg-[#232F3E] items-center justify-center">
                  <Ionicons name="cube-outline" size={14} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-0.5">
                    <Text className="text-xs font-black text-text">2. Seller posts it</Text>
                    <View className="bg-blue-100 px-2 py-0.2 rounded-full">
                      <Text className="text-[11px] font-bold text-blue-900">
                        {isDispatched ? 'Done' : 'In progress'}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-[11px] text-text-muted leading-tight">
                    {isDispatched
                      ? isSellerView
                        ? 'You posted the device with Royal Mail.'
                        : 'The seller has posted your device with Royal Mail.'
                      : isSellerView
                        ? 'Pack the device and post it with Royal Mail.'
                        : 'The seller is packing your device and will post it with Royal Mail.'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Step 3 */}
            <View className="flex-row gap-3 opacity-90">
              <View className="w-7 h-7 rounded-full bg-[#F5F5F0] border border-borderc items-center justify-center">
                <Ionicons name="car-outline" size={14} color="#565959" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-black text-text">3. On its way</Text>
                  <Text className="text-[11px] text-text-muted">{isDelivered ? 'Done' : isDispatched ? 'In progress' : 'Next'}</Text>
                </View>
                <Text className="text-[11px] text-text-muted leading-tight mt-0.5">
                  {isSellerView ? 'Royal Mail tracked delivery to the buyer.' : 'Royal Mail tracked delivery to you.'}
                </Text>
              </View>
            </View>

            {/* Step 4 */}
            <View className="flex-row gap-3 opacity-90">
              <View className="w-7 h-7 rounded-full bg-[#F5F5F0] border border-borderc items-center justify-center">
                <Ionicons name="shield-checkmark" size={14} color="#565959" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-black text-text">4. Final check</Text>
                  <Text className="text-[11px] font-bold text-emerald-700">{order.status === 'COMPLETED' ? 'Done' : isDelivered ? 'In progress' : 'Next'}</Text>
                </View>
                <Text className="text-[11px] text-text-muted leading-tight mt-0.5">
                  {isSellerView ? 'The buyer checks the device. You’re paid once they confirm it.' : 'Check the device matches the listing. Report a problem before you release payment.'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="gap-2 mb-4">
          {isDispatched && order.trackingNumber ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(`https://www.royalmail.com/track-your-item#/tracking-results/${order.trackingNumber}`)}
            className="bg-[#2D7A4F] py-3.5 rounded-xl items-center flex-row justify-center gap-2 active:opacity-90 shadow-sm"
          >
            <Ionicons name="locate-outline" size={14} color="#FFFFFF" />
            <Text className="text-white font-black text-xs">Track with Royal Mail</Text>
          </TouchableOpacity>
          ) : null}

          {isBuyerView && order.status === 'SHIPPED' ? (
            <TouchableOpacity
              onPress={onConfirmDelivery}
              disabled={busy}
              className="bg-[#232F3E] py-3 rounded-xl items-center active:opacity-90"
            >
              <Text className="text-white font-bold text-xs">Mark as delivered</Text>
            </TouchableOpacity>
          ) : isBuyerView && order.status === 'DELIVERED' ? (
            <TouchableOpacity
              onPress={onReleaseEscrow}
              disabled={busy}
              className="bg-emerald-600 py-3 rounded-xl items-center active:opacity-90"
            >
              <Text className="text-white font-black text-xs">✓ Confirm and release payment</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {isCompleted && (rating || !isSellerView) ? (
          <View className="bg-surface border border-borderc rounded-2xl p-4 mb-4">
            <Text className="text-[15px] font-semibold text-text">
              {rating ? (isSellerView ? 'The buyer’s rating' : 'Your rating') : 'Rate this seller'}
            </Text>
            {!rating ? (
              <Text className="text-[13px] text-text-muted mt-1 leading-[18px]">
                How did it go? Your rating helps other buyers.
              </Text>
            ) : null}
            <View className="flex-row mt-2.5" accessibilityRole={rating ? undefined : 'radiogroup'}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  disabled={!!rating}
                  onPress={() => {
                    setStars(value);
                    setRatingError('');
                  }}
                  accessibilityRole={rating ? undefined : 'radio'}
                  accessibilityLabel={`${value} ${value === 1 ? 'star' : 'stars'}`}
                  accessibilityState={{ selected: (rating?.rating ?? stars) === value }}
                  className="w-11 h-11 items-center justify-center"
                >
                  <Ionicons
                    name={value <= (rating?.rating ?? stars) ? 'star' : 'star-outline'}
                    size={28}
                    color="#FF9900"
                  />
                </Pressable>
              ))}
            </View>
            {rating ? (
              rating.comment ? (
                <Text className="text-[13px] text-text-muted mt-2 leading-[18px]">“{rating.comment}”</Text>
              ) : null
            ) : (
              <View className="mt-3">
                <Input
                  label="Add a comment (optional)"
                  placeholder="e.g. Quick to post, exactly as described."
                  value={ratingComment}
                  onChangeText={setRatingComment}
                  multiline
                  maxLength={1000}
                  error={ratingError || undefined}
                />
                <Button onPress={onRate} loading={busy}>
                  Send rating
                </Button>
              </View>
            )}
          </View>
        ) : null}

        {canReportProblem ? (
          <View className="bg-surface border border-borderc rounded-2xl p-4 mb-4">
            <Text className="text-[15px] font-semibold text-text">Something wrong?</Text>
            <Text className="text-[13px] text-text-muted mt-1 leading-[18px]">
              Not arrived, damaged or not as described? Report it and your payment stays frozen while our team reviews it.
            </Text>
            {showProblemForm ? (
              <View className="mt-3">
                <Input
                  label="What went wrong?"
                  placeholder="e.g. The screen has a crack that wasn’t in the photos."
                  value={problemReason}
                  onChangeText={(text) => {
                    setProblemReason(text);
                    setProblemError('');
                  }}
                  multiline
                  maxLength={1000}
                  error={problemError || undefined}
                />
                <Button variant="danger" onPress={onReportProblem} loading={busy}>
                  Send report
                </Button>
                <Pressable onPress={() => setShowProblemForm(false)} accessibilityRole="button" className="items-center py-3">
                  <Text className="text-sm font-medium text-text-muted">Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowProblemForm(true)}
                accessibilityRole="button"
                className="mt-3 min-h-11 rounded-xl border border-danger items-center justify-center"
              >
                <Text className="text-sm font-semibold text-danger">Report a problem</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {!isCompleted && !isDisputed ? (
          <>
          {/* Footer */}
        <View className="items-center mt-2">
          <View className="bg-white/80 border border-borderc px-3 py-1 rounded-full flex-row items-center gap-1.5 mb-1.5 shadow-xs">
            <Text className="text-[11px] text-emerald-700 font-bold">{isSellerView ? 'You’re paid once the buyer confirms delivery' : 'Payment held until delivery is confirmed'}</Text>
          </View>
          </View>
          </>
        ) : null}
      </ScrollView>
      </KeyboardArea>

      {/* ── Post Office QR drop-off Modal ──────────────────────── */}
      <Modal visible={showQrModal} transparent animationType="fade">
        <View className="flex-1 bg-black/60 items-center justify-center p-4">
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm items-center shadow-xl">
            <View className="w-12 h-12 rounded-full bg-emerald-100 items-center justify-center mb-3">
              <Ionicons name="phone-portrait-outline" size={26} color="#565959" />
            </View>

            <Text className="text-lg font-black text-slate-900 text-center mb-1">
              Post Office Counter Drop-off QR
            </Text>
            <Text className="text-xs text-slate-500 text-center mb-4">
              Present this code at any UK Post Office counter. Staff will scan it and print your 4x6&quot; label free.
            </Text>

            {order.dropoffQrCodeUrl ? (
              <Image
                source={{ uri: order.dropoffQrCodeUrl }}
                className="w-48 h-48 mb-4"
                resizeMode="contain"
                accessibilityLabel="Post Office drop-off QR code"
              />
            ) : (
              <View className="w-48 h-48 bg-slate-100 rounded-2xl items-center justify-center p-4 mb-4">
                <Text className="text-slate-600 text-xs text-center">
                  The drop-off QR code isn’t ready yet. Use the printable label instead, or try again shortly.
                </Text>
              </View>
            )}

            <View className="bg-slate-50 border border-slate-200 rounded-xl p-3 w-full mb-4">
              <Text className="text-[11px] font-bold text-slate-400">Order reference</Text>
              <Text className="text-xs font-black text-slate-800">{orderRef}</Text>
              <Text className="text-[11px] text-slate-500 mt-0.5">
                Service: {formatShippingService(order.shippingService)}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowQrModal(false)}
              className="w-full bg-slate-900 py-3 rounded-xl items-center"
            >
              <Text className="text-white text-xs font-bold">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
