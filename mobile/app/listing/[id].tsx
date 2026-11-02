import { Ionicons } from '@expo/vector-icons';
import { auctionPaymentDeadline, calculateMinimumNextBid, formatAuctionCountdown } from '@veribuy/common/auction';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Input, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { formatPrice } from '@/src/lib/currency';
import { buyerFacingPrice, calculateBuyerProtectionFee, getBuyerProtectionFeePercent } from '@/src/lib/fees';
import { evidenceService, listingsService, offersService, ordersService, trustService } from '@/src/services';
import { EvidenceItem, Listing, TrustLensCheckSummary } from '@/src/types/entities';

const GRADE_LABEL: Record<string, string> = { A: 'Pristine', B: 'Good', C: 'Fair' };

/** Only show photos (not settings screenshots) in the gallery, device photos first. */
function galleryImages(listing: Listing, evidence: EvidenceItem[]): string[] {
  const order = ['DEVICE_IMAGE', 'SCREEN_IMAGE', 'BODY_IMAGE', 'PACKAGING_IMAGE', 'ACCESSORIES_IMAGE'];
  const photos = evidence
    .filter((e) => order.includes(e.type) && e.url)
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
    .map((e) => e.url);
  if (photos.length > 0) return photos;
  return [listing.imageUrl, ...(listing.images || [])].filter((u): u is string => Boolean(u));
}

export default function ListingDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [checks, setChecks] = useState<TrustLensCheckSummary | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [hasPendingCheckout, setHasPendingCheckout] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerSuccess, setOfferSuccess] = useState(false);
  const [offerError, setOfferError] = useState('');

  const [bidModalVisible, setBidModalVisible] = useState(false);
  const [maxBid, setMaxBid] = useState('');
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [bidResult, setBidResult] = useState('');
  const [bidError, setBidError] = useState('');
  const [, setCountdownTick] = useState(0);

  // Keep an auction's time left current while it's on screen.
  const auctionEndsAt = listing?.auctionEndsAt;
  useEffect(() => {
    if (!auctionEndsAt) return;
    const timer = setInterval(() => setCountdownTick((tick) => tick + 1), 1000);
    return () => clearInterval(timer);
  }, [auctionEndsAt]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError('');
    try {
      const l = await listingsService.get(id);
      setListing(l);
      // A reserved listing reads as INACTIVE. The buyer holding it can still
      // finish their own checkout, including one started on the web.
      if (l.status !== 'ACTIVE' && user?.id) {
        const orders = await ordersService.buyerOrders(user.id).catch(() => []);
        setHasPendingCheckout(orders.some((o) => o.listingId === l.id && o.status === 'PENDING'));
      } else {
        setHasPendingCheckout(false);
      }
      const [summary, ev] = await Promise.all([
        trustService.publicSummary(id).catch(() => null),
        evidenceService.forListing(id).catch(() => [] as EvidenceItem[]),
      ]);
      setChecks(summary);
      setEvidence(ev);
    } catch (e: any) {
      setListing(null);
      setLoadError(e?.status === 404 ? 'This listing is no longer available.' : 'We could not load this listing. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const requireSignIn = (): boolean => {
    if (isAuthenticated) return true;
    router.push('/(auth)/login');
    return false;
  };

  const openOfferModal = () => {
    if (!listing || !requireSignIn()) return;
    setOfferPrice(String(Math.max(1, Math.round(Number(listing.price) * 0.9))));
    setOfferNote('');
    setOfferError('');
    setOfferSuccess(false);
    setOfferModalVisible(true);
  };

  const submitOffer = async () => {
    if (!listing) return;
    const amount = parseFloat(offerPrice);
    if (!Number.isFinite(amount) || amount <= 0) {
      setOfferError('Enter a valid offer amount.');
      return;
    }
    if (amount >= Number(listing.price)) {
      setOfferError(`Your offer must be below the asking price of ${formatPrice(listing.price, listing.currency)}.`);
      return;
    }
    setOfferSubmitting(true);
    setOfferError('');
    try {
      await offersService.make(listing.id, Math.round(amount * 100) / 100, offerNote.trim() || undefined);
      setOfferSuccess(true);
    } catch (e: any) {
      setOfferError(e?.message || 'Your offer was not sent. Please try again.');
    } finally {
      setOfferSubmitting(false);
    }
  };

  const openBidModal = () => {
    if (!listing || !requireSignIn()) return;
    setMaxBid(String(calculateMinimumNextBid(Number(listing.currentBid), Number(listing.startingBid), listing.bidCount ?? 0)));
    setBidResult('');
    setBidError('');
    setBidModalVisible(true);
  };

  const submitBid = async () => {
    if (!listing) return;
    const amount = Math.round(parseFloat(maxBid) * 100) / 100;
    const minimum = calculateMinimumNextBid(Number(listing.currentBid), Number(listing.startingBid), listing.bidCount ?? 0);
    if (!Number.isFinite(amount) || amount < minimum) {
      setBidError(`Your maximum bid must be at least ${formatPrice(minimum, listing.currency)}.`);
      return;
    }
    // Bids are binding, so a stray digit must not go through unseen.
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(`Bid up to ${formatPrice(amount, listing.currency)}?`, 'This bid is binding if you win.', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Confirm bid', onPress: () => resolve(true) },
      ]);
    });
    if (!confirmed) return;

    setBidSubmitting(true);
    setBidError('');
    try {
      await listingsService.placeBid(listing.id, amount);
      const updated = await listingsService.get(listing.id);
      setListing(updated);
      // What they just bid may now be under the minimum, so start them from there.
      setMaxBid(String(calculateMinimumNextBid(Number(updated.currentBid), Number(updated.startingBid), updated.bidCount ?? 0)));
      setBidResult(
        updated.highestBidderId === user?.id
          ? `You’re the highest bidder at ${formatPrice(Number(updated.currentBid), updated.currency)}. We’ll only bid as much as needed, up to your maximum.`
          : `Another bidder’s maximum is higher, so the bid is now ${formatPrice(Number(updated.currentBid), updated.currency)}. You can bid again.`,
      );
    } catch (e: any) {
      setBidError(e?.message || 'Your bid was not placed. Please try again.');
    } finally {
      setBidSubmitting(false);
    }
  };

  const onBuyNow = () => {
    if (!listing || !requireSignIn()) return;
    // Checkout creates the order and takes the delivery address itself.
    router.push({ pathname: '/checkout', params: { listingId: listing.id } });
  };

  const onMessage = () => {
    if (!listing || !requireSignIn()) return;
    router.push({
      pathname: '/conversation/[otherUserId]',
      params: { otherUserId: listing.sellerId, listingId: listing.id },
    });
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color="#2D7A4F" style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  if (!listing) {
    return (
      <Screen style={{ justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text className="text-base font-black text-text mb-2 text-center">{loadError || 'Listing not found'}</Text>
        <TouchableOpacity onPress={load} accessibilityRole="button" className="bg-[#2D7A4F] px-5 py-3 rounded-xl mb-3">
          <Text className="text-white font-bold">Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text className="text-emerald-700 font-bold">Go back</Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  const currency = listing.currency || 'GBP';
  const askingPrice = Number(listing.price);
  const feePercent = getBuyerProtectionFeePercent();
  const buyerPrice = buyerFacingPrice(askingPrice, feePercent);
  const protectionFee = calculateBuyerProtectionFee(askingPrice, feePercent);
  const images = galleryImages(listing, evidence);
  const isOwn = user?.id === listing.sellerId;
  const isAuction = listing.format === 'AUCTION';
  const isActive = listing.status === 'ACTIVE';
  const countdown = formatAuctionCountdown(listing.auctionEndsAt);
  const isHighestBidder = !!user?.id && listing.highestBidderId === user.id;
  const wonAuction = isAuction && isHighestBidder && (listing.status === 'AUCTION_ENDED' || countdown.isEnded);
  const minimumBid = calculateMinimumNextBid(Number(listing.currentBid), Number(listing.startingBid), listing.bidCount ?? 0);
  const verified = listing.trustLensStatus === 'PASSED';
  const grade = listing.conditionGrade ? `Grade ${listing.conditionGrade} · ${GRADE_LABEL[listing.conditionGrade] ?? ''}` : null;
  const specs = [listing.storageCapacity, listing.color].filter(Boolean).join(' · ');
  const sellerName = listing.seller?.displayName || listing.seller?.name || 'VeriBuy seller';
  const sellerPlace = listing.seller?.city || listing.seller?.location;
  const sellerRating = listing.seller?.sellerRating;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* Photos */}
        <View className="w-full h-72 rounded-2xl overflow-hidden bg-white border border-borderc mb-2">
          {images.length > 0 ? (
            <TouchableOpacity
              activeOpacity={0.9}
              className="w-full h-full"
              onPress={() => setLightboxUri(images[activeImage])}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Photo ${activeImage + 1} of ${images.length}. Tap to enlarge.`}
            >
              <Image source={{ uri: images[activeImage] }} className="w-full h-full" resizeMode="contain" />
            </TouchableOpacity>
          ) : (
            <View className="w-full h-full items-center justify-center bg-surface-canvas">
              <Text className="text-text-muted text-xs font-bold">No photos yet</Text>
            </View>
          )}
          {verified ? (
            <View className="absolute top-3 left-3 bg-white/95 px-3 py-1 rounded-full border border-emerald-300">
              <Text className="text-emerald-700 text-[11px] font-black">✓ Trust Lens verified</Text>
            </View>
          ) : null}
        </View>
        {images.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 8 }}>
            {images.map((uri, i) => (
              <TouchableOpacity
                key={uri}
                onPress={() => setActiveImage(i)}
                accessibilityRole="button"
                accessibilityLabel={`Show photo ${i + 1}`}
                accessibilityState={{ selected: i === activeImage }}
                className={`w-16 h-16 rounded-xl overflow-hidden border-2 ${i === activeImage ? 'border-emerald-600' : 'border-borderc'}`}
              >
                <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {/* Title & price */}
        <View className="bg-white rounded-2xl border border-borderc p-4 mb-3">
          <View className="flex-row flex-wrap items-center gap-2 mb-2">
            {grade ? (
              <View className="bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <Text className="text-[11px] font-black text-emerald-800">{grade}</Text>
              </View>
            ) : null}
            {specs ? (
              <View className="bg-[#F5F5F0] px-2.5 py-0.5 rounded-full border border-borderc">
                <Text className="text-[11px] font-bold text-text-muted">{specs}</Text>
              </View>
            ) : null}
          </View>
          <Text className="text-2xl font-black text-text mb-2 tracking-tight">{listing.title}</Text>

          {isAuction ? (
            <>
              <Text className="text-3xl font-black text-text">
                {formatPrice(Number(listing.currentBid ?? listing.startingBid ?? askingPrice), currency)}
              </Text>
              <Text className="text-xs text-text-muted mt-1">
                {countdown.formattedText} · {wonAuction && listing.auctionEndsAt ? `You won · Pay by ${auctionPaymentDeadline(listing.auctionEndsAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · ` : isHighestBidder ? 'You’re the highest bidder · ' : ''}{listing.bidCount ? `${listing.bidCount} bid${listing.bidCount === 1 ? '' : 's'}` : 'Starting bid'} · Buyer Protection and shipping added at checkout.
              </Text>
            </>
          ) : (
            <>
              <Text className="text-3xl font-black text-text">{formatPrice(buyerPrice, currency)}</Text>
              <Text className="text-xs text-text-muted mt-1">
                Includes {formatPrice(protectionFee, currency)} Buyer Protection ({feePercent}%).
                {listing.freeShipping ? ' Free UK delivery.' : ' Royal Mail shipping calculated at checkout.'}
              </Text>
            </>
          )}
        </View>

        {/* Trust Lens */}
        <View className="bg-white rounded-2xl border border-borderc p-4 mb-3">
          <Text className="text-sm font-black text-text mb-2">Trust Lens™ checks</Text>
          {checks ? (
            <View className="gap-2">
              <CheckRow label="IMEI valid" ok={checks.imeiValid} />
              <CheckRow label="Not reported stolen" ok={checks.reportedStolen === null ? null : !checks.reportedStolen} />
              <CheckRow label="Not blacklisted" ok={checks.blacklisted === null ? null : !checks.blacklisted} />
              <CheckRow label="Find My / activation lock off" ok={checks.fmiOn === null ? null : !checks.fmiOn} />
              {(checks.deviceAttributes ?? []).slice(0, 6).map((a) => (
                <View key={a.label} className="flex-row justify-between">
                  <Text className="text-xs text-text-muted">{a.label}</Text>
                  <Text className="text-xs font-bold text-text flex-shrink ml-2 text-right">{a.value}</Text>
                </View>
              ))}
              <Text className="text-[11px] text-text-muted mt-1">
                Checked {new Date(checks.verifiedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          ) : (
            <Text className="text-xs text-text-muted leading-relaxed">
              {verified
                ? 'Our Trust & Safety team reviewed this listing’s photos and details before it went live.'
                : 'This listing is waiting for Trust Lens verification.'}
            </Text>
          )}
        </View>

        {/* Description */}
        {listing.description ? (
          <View className="bg-white rounded-2xl border border-borderc p-4 mb-3">
            <Text className="text-sm font-black text-text mb-2">About this device</Text>
            <Text className="text-xs text-text-muted leading-relaxed">{listing.description}</Text>
          </View>
        ) : null}

        {/* Buyer protection */}
        <View className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 mb-3">
          <Text className="text-sm font-black text-emerald-900 mb-1">Buyer Protection</Text>
          <Text className="text-xs text-emerald-800 leading-relaxed">
            Your payment is held until you confirm the device arrived as described. If it doesn’t match the listing,
            report a problem from your order before you release payment.
          </Text>
        </View>

        {/* Seller */}
        <View className="bg-white rounded-2xl border border-borderc p-4 mb-3 flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-sm font-black text-text">{sellerName}</Text>
            <Text className="text-[11px] text-text-muted">
              {[listing.seller?.joinedYear ? `Member since ${listing.seller.joinedYear}` : null, sellerPlace]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          {sellerRating ? (
            <View className="bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              <Text className="text-xs font-black text-amber-900">{Number(sellerRating).toFixed(1)}</Text>
            </View>
          ) : null}
          {!isOwn ? (
            <TouchableOpacity onPress={onMessage} accessibilityRole="button" className="ml-2 px-3 py-2 rounded-xl border border-borderc">
              <Text className="text-xs font-bold text-text">Message</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      {/* Actions */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-borderc p-3.5 flex-row items-center gap-3"
        style={[{ paddingBottom: 14 + insets.bottom }, Platform.OS === 'web' ? { position: 'fixed' as any } : null]}
      >
        {isOwn ? (
          listing.status === 'SOLD' ? (
            <Text className="flex-1 text-center text-xs font-bold text-text-muted">You sold this listing.</Text>
          ) : (
            <TouchableOpacity
              onPress={() => router.push(`/listing/edit/${listing.id}`)}
              accessibilityRole="button"
              className="flex-1 bg-[#232F3E] rounded-xl py-3.5 items-center"
            >
              <Text className="text-white font-black text-sm">Edit listing</Text>
            </TouchableOpacity>
          )
        ) : wonAuction ? (
          <TouchableOpacity
            onPress={onBuyNow}
            accessibilityRole="button"
            className="flex-1 bg-[#2D7A4F] rounded-xl py-3.5 items-center"
          >
            <Text className="text-white font-black text-sm">You won · Complete purchase</Text>
          </TouchableOpacity>
        ) : !isActive && hasPendingCheckout ? (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/checkout', params: { listingId: listing.id } })}
            accessibilityRole="button"
            className="flex-1 bg-[#2D7A4F] rounded-xl py-3.5 items-center"
          >
            <Text className="text-white font-black text-sm">Continue your checkout</Text>
          </TouchableOpacity>
        ) : !isActive ? (
          <Text className="flex-1 text-center text-xs font-bold text-text-muted">This item is no longer available.</Text>
        ) : isAuction ? (
          countdown.isEnded ? (
            <Text className="flex-1 text-center text-xs font-bold text-text-muted">This auction has ended.</Text>
          ) : (
            <>
              {Number(listing.buyItNowPrice) > Number(listing.currentBid ?? 0) ? (
                <TouchableOpacity
                  onPress={onBuyNow}
                  accessibilityRole="button"
                  className="flex-1 bg-[#F5F5F0] border border-borderc rounded-xl py-3.5 items-center"
                >
                  <Text className="text-text font-black text-xs">
                    Buy now · {formatPrice(buyerFacingPrice(Number(listing.buyItNowPrice)), currency)}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={openBidModal}
                accessibilityRole="button"
                className="flex-1 bg-[#2D7A4F] rounded-xl py-3.5 items-center"
              >
                <Text className="text-white font-black text-sm">Place a bid</Text>
              </TouchableOpacity>
            </>
          )
        ) : (
          <>
            <TouchableOpacity
              onPress={openOfferModal}
              accessibilityRole="button"
              className="flex-1 bg-[#F5F5F0] border border-borderc py-3.5 rounded-xl items-center"
            >
              <Text className="text-text font-black text-xs">Make offer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onBuyNow}
              accessibilityRole="button"
              className="flex-[2] bg-[#2D7A4F] py-3.5 px-6 rounded-xl items-center"
            >
              <Text className="text-white font-black text-xs">Buy now · {formatPrice(buyerPrice, currency)}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Photo lightbox */}
      <Modal visible={lightboxUri !== null} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <View className="flex-1 bg-black/95 justify-center items-center p-4">
          <TouchableOpacity
            onPress={() => setLightboxUri(null)}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            className="absolute top-12 right-6 z-20 bg-white/20 px-3 py-1.5 rounded-full"
          >
            <Text className="text-white font-bold text-base">✕ Close</Text>
          </TouchableOpacity>
          {lightboxUri ? <Image source={{ uri: lightboxUri }} className="w-full h-4/5" resizeMode="contain" /> : null}
        </View>
      </Modal>

      {/* Place a bid */}
      <Modal visible={bidModalVisible} transparent animationType="slide" onRequestClose={() => setBidModalVisible(false)}>
        <KeyboardAvoidingView behavior="padding" className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-6 pb-10">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-text">Place a bid</Text>
              <TouchableOpacity onPress={() => setBidModalVisible(false)} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
                <Ionicons name="close" size={24} color="#565959" />
              </TouchableOpacity>
            </View>
            <Text className="text-sm text-text-muted mb-1">
              Current bid {formatPrice(Number(listing.currentBid ?? listing.startingBid ?? 0), currency)} · {countdown.formattedText}
            </Text>
            <Text className="text-[13px] text-text-muted mb-4 leading-[18px]">
              Enter the most you’d pay. We bid for you, only as much as needed. Bids are binding, and Buyer Protection and postage are added if you win.
            </Text>
            <Input
              label={`Your maximum bid (at least ${formatPrice(minimumBid, currency)})`}
              value={maxBid}
              onChangeText={(text) => {
                setMaxBid(text);
                setBidError('');
                setBidResult('');
              }}
              keyboardType="decimal-pad"
              error={bidError || undefined}
            />
            {bidResult ? <Text accessibilityLiveRegion="polite" className="text-sm text-emerald-800 mb-3 leading-5">{bidResult}</Text> : null}
            <Button onPress={submitBid} loading={bidSubmitting}>
              Confirm bid
            </Button>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Make an offer */}
      <Modal visible={offerModalVisible} transparent animationType="slide" onRequestClose={() => setOfferModalVisible(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-black text-text">Make an offer</Text>
              <TouchableOpacity onPress={() => setOfferModalVisible(false)} accessibilityRole="button" accessibilityLabel="Close">
                <Text className="text-text-muted font-bold text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            {offerSuccess ? (
              <View className="py-6 items-center">
                <Text className="text-lg font-black text-emerald-800">Offer sent</Text>
                <Text className="text-xs text-text-muted text-center mt-1 mb-4">
                  The seller can accept or decline. If they accept, you’ll have 48 hours to pay at your offer price.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setOfferModalVisible(false);
                    router.push('/offers');
                  }}
                  accessibilityRole="button"
                  className="bg-[#232F3E] px-6 py-3 rounded-xl"
                >
                  <Text className="text-white font-black text-xs">See your offers</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text className="text-xs text-text-muted mb-3">
                  Asking price {formatPrice(askingPrice, currency)}. Offers are binding — Buyer Protection and shipping are added at checkout.
                </Text>
                <Input label="Your offer (£)" value={offerPrice} onChangeText={setOfferPrice} keyboardType="decimal-pad" />
                <Text className="text-xs font-bold text-text mb-1">Note to the seller (optional)</Text>
                <TextInput
                  value={offerNote}
                  onChangeText={setOfferNote}
                  maxLength={500}
                  accessibilityLabel="Note to the seller"
                  className="bg-[#F5F5F0] border border-borderc rounded-xl p-3 text-text text-xs mb-4"
                />
                {offerError ? <Text className="text-rose-600 text-xs mb-3 font-medium">{offerError}</Text> : null}
                <TouchableOpacity
                  onPress={submitOffer}
                  disabled={offerSubmitting}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: offerSubmitting, busy: offerSubmitting }}
                  className="bg-[#232F3E] py-3.5 rounded-xl items-center"
                >
                  <Text className="text-white font-black text-xs">{offerSubmitting ? 'Sending…' : 'Send offer'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function CheckRow({ label, ok }: { label: string; ok: boolean | null }) {
  const text = ok === null ? 'Not checked' : ok ? 'Pass' : 'Flagged';
  const style = ok === null ? 'text-text-muted' : ok ? 'text-emerald-700' : 'text-rose-600';
  return (
    <View className="flex-row justify-between">
      <Text className="text-xs text-text">{label}</Text>
      <Text className={`text-xs font-black ${style}`}>{text}</Text>
    </View>
  );
}
