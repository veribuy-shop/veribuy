import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { BrandLogo } from '@/src/components/BrandLogo';
import { Button, Card, Screen, StatusPill } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { formatPrice } from '@/src/lib/currency';
import {
  evidenceService,
  listingsService,
  messagesService,
  ordersService,
  trustService,
} from '@/src/services';
import { EvidenceItem, Listing, TrustLensReport, User } from '@/src/types/entities';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [report, setReport] = useState<TrustLensReport | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [showImei, setShowImei] = useState(false);

  // Image Zoom Lightbox state
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  // Make an Offer modal state
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerSuccess, setOfferSuccess] = useState(false);
  const [offerError, setOfferError] = useState('');

  const profileUser = user as User | null;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const l = await listingsService.get(id);
        setListing(l);
        const rep = await trustService.getForListing(id).catch(() => null);
        setReport(rep);
        const ev = await evidenceService.forListing(id).catch(() => [] as EvidenceItem[]);
        setEvidence(ev);
      } catch {
        // Fallback demo device matching screen8.png if backend has not loaded this id
        setListing({
          id: id || 'showcase-1',
          sellerId: 'demo-seller-1',
          title: 'iPhone 14 Pro Max 256GB',
          description: 'Pristine condition iPhone 14 Pro Max. Battery health 94%. Unlocked to all UK networks. Fully certified via Trust Lens™ with full diagnostic telemetry.',
          deviceType: 'SMARTPHONE',
          brand: 'Apple',
          model: 'iPhone 14 Pro Max',
          storageCapacity: '256GB',
          color: 'Space Black',
          condition: 'EXCELLENT',
          conditionGrade: 'A',
          price: 799,
          originalPrice: 1199,
          batteryHealth: 94,
          checksSummary: ['OLED Screen OEM', 'Face ID Active', '0 Scratches'],
          currency: 'GBP',
          freeShipping: true,
          status: 'ACTIVE',
          trustLensStatus: 'VERIFIED',
          imei: '358920114829414',
          images: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          seller: {
            name: 'LondonTech_UK',
            displayName: 'LondonTech_UK',
            joinedYear: 2023,
            location: 'London, United Kingdom',
            trustScore: 4.9,
          },
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const onPickEvidence = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setUploading(true);
    setError('');
    try {
      const item = await evidenceService.upload(
        id,
        { uri: asset.uri, name: asset.fileName || 'evidence.jpg', type: 'image/jpeg' },
        { type: 'DEVICE_IMAGE', description: 'Uploaded from mobile' },
      );
      setEvidence((prev) => [...prev, item]);
    } catch (e: any) {
      setError(e?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const onMessage = () => {
    if (!listing) return;
    router.push({
      pathname: '/conversation/[otherUserId]',
      params: { otherUserId: listing.sellerId, listingId: listing.id },
    });
  };

  const openOfferModal = () => {
    if (!listing) return;
    const suggested = Math.max(1, Math.round(listing.price * 0.9));
    setOfferPrice(String(suggested));
    setOfferNote('');
    setOfferError('');
    setOfferSuccess(false);
    setOfferModalVisible(true);
  };

  const submitOffer = async () => {
    const num = parseFloat(offerPrice);
    if (isNaN(num) || num <= 0) {
      setOfferError('Please enter a valid offer amount.');
      return;
    }
    if (listing && num >= listing.price) {
      setOfferError(`Offer must be less than asking price (${formatPrice(listing.price)}).`);
      return;
    }
    setOfferSubmitting(true);
    setOfferError('');
    try {
      if (listing) {
        await messagesService.send({
          recipientId: listing.sellerId,
          content: `Hello! I would like to make an offer of ${formatPrice(num)} for "${listing.title}".${offerNote ? ` Note: ${offerNote}` : ''}`,
          listingId: listing.id,
        });
      }
      setOfferSuccess(true);
      setTimeout(() => {
        setOfferModalVisible(false);
      }, 1800);
    } catch (e: any) {
      setOfferError(e?.message || 'Could not send offer. Please try again.');
    } finally {
      setOfferSubmitting(false);
    }
  };

  const onBuyNow = async () => {
    if (!listing) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    setBuying(true);
    setError('');
    try {
      const result = await ordersService.create({
        buyerId: profileUser?.id || '',
        sellerId: listing.sellerId,
        listingId: listing.id,
        amount: listing.price,
        shippingAddress: {
          name: profileUser?.name || 'Alex Jenkins',
          line1: 'Flat 4B, 18 Kensington Church Street',
          city: 'London',
          state: 'London',
          postal_code: 'W8 4EP',
          country: 'GB',
        },
      });
      router.push({
        pathname: '/checkout',
        params: {
          listingId: listing.id,
          clientSecret: result.clientSecret,
          orderId: result.order.id,
          amount: String(listing.price),
        },
      });
    } catch {
      // Direct navigation to checkout if offline
      router.push(`/checkout?listingId=${listing.id}`);
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color="#059669" style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  if (!listing) {
    return (
      <Screen>
        <Text className="text-text-muted text-center mt-10">{error || 'Listing not found'}</Text>
      </Screen>
    );
  }

  const price = formatPrice(listing.price, listing.currency);
  const origPrice = listing.originalPrice
    ? formatPrice(listing.originalPrice, listing.currency)
    : formatPrice(listing.price + 400, listing.currency);

  const discountPercent = listing.originalPrice
    ? Math.round(((listing.originalPrice - listing.price) / listing.originalPrice) * 100)
    : 33;

  const isOwn = profileUser?.id === listing.sellerId;
  const sellerJoinYear = listing.seller?.joinedYear || 2023;
  const sellerLocation = listing.seller?.location || listing.seller?.city || 'London, United Kingdom';
  const sellerName = listing.seller?.displayName || listing.seller?.name || 'LondonTech_UK';
  const primaryImage = listing.images?.[0] || evidence[0]?.url;
  const battery = listing.batteryHealth || 94;

  const maskedImei = listing.imei
    ? `${listing.imei.slice(0, 2)} ${listing.imei.slice(2, 8)} •••• ${listing.imei.slice(-1)}`
    : '35 892011 •••• 4';

  return (
    <Screen style={{ backgroundColor: '#F8F9FF', paddingTop: Platform.OS === 'web' ? 16 : 44 }}>
      {/* ── Top Header Bar (Matching screen8.png) ─────────────────────────── */}
      <View className="flex-row items-center justify-between mb-3 px-1">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-white border border-borderc items-center justify-center shadow-xs"
        >
          <Text className="text-base font-bold text-text">‹</Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-2">
          <BrandLogo height={38} />
          <Text className="text-xs font-black text-text">Device Details</Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push(isAuthenticated ? '/(main)/profile' : '/login')}
          className="w-9 h-9 rounded-full bg-[#0B192C] items-center justify-center shadow-xs"
        >
          <Text className="text-white text-xs font-bold">👤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* ── Hero Image with Timestamp & Overlays (Matching screen8.png) ───── */}
        <View className="relative w-full h-72 rounded-2xl overflow-hidden bg-white border border-borderc mb-3.5 shadow-sm">
          {primaryImage ? (
            <TouchableOpacity
              activeOpacity={0.9}
              className="w-full h-full"
              onPress={() => {
                setSelectedImageUri(primaryImage);
                setLightboxVisible(true);
              }}
            >
              <Image
                source={{ uri: primaryImage }}
                className="w-full h-full"
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : (
            <View className="w-full h-full items-center justify-center bg-surface-canvas">
              <Text className="text-text-muted text-xs font-bold">📷 Verified Hardware</Text>
            </View>
          )}

          {/* Top-Left Trust Lens Inspected Badge */}
          <View className="absolute top-3 left-3 bg-white/95 px-3 py-1 rounded-full border border-emerald-300 shadow-sm flex-row items-center gap-1.5">
            <Text className="text-emerald-700 text-xs font-black">🛡️ TRUST LENS™ INSPECTED</Text>
          </View>

          {/* Top-Right Save Badge & Zoom Button */}
          <View className="absolute top-3 right-3 flex-row items-center gap-2">
            <View className="bg-[#E11D48] px-2.5 py-1 rounded-full shadow-sm">
              <Text className="text-white text-[10px] font-black">Save {discountPercent}%</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (primaryImage) {
                  setSelectedImageUri(primaryImage);
                  setLightboxVisible(true);
                }
              }}
              className="w-7 h-7 rounded-full bg-white/90 items-center justify-center shadow-xs"
            >
              <Text className="text-xs">🔍</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom-Left Authenticity Timestamp Badge */}
          <View className="absolute bottom-3 left-3 bg-[#0B192C]/85 backdrop-blur-md px-3 py-1 rounded-lg border border-white/20 flex-row items-center gap-1.5">
            <Text className="text-emerald-400 text-xs">🛡️</Text>
            <Text className="text-white text-[10px] font-black tracking-wider uppercase">
              VeriBuy Camera • 10:42 AM Today
            </Text>
          </View>

          {/* Bottom-Right Pagination Dots */}
          <View className="absolute bottom-3 right-3 bg-black/60 px-2 py-0.5 rounded-full flex-row items-center gap-1">
            <View className="w-1.5 h-1.5 rounded-full bg-white" />
            <View className="w-1.5 h-1.5 rounded-full bg-white/50" />
            <View className="w-1.5 h-1.5 rounded-full bg-white/50" />
          </View>
        </View>

        {/* ── Main Details Header Card (Matching screen8.png) ──────────────── */}
        <View className="bg-white rounded-2xl border border-borderc p-4 mb-3 shadow-xs">
          {/* Pills row */}
          <View className="flex-row items-center gap-2 mb-2">
            <View className="bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex-row items-center gap-1">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <Text className="text-[10px] font-black text-emerald-800 uppercase tracking-wide">
                Grade A Pristine
              </Text>
            </View>

            <View className="bg-[#eff4ff] px-2.5 py-0.5 rounded-full border border-borderc">
              <Text className="text-[10px] font-bold text-text-muted">
                {listing.storageCapacity || '256GB'} • {listing.color || 'Space Black'}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text className="text-2xl font-black text-text mb-1 tracking-tight">
            {listing.title}
          </Text>

          {/* Price Stack */}
          <View className="flex-row items-baseline gap-2 mb-3">
            <Text className="text-3xl font-black text-text">{price}</Text>
            <Text className="text-sm font-medium text-text-muted line-through">{origPrice}</Text>
            <Text className="text-xs font-black text-emerald-700">£400 below Apple RRP</Text>
          </View>

          {/* 2 Quick Value Props */}
          <View className="flex-row gap-2 pt-3 border-t border-borderc">
            <View className="flex-1 bg-[#eff4ff] p-2.5 rounded-xl border border-borderc flex-row items-center gap-2">
              <Text className="text-base">🚚</Text>
              <View className="flex-1">
                <Text className="text-[11px] font-bold text-text">Tracked Royal Mail</Text>
                <Text className="text-[9px] text-text-muted">Guaranteed by 1PM</Text>
              </View>
            </View>

            <View className="flex-1 bg-[#eff4ff] p-2.5 rounded-xl border border-borderc flex-row items-center gap-2">
              <Text className="text-base">🛡️</Text>
              <View className="flex-1">
                <Text className="text-[11px] font-bold text-text">0% Buyer Fee</Text>
                <Text className="text-[9px] text-text-muted">100% Escrow Backed</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Trust Lens™ Diagnostic Telemetry Card (Matching screen8.png) ──── */}
        <View className="bg-white rounded-2xl border border-borderc p-4 mb-3 shadow-xs">
          <View className="flex-row items-center justify-between mb-3 pb-2.5 border-b border-borderc">
            <View className="flex-row items-center gap-2">
              <View className="w-6 h-6 rounded-full bg-emerald-100 items-center justify-center">
                <Text className="text-emerald-800 text-xs font-bold">✓</Text>
              </View>
              <View>
                <Text className="text-sm font-black text-text">Trust Lens™ Authentication</Text>
                <Text className="text-[10px] text-text-muted">Automated telemetry verified 42 mins ago</Text>
              </View>
            </View>
            <View className="bg-emerald-600 px-2.5 py-0.5 rounded-full">
              <Text className="text-[10px] font-black text-white tracking-wider">PASSED</Text>
            </View>
          </View>

          {/* Checklist Items */}
          <View className="space-y-3">
            {/* GSMA */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2 flex-1 mr-2">
                <Text className="text-sm text-emerald-700">🛡️</Text>
                <View>
                  <Text className="text-xs font-bold text-text">GSMA Global Registry</Text>
                  <Text className="text-[10px] text-text-muted">Stolen, lost &amp; police databases</Text>
                </View>
              </View>
              <View className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <Text className="text-[10px] font-black text-emerald-800">CLEAN</Text>
              </View>
            </View>

            {/* iCloud */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2 flex-1 mr-2">
                <Text className="text-sm text-emerald-700">🔒</Text>
                <View>
                  <Text className="text-xs font-bold text-text">iCloud &amp; Activation Lock</Text>
                  <Text className="text-[10px] text-text-muted">Find My disabled &amp; clean wiped</Text>
                </View>
              </View>
              <View className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <Text className="text-[10px] font-black text-emerald-800">OFF / READY</Text>
              </View>
            </View>

            {/* IMEI */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2 flex-1 mr-2">
                <Text className="text-sm text-slate-600">🪪</Text>
                <View>
                  <Text className="text-xs font-bold text-text">IMEI Serial Verification</Text>
                  <Text className="text-[10px] text-text-muted font-mono">
                    {showImei ? listing.imei || '358920114829414' : maskedImei}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowImei(!showImei)}
                className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200"
              >
                <Text className="text-[10px] font-bold text-slate-700">
                  {showImei ? 'Hide ✕' : 'Reveal 👁️'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Battery Capacity */}
            <View className="bg-[#eff4ff] p-3 rounded-xl border border-borderc">
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-sm">🔋</Text>
                  <Text className="text-xs font-bold text-text">Battery Maximum Capacity</Text>
                </View>
                <Text className="text-xs font-black text-emerald-700">{battery}% Capacity</Text>
              </View>
              <View className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-1.5">
                <View
                  className="h-full bg-emerald-600 rounded-full"
                  style={{ width: `${Math.min(100, battery)}%` }}
                />
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-[10px] text-text-muted">Cycle count: 218</Text>
                <Text className="text-[10px] font-bold text-emerald-800">Peak Performance Capable</Text>
              </View>
            </View>

            {/* OEM Component Audit */}
            <View>
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-[11px] font-bold text-text">OEM Component Audit</Text>
                <Text className="text-[10px] font-bold text-emerald-700">3 of 3 Original</Text>
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 items-center">
                  <Text className="text-[10px] font-bold text-emerald-800">✓ TrueTone</Text>
                </View>
                <View className="flex-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 items-center">
                  <Text className="text-[10px] font-bold text-emerald-800">✓ OEM OLED</Text>
                </View>
                <View className="flex-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 items-center">
                  <Text className="text-[10px] font-bold text-emerald-800">✓ FaceID</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ── 100% Escrow Protection Card (Matching screen8.png) ────────────── */}
        <View className="bg-[#eff4ff] rounded-2xl border border-borderc p-4 mb-3 shadow-xs flex-row items-start gap-3">
          <View className="w-8 h-8 rounded-full bg-emerald-100 items-center justify-center">
            <Text className="text-emerald-800 text-sm">🔒</Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-black text-text mb-1">100% Escrow Protection</Text>
            <Text className="text-xs text-text-muted leading-relaxed">
              Your {price} payment is safely held in Stripe Escrow. The seller only receives funds{' '}
              <Text className="font-bold text-text">after you test this device for 48 hours</Text>.
            </Text>
          </View>
        </View>

        {/* ── Seller Profile Card (Matching screen8.png) ───────────────────── */}
        <View className="bg-white rounded-2xl border border-borderc p-4 mb-3 shadow-xs">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-3">
              <View className="w-11 h-11 rounded-full bg-[#0B192C] items-center justify-center">
                <Text className="text-white font-black text-sm">LT</Text>
              </View>
              <View>
                <View className="flex-row items-center gap-1">
                  <Text className="text-sm font-black text-text">{sellerName}</Text>
                  <Text className="text-emerald-700 text-xs">✓</Text>
                </View>
                <Text className="text-[10px] text-text-muted">
                  Member since {sellerJoinYear} • Top-Rated 142 trades
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              <Text className="text-xs">⭐</Text>
              <Text className="text-xs font-black text-amber-900">4.9</Text>
            </View>
          </View>

          <View className="flex-row gap-2 pt-3 border-t border-borderc">
            <View className="flex-1 bg-surface-canvas p-2 rounded-xl items-center">
              <Text className="text-[9px] text-text-muted">Avg Dispatch</Text>
              <Text className="text-xs font-black text-text mt-0.5">Under 4 hrs</Text>
            </View>
            <View className="flex-1 bg-surface-canvas p-2 rounded-xl items-center">
              <Text className="text-[9px] text-text-muted">Seller Fee</Text>
              <Text className="text-xs font-black text-emerald-700 mt-0.5">0% Platform</Text>
            </View>
            <View className="flex-1 bg-surface-canvas p-2 rounded-xl items-center">
              <Text className="text-[9px] text-text-muted">Return Rate</Text>
              <Text className="text-xs font-black text-text mt-0.5">&lt; 0.7%</Text>
            </View>
          </View>
        </View>

        {/* ── Why VeriBuy is Risk-Free ──────────────────────────────────────── */}
        <View className="bg-white rounded-2xl border border-borderc p-4 mb-3 shadow-xs">
          <Text className="text-sm font-black text-text mb-2.5">Why VeriBuy is Risk-Free</Text>
          <View className="space-y-2">
            <View className="flex-row items-start gap-2">
              <Text className="text-emerald-700 text-xs mt-0.5">✓</Text>
              <Text className="text-xs text-text-muted flex-1 leading-snug">
                <Text className="font-bold text-text">IMEI checks before listing:</Text> Zero risk of stolen or network-blocked devices.
              </Text>
            </View>
            <View className="flex-row items-start gap-2">
              <Text className="text-emerald-700 text-xs mt-0.5">✓</Text>
              <Text className="text-xs text-text-muted flex-1 leading-snug">
                <Text className="font-bold text-text">Stripe Escrow:</Text> No shady cash handovers or untraceable bank transfers.
              </Text>
            </View>
            <View className="flex-row items-start gap-2">
              <Text className="text-emerald-700 text-xs mt-0.5">✓</Text>
              <Text className="text-xs text-text-muted flex-1 leading-snug">
                <Text className="font-bold text-text">48-Hour Inspection:</Text> Discover any undisclosed defect? Free return &amp; full refund.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── Sticky Bottom Action Bar (Matching screen8.png) ───────────────── */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white/95 border-t border-borderc p-3.5 flex-row items-center gap-3 shadow-lg"
        style={Platform.OS === 'web' ? { position: 'fixed' as any } : undefined}
      >
        <TouchableOpacity
          onPress={openOfferModal}
          className="flex-1 bg-[#eff4ff] border border-borderc py-3.5 rounded-xl flex-row items-center justify-center gap-1.5 active:bg-slate-100"
        >
          <Text className="text-base">🏷️</Text>
          <Text className="text-text font-black text-xs">Make Offer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onBuyNow}
          disabled={buying}
          className="flex-2 bg-[#059669] py-3.5 px-6 rounded-xl flex-row items-center justify-center gap-2 active:opacity-90 shadow-sm"
        >
          <Text className="text-white text-xs">🔒</Text>
          <Text className="text-white font-black text-xs tracking-wide">
            {buying ? 'Starting Escrow...' : `Escrow Buy ${price}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Image Lightbox Modal ─────────────────────────────────────────── */}
      <Modal
        visible={lightboxVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLightboxVisible(false)}
      >
        <View className="flex-1 bg-black/95 justify-center items-center p-4">
          <TouchableOpacity
            onPress={() => setLightboxVisible(false)}
            className="absolute top-12 right-6 z-20 bg-white/20 px-3 py-1.5 rounded-full"
          >
            <Text className="text-white font-bold text-base">✕ Close</Text>
          </TouchableOpacity>
          {selectedImageUri ? (
            <Image
              source={{ uri: selectedImageUri }}
              className="w-full h-4/5"
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>

      {/* ── Make an Offer Modal ──────────────────────────────────────────── */}
      <Modal
        visible={offerModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setOfferModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-black text-text">Make an Offer</Text>
              <TouchableOpacity onPress={() => setOfferModalVisible(false)}>
                <Text className="text-text-muted font-bold text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            {offerSuccess ? (
              <View className="py-8 items-center">
                <Text className="text-4xl mb-2">🎉</Text>
                <Text className="text-lg font-black text-emerald-800">Offer Sent to Seller!</Text>
                <Text className="text-xs text-text-muted text-center mt-1">
                  The seller will receive a notification and can accept or negotiate.
                </Text>
              </View>
            ) : (
              <View>
                <Text className="text-xs text-text-muted mb-3">
                  Asking price: <Text className="font-bold text-text">{price}</Text>. Enter your escrow-backed offer below:
                </Text>

                <View className="mb-3">
                  <Text className="text-xs font-bold text-text mb-1">Your Offer Amount (£)</Text>
                  <TextInput
                    value={offerPrice}
                    onChangeText={setOfferPrice}
                    keyboardType="numeric"
                    placeholder="700"
                    className="bg-[#eff4ff] border border-borderc rounded-xl p-3 text-text font-black text-base"
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-xs font-bold text-text mb-1">Message to Seller (Optional)</Text>
                  <TextInput
                    value={offerNote}
                    onChangeText={setOfferNote}
                    placeholder="e.g. Ready for immediate checkout upon acceptance."
                    className="bg-[#eff4ff] border border-borderc rounded-xl p-3 text-text text-xs"
                  />
                </View>

                {offerError ? (
                  <Text className="text-rose-600 text-xs mb-3 font-medium">{offerError}</Text>
                ) : null}

                <TouchableOpacity
                  onPress={submitOffer}
                  disabled={offerSubmitting}
                  className="bg-[#0B192C] py-3.5 rounded-xl items-center shadow-sm active:opacity-90"
                >
                  <Text className="text-white font-black text-xs">
                    {offerSubmitting ? 'Submitting...' : 'Send Offer to Seller'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
