import { Link } from 'expo-router';
import { Image, Text, View } from 'react-native';

import { Listing } from '../types/entities';
import { StatusPill } from './ui';
import { formatPrice } from '../lib/currency';

export function ListingCard({ listing }: { listing: Listing }) {
  const price = formatPrice(listing.price, listing.currency);
  const image = listing.images?.[0];

  return (
    <Link href={`/listing/${listing.id}`} asChild>
      <View className="bg-surface rounded-xl border border-borderc mb-3 overflow-hidden">
        {image ? (
          <Image
            source={{ uri: image }}
            className="w-full h-40 bg-warm-beige"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-40 bg-warm-beige items-center justify-center">
            <Text className="text-warm-tan">No photo</Text>
          </View>
        )}
        <View className="p-3">
          <Text className="text-text font-semibold" numberOfLines={1}>
            {listing.title}
          </Text>
          <Text className="text-text-muted text-sm" numberOfLines={1}>
            {listing.brand} · {listing.model}
          </Text>
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-accent-dark font-bold text-base">{price}</Text>
            <StatusPill status={listing.status} />
          </View>
          <View className="flex-row items-center justify-between mt-1 pt-1 border-t border-borderc/40">
            {listing.trustLensStatus ? (
              <Text className="text-emerald-700 font-medium text-[11px]">
                🛡️ Trust Lens: {listing.trustLensStatus}
              </Text>
            ) : (
              <Text className="text-text-muted text-[11px]">48hr Inspection Guarantee</Text>
            )}
            <Text className="text-text-muted text-[10px]">Escrow Secured</Text>
          </View>
        </View>
      </View>
    </Link>
  );
}

