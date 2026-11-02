import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { formatPrice } from '@/src/lib/currency';
import { formatShippingService, resolveDeviceWeightProfile } from '@/src/lib/shipping';
import { ordersService } from '@/src/services';
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
  const { user } = useAuth();
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
    try {
      const o = await ordersService.get(id);
      setOrder(o);
      if (o?.trackingNumber) {
        setTrackingInput(o.trackingNumber);
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
      Alert.alert('Delivery Confirmed', 'Your 48-Hour hands-on inspection window is now active!');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not confirm delivery.');
    } finally {
      setBusy(false);
    }
  };

  const onReleaseEscrow = async () => {
    Alert.alert(
      'Release Escrow Payout',
      'Are you satisfied with the device? This will release the payment to the seller.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Release',
          onPress: async () => {
            setBusy(true);
            try {
              await ordersService.updateStatus(id, { status: 'COMPLETED' });
              Alert.alert('Escrow Released', 'Payout released to seller! Thank you for trading on VeriBuy.');
              await load();
            } catch (e: any) {
              setError(e?.message || 'Could not release escrow.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const onMarkAsDispatched = async () => {
    if (!trackingInput.trim()) {
      Alert.alert('Tracking Required', 'Please enter a Royal Mail tracking number (or use generated drop-off tracking).');
      return;
    }
    setBusy(true);
    try {
      await ordersService.updateStatus(id, {
        status: 'SHIPPED',
        trackingNumber: trackingInput.trim(),
      });
      Alert.alert('Dispatched!', 'Order marked as shipped. Live Royal Mail tracking link has been sent to the buyer.');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update dispatch status.');
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
  const isBuyerView = user?.id === order.buyerId;
  const amountFormatted = formatPrice(order.totalAmount ?? order.amount, order.currency || 'GBP');
  const isDispatched =
    order.status === 'SHIPPED' || order.status === 'DELIVERED' || order.status === 'COMPLETED';
  const isDelivered = order.status === 'DELIVERED' || order.status === 'COMPLETED';
  const weightGrams = order.parcelWeightGrams ?? null;
  const isSpecialDelivery = order.shippingService === 'SPECIAL_DELIVERY_1PM';

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* ── Central Hero Icon & Escrow Status ──────────────────────────── */}
        <View className="items-center my-3">
          <View className="w-16 h-16 rounded-2xl bg-emerald-600 items-center justify-center shadow-md mb-3">
            <Ionicons name="shield-checkmark" size={30} color="#FFFFFF" />
          </View>

          <View className="bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full mb-2">
            <Text className="text-emerald-800 text-[11px] font-black uppercase tracking-wider">
              Payment protected
            </Text>
          </View>

          <Text className="text-text font-black text-2xl mb-1">
            {isSellerView ? 'Dispatch this order' : 'Payment held securely'}
          </Text>
          <Text className="text-text-muted text-xs text-center px-6 leading-relaxed mb-4">
            {isSellerView
              ? 'Buyer payment is safely held in escrow. Print your 4x6" Royal Mail label or show the digital Post Office drop-off QR code.'
              : 'The seller is only paid after you check the device and confirm it matches the listing.'}
          </Text>

          {/* Reference & Amount Split Card */}
          <View className="bg-white rounded-2xl border border-borderc p-3.5 w-full flex-row items-center justify-between shadow-xs">
            <View>
              <Text className="text-[11px] font-bold text-text-muted uppercase">Order Reference</Text>
              <Text className="text-sm font-black text-text mt-0.5">{orderRef}</Text>
            </View>
            <View className="items-end">
              <Text className="text-[11px] font-bold text-text-muted uppercase">Secured Amount</Text>
              <Text className="text-base font-black text-emerald-700 mt-0.5">{amountFormatted}</Text>
            </View>
          </View>
        </View>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* ── SELLER FULFILLMENT SECTION (If SELLER Tab) ─────────────────── */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {isSellerView && (
          <View className="gap-3.5 mb-3.5">
            {/* Royal Mail Shipping Specifications */}
            <View className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <View className="flex-row items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="mail-outline" size={18} color="#565959" />
                  <Text className="text-xs font-black text-slate-900">
                    Royal Mail Automated Shipping
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
                  <Text className="text-[11px] text-slate-400">Packaged Weight</Text>
                  <Text className="text-xs font-bold text-slate-800">{weightGrams != null ? `${weightGrams}g` : 'Calculated at dispatch'}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] text-slate-400">Parcel Format</Text>
                  <Text className="text-xs font-bold text-slate-800">
                    {order.parcelFormat === 'MEDIUM_PARCEL' ? 'Medium Parcel' : 'Small Parcel'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] text-slate-400">Transit Cover</Text>
                  <Text className="text-xs font-bold text-slate-800">
                    {isSpecialDelivery ? 'Up to £750' : 'Up to £150'}
                  </Text>
                </View>
              </View>

              {/* 2 Drop-off Pathways */}
              <Text className="text-[11px] font-bold text-slate-800 mb-2">
                Choose Drop-off Method:
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
                      Post Office Counter QR Drop-off
                    </Text>
                  </View>
                  <View className="bg-emerald-600 px-2 py-0.5 rounded-full">
                    <Text className="text-[11px] font-bold text-white">No Printer Needed</Text>
                  </View>
                </View>
                <Text className="text-[11px] text-emerald-800 leading-snug">
                  Show your digital QR code at any Post Office counter. They scan it and print the shipping label for you free of charge.
                </Text>
              </TouchableOpacity>

              {/* Pathway 2: Download 4x6" PDF Shipping Label */}
              <TouchableOpacity
                onPress={() => {
                  const url = ordersService.getShippingLabelUrl(order.id);
                  Linking.openURL(url).catch(() => {
                    Alert.alert(
                      'PDF Label',
                      `Shipping label generated for Order #${order.id.slice(0, 8)}.\nFormat: Standard 4x6" Royal Mail Tracked DataMatrix.`,
                    );
                  });
                }}
                className="bg-slate-900 p-3.5 rounded-xl flex-row items-center justify-between active:opacity-90"
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons name="print-outline" size={18} color="#565959" />
                  <View>
                    <Text className="text-xs font-black text-white">
                      Print 4x6&quot; PDF Shipping Label
                    </Text>
                    <Text className="text-[11px] text-slate-300">
                      Pre-paid Royal Mail barcode label with return address
                    </Text>
                  </View>
                </View>
                <Text className="text-white text-xs font-bold">Download </Text>
              </TouchableOpacity>
            </View>

            {/* Nearby Royal Mail Drop-off Point Finder */}
            <View className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <View className="flex-row items-center justify-between mb-2.5">
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="location-outline" size={16} color="#565959" />
                  <Text className="text-xs font-black text-slate-900">
                    Find Royal Mail Drop-off Points
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={searchDropoff}
                  disabled={searchingDropoff}
                  className="bg-slate-800 px-3 py-1 rounded-lg"
                >
                  <Text className="text-white text-[11px] font-bold">
                    {searchingDropoff ? 'Searching...' : 'Search Nearby'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                value={dropoffPostcode}
                onChangeText={setDropoffPostcode}
                placeholder="Enter UK Postcode (e.g. W8 7RG)"
                autoCapitalize="characters"
                className="bg-slate-50 border border-slate-300 p-2 rounded-lg text-xs font-mono uppercase mb-2.5"
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
                Dispatch Confirmation
              </Text>
              <Text className="text-[11px] text-slate-500 mb-2.5">
                Once handed to Royal Mail, confirm tracking below to notify the buyer and update the escrow pipeline.
              </Text>

              <TextInput
                value={trackingInput}
                onChangeText={setTrackingInput}
                placeholder="Royal Mail Tracking # (e.g. RM892041284GB)"
                autoCapitalize="characters"
                className="bg-slate-50 border border-slate-300 p-2.5 rounded-xl text-xs font-mono mb-3 uppercase"
              />

              <TouchableOpacity
                onPress={onMarkAsDispatched}
                disabled={busy}
                className="bg-emerald-600 py-3.5 rounded-xl items-center flex-row justify-center gap-2 active:opacity-90 shadow-sm"
              >
                <Ionicons name="paper-plane-outline" size={14} color="#FFFFFF" />
                <Text className="text-white font-black text-xs">
                  {busy ? 'Updating...' : 'Confirm Parcel Handed to Courier'}
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
                <Text className="text-xs font-black text-text">Click &amp; Collect Collection Pass</Text>
              </View>
              <View className="bg-emerald-600 px-2 py-0.5 rounded-full">
                <Text className="text-[11px] font-black text-white">Pickup Pass</Text>
              </View>
            </View>

            <View className="bg-white p-3 rounded-xl border border-emerald-200 mb-2.5">
              <Text className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-0.5">
                Collection Location
              </Text>
              <Text className="text-xs font-black text-text">
                {order.shippingAddress.collectionPoint?.name || 'Kensington High Street Post Office'}
              </Text>
              <Text className="text-[11px] text-text-muted mt-0.5">
                {order.shippingAddress.collectionPoint?.address || order.shippingAddress.line1},{' '}
                {order.shippingAddress.collectionPoint?.postcode || order.shippingAddress.postal_code}
              </Text>
            </View>

            <View className="bg-white p-3 rounded-xl border border-emerald-200 flex-row items-center justify-between">
              <View>
                <Text className="text-[11px] font-bold text-text-muted uppercase">6-Digit Collection PIN</Text>
                <Text className="text-xl font-black font-mono text-emerald-800 tracking-widest mt-0.5">
                  {order.shippingAddress.collectionPin || 'Sent when dispatched'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Charity Donation Acknowledgment */}
        {order.shippingAddress?.donation && (
          <View className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 mb-3.5 flex-row items-center justify-between shadow-xs">
            <View className="flex-row items-center gap-2 flex-1 mr-2">
              <Ionicons name="heart-outline" size={18} color="#565959" />
              <View className="flex-1">
                <Text className="text-xs font-black text-rose-900">Digital Inclusion Charity Donation</Text>
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
                  {amountFormatted} held securely by Stripe.
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
                    <Text className="text-xs font-black text-text">2. Seller Dispatch</Text>
                    <View className="bg-blue-100 px-2 py-0.2 rounded-full">
                      <Text className="text-[11px] font-bold text-blue-900">
                        {isDispatched ? 'COMPLETED' : 'IN PROGRESS'}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-[11px] text-text-muted leading-tight">
                    The seller is packing your device and will post it with Royal Mail.
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
                  <Text className="text-xs font-black text-text">3. Tracked Transit</Text>
                  <Text className="text-[11px] text-text-muted">Next</Text>
                </View>
                <Text className="text-[11px] text-text-muted leading-tight mt-0.5">
                  Royal Mail tracked delivery to you.
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
                  <Text className="text-xs font-black text-text">4. 48-hour check</Text>
                  <Text className="text-[11px] font-bold text-emerald-700">Buyer Protection</Text>
                </View>
                <Text className="text-[11px] text-text-muted leading-tight mt-0.5">
                  Check the device matches the listing. Report any problem within 48 hours.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="gap-2 mb-4">
          <TouchableOpacity
            onPress={() => {
              if (order.trackingNumber) {
                Linking.openURL(`https://www.royalmail.com/track-your-item#/tracking-results/${order.trackingNumber}`);
              } else {
                Alert.alert('Dispatch Tracking', 'Seller is packaging your parcel. Live Royal Mail tracking link activates upon courier handoff.');
              }
            }}
            className="bg-[#2D7A4F] py-3.5 rounded-xl items-center flex-row justify-center gap-2 active:opacity-90 shadow-sm"
          >
            <Ionicons name="locate-outline" size={14} color="#FFFFFF" />
            <Text className="text-white font-black text-xs">Track with Royal Mail</Text>
          </TouchableOpacity>

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

        {/* Footer */}
        <View className="items-center mt-2">
          <View className="bg-white/80 border border-borderc px-3 py-1 rounded-full flex-row items-center gap-1.5 mb-1.5 shadow-xs">
            <Text className="text-[11px] text-emerald-700 font-bold">Payment held until delivery is confirmed</Text>
          </View>
          </View>
      </ScrollView>

      {/* ── Post Office Counter QR Drop-off Modal ──────────────────────── */}
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
              <Text className="text-[11px] font-bold text-slate-400 uppercase">Order Reference</Text>
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
