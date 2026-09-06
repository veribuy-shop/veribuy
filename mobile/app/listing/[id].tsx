import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Button, Card, Screen, StatusPill } from '@/src/components/ui';
import { evidenceService, listingsService, messagesService, ordersService, trustService } from '@/src/services';
import { useAuth } from '@/src/context/AuthContext';
import { formatPrice } from '@/src/lib/currency';
import { EvidenceItem, Listing, TrustLensReport, User } from '@/src/types/entities';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [report, setReport] = useState<TrustLensReport | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');

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
        setError('Could not load listing.');
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
    if (!listing || !profileUser) return;
    const numOffer = parseFloat(offerPrice);
    if (!numOffer || numOffer <= 0) {
      setOfferError('Please enter a valid offer amount');
      return;
    }
    if (numOffer >= listing.price) {
      setOfferError('Offer must be lower than the asking price.');
      return;
    }

    setOfferSubmitting(true);
    setOfferError('');
    try {
      const subject = `🏷️ Offer: ${formatPrice(numOffer, listing.currency)} for ${listing.title}`;
      const content = `Hi! I would like to offer ${formatPrice(numOffer, listing.currency)} for your listing "${listing.title}".${
        offerNote.trim() ? `\n\nBuyer note: ${offerNote.trim()}` : ''
      }\n\nReady to complete payment via VeriBuy Escrow once accepted.`;

      await messagesService.send({
        recipientId: listing.sellerId,
        listingId: listing.id,
        subject,
        content,
      });

      setOfferSuccess(true);
      setTimeout(() => {
        setOfferModalVisible(false);
        setOfferSuccess(false);
      }, 2000);
    } catch (e: any) {
      setOfferError(e?.message || 'Failed to submit offer.');
    } finally {
      setOfferSubmitting(false);
    }
  };

  const onBuyNow = async () => {
    if (!listing || !profileUser || listing.sellerId === profileUser.id) return;
    setBuying(true);
    setError('');
    try {
      const result = await ordersService.create({
        buyerId: profileUser.id,
        sellerId: listing.sellerId,
        listingId: listing.id,
        amount: listing.price,
        shippingAddress: {
          name: profileUser.name,
          line1: '',
          city: '',
          state: '',
          postal_code: '',
          country: '',
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
    } catch (e: any) {
      setError(e?.message || 'Could not start checkout.');
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color="#232F3E" style={{ marginTop: 60 }} />
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
  const isOwn = profileUser?.id === listing.sellerId;
  const sellerJoinYear = listing.seller?.joinedYear || (listing.createdAt ? new Date(listing.createdAt).getFullYear() : new Date().getFullYear());
  const sellerLocation = listing.seller?.location || listing.seller?.city || 'United Kingdom';
  const sellerName = listing.seller?.displayName || listing.seller?.name || 'Verified Seller';

  const primaryImage = listing.images?.[0] || evidence[0]?.url;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {primaryImage ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              setSelectedImageUri(primaryImage);
              setLightboxVisible(true);
            }}
          >
            <Image
              source={{ uri: primaryImage }}
              className="w-full h-64 rounded-xl mb-3 bg-warm-beige"
              resizeMode="cover"
            />
            <View className="absolute bottom-5 right-3 bg-black/70 px-2.5 py-1 rounded-full">
              <Text className="text-white text-xs font-semibold">🔍 Tap to enlarge</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View className="w-full h-56 rounded-xl mb-3 bg-warm-beige items-center justify-center">
            <Text className="text-warm-tan">No photo</Text>
          </View>
        )}

        <Card>
          <View className="flex-row items-center justify-between">
            <StatusPill status={listing.status} />
            {listing.trustLensStatus ? (
              <Text className="text-trust text-xs font-semibold">Trust Lens: {listing.trustLensStatus}</Text>
            ) : null}
          </View>
          <Text className="text-2xl font-bold text-text mt-2">{listing.title}</Text>
          <Text className="text-accent-dark text-xl font-bold mt-1">{price}</Text>
          <Text className="text-text-muted text-sm mt-1">
            {listing.brand} · {listing.model} · {listing.condition}
          </Text>
          <Text className="text-text mt-3">{listing.description}</Text>
        </Card>

        {/* Seller Trust & Origin Card */}
        <Card>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-bold text-text-muted uppercase tracking-wider">Seller Information</Text>
              <Text className="text-base font-bold text-text mt-0.5">👤 {sellerName}</Text>
              <Text className="text-xs text-text-muted mt-0.5">📅 Member since {sellerJoinYear}</Text>
            </View>
            <View className="bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg">
              <Text className="text-emerald-800 text-xs font-bold">📍 Ships from</Text>
              <Text className="text-emerald-900 text-xs font-semibold">{sellerLocation}</Text>
            </View>
          </View>
        </Card>

        {/* VeriBuy Escrow & Inspection Guarantee Banner */}
        <Card>
          <Text className="font-semibold text-text mb-1">🛡️ VeriBuy Buyer Protection</Text>
          <Text className="text-text-muted text-sm leading-relaxed mb-2">
            Your payment is securely held in escrow until delivery. You get a <Text className="font-bold text-text">48-Hour (2 Days)</Text> inspection window to verify the device condition before funds are released.
          </Text>
          <Text className="text-xs text-text-muted">
            🚚 <Text className="font-semibold text-text">Tracked Delivery:</Text> Reliable tracked shipping on all orders.
          </Text>
        </Card>

        {report ? (
          <Card>
            <Text className="font-semibold text-text mb-1">Trust Lens™ Report</Text>
            <Text className="text-text-muted text-sm">{report.summary || `Status: ${report.status}`}</Text>
          </Card>
        ) : (
          <Card>
            <Text className="font-semibold text-text mb-1">Trust Lens™</Text>
            <Text className="text-text-muted text-sm">Under automated verification analysis.</Text>
          </Card>
        )}

        {evidence.length > 0 ? (
          <Card>
            <Text className="font-semibold text-text mb-2">Evidence ({evidence.length})</Text>
            <View className="flex-row flex-wrap">
              {evidence.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedImageUri(item.url);
                    setLightboxVisible(true);
                  }}
                >
                  <Image
                    source={{ uri: item.url }}
                    className="w-20 h-20 rounded-lg mr-2 mb-2"
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        ) : null}

        {isOwn ? (
          <Card>
            <Text className="font-semibold text-text mb-2">Evidence pack</Text>
            <Text className="text-text-muted text-sm mb-3">
              Upload proof images to build the trust lens report for this listing.
            </Text>
            <Button variant="secondary" onPress={onPickEvidence} loading={uploading}>
              Upload evidence image
            </Button>
          </Card>
        ) : null}

        {error ? <Text className="text-danger text-sm mb-2">{error}</Text> : null}

        {!isOwn ? (
          <View className="gap-2.5 mt-2">
            <Button onPress={onBuyNow} loading={buying}>
              Buy with Escrow Protection
            </Button>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={openOfferModal}
                className="flex-1 py-3 items-center rounded-xl bg-emerald-50 border border-emerald-200"
              >
                <Text className="text-emerald-800 font-bold text-sm">🏷️ Make an Offer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onMessage}
                className="flex-1 py-3 items-center rounded-xl bg-warm-beige"
              >
                <Text className="text-accent font-bold text-sm">💬 Message seller</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text className="text-warm-tan text-center mt-2">This is your listing</Text>
        )}
      </ScrollView>

      {/* Image Lightbox Modal */}
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

      {/* Make an Offer Modal */}
      <Modal
        visible={offerModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setOfferModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-text">Make an Offer</Text>
              <TouchableOpacity onPress={() => setOfferModalVisible(false)}>
                <Text className="text-text-muted font-bold text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            {offerSuccess ? (
              <View className="py-8 items-center">
                <Text className="text-4xl mb-2">🎉</Text>
                <Text className="text-lg font-bold text-emerald-800">Offer Sent to Seller!</Text>
                <Text className="text-xs text-text-muted text-center mt-1">
                  The seller will receive a notification and can reply to negotiate or accept.
                </Text>
              </View>
            ) : (
              <>
                <Text className="text-xs text-text-muted mb-3">
                  Asking Price: <Text className="font-bold text-text">{price}</Text>
                </Text>

                {offerError ? (
                  <Text className="text-danger text-xs font-semibold mb-2">{offerError}</Text>
                ) : null}

                <Text className="text-xs font-bold text-text uppercase mb-1">Your Offer (£ GBP)</Text>
                <TextInput
                  value={offerPrice}
                  onChangeText={setOfferPrice}
                  keyboardType="numeric"
                  placeholder="e.g. 450"
                  className="border border-border rounded-xl px-4 py-3 text-lg font-bold text-text mb-3"
                />

                <Text className="text-xs font-bold text-text uppercase mb-1">Note to Seller (Optional)</Text>
                <TextInput
                  value={offerNote}
                  onChangeText={setOfferNote}
                  placeholder="e.g. Can complete payment today!"
                  className="border border-border rounded-xl px-4 py-2.5 text-xs text-text mb-4"
                  maxLength={200}
                />

                <Button onPress={submitOffer} loading={offerSubmitting}>
                  Submit Offer
                </Button>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

