import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Button, Card, Screen, StatusPill } from '@/src/components/ui';
import { evidenceService, listingsService, ordersService, trustService } from '@/src/services';
import { useAuth } from '@/src/context/AuthContext';
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

  const price = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: listing.currency || 'USD',
  }).format(listing.price);
  const isOwn = profileUser?.id === listing.sellerId;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {listing.images?.[0] ? (
          <Image
            source={{ uri: listing.images[0] }}
            className="w-full h-56 rounded-xl mb-3 bg-warm-beige"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-56 rounded-xl mb-3 bg-warm-beige items-center justify-center">
            <Text className="text-warm-tan">No photo</Text>
          </View>
        )}

        <Card>
          <View className="flex-row items-center justify-between">
            <StatusPill status={listing.status} />
            {listing.trustLensStatus ? (
              <Text className="text-trust text-xs">Trust Lens: {listing.trustLensStatus}</Text>
            ) : null}
          </View>
          <Text className="text-2xl font-bold text-text mt-2">{listing.title}</Text>
          <Text className="text-accent-dark text-xl font-bold mt-1">{price}</Text>
          <Text className="text-text-muted text-sm mt-1">
            {listing.brand} · {listing.model} · {listing.condition}
          </Text>
          <Text className="text-text mt-3">{listing.description}</Text>
        </Card>

        {report ? (
          <Card>
            <Text className="font-semibold text-text mb-1">Trust Lens Report</Text>
            <Text className="text-text-muted text-sm">{report.summary || report.status}</Text>
          </Card>
        ) : (
          <Card>
            <Text className="font-semibold text-text mb-1">Trust Lens</Text>
            <Text className="text-text-muted text-sm">No trust lens report yet.</Text>
          </Card>
        )}

        {evidence.length > 0 ? (
          <Card>
            <Text className="font-semibold text-text mb-2">Evidence ({evidence.length})</Text>
            <View className="flex-row flex-wrap">
              {evidence.map((item) => (
                <Image
                  key={item.id}
                  source={{ uri: item.url }}
                  className="w-20 h-20 rounded-lg mr-2 mb-2"
                  resizeMode="cover"
                />
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
          <>
            <Button onPress={onBuyNow} loading={buying}>
              Buy now
            </Button>
            <TouchableOpacity onPress={onMessage} className="mt-3 py-3 items-center rounded-xl bg-warm-beige">
              <Text className="text-accent font-semibold">Message seller</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text className="text-warm-tan text-center">This is your listing</Text>
        )}
      </ScrollView>
    </Screen>
  );
}
