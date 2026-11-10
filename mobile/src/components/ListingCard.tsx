import { Link } from 'expo-router';
import { Image, ImageSourcePropType, Platform, Pressable, Text, View } from 'react-native';

import { formatPrice } from '../lib/currency';
import { buyerFacingPrice } from '../lib/fees';
import { Listing } from '../types/entities';

const GRADE_STYLE: Record<string, { label: string; className: string }> = {
  A: { label: 'Grade A · Pristine', className: 'bg-emerald-50 border-emerald-200' },
  B: { label: 'Grade B · Good', className: 'bg-blue-50 border-blue-200' },
  C: { label: 'Grade C · Fair', className: 'bg-amber-50 border-amber-200' },
};

/**
 * Listing summary for feeds. Shows only data the listing actually has — the
 * same fields as the web card — and the buyer price including Buyer Protection.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  const image = listing.imageUrl || listing.images?.[0];
  const isAuction = listing.format === 'AUCTION';
  const verified = listing.trustLensStatus === 'PASSED';
  const grade = listing.conditionGrade ? GRADE_STYLE[listing.conditionGrade] : null;
  const displayPrice = isAuction
    ? Number(listing.currentBid ?? listing.startingBid ?? listing.price)
    : buyerFacingPrice(Number(listing.price));
  const specs = [listing.brand, listing.model, listing.storageCapacity, listing.color].filter(Boolean).join(' · ');
  const place = listing.seller?.city;

  return (
    <Link href={`/listing/${listing.id}`} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${listing.title}, ${formatPrice(displayPrice, listing.currency)}`}
        className="bg-surface rounded-2xl border border-borderc mb-4 overflow-hidden active:opacity-95"
        style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined}
      >
        <View className="w-full h-48 bg-surface-canvas items-center justify-center">
          {image ? (
            <Image source={{ uri: image }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <Text className="text-text-muted text-xs font-semibold">No photo yet</Text>
          )}
          {verified ? (
            <View className="absolute top-2.5 left-2.5 bg-white/95 px-2.5 py-1 rounded-full border border-emerald-300">
              <Text className="text-[11px] text-emerald-700 font-bold">✓ Verified</Text>
            </View>
          ) : null}
          {isAuction ? (
            <View className="absolute top-2.5 right-2.5 bg-amber-600 px-2.5 py-1 rounded-full">
              <Text className="text-[11px] font-black text-white">Auction</Text>
            </View>
          ) : null}
        </View>

        <View className="p-3.5">
          <Text className="text-text font-semibold text-base leading-[22px] mb-1" numberOfLines={2}>
            {listing.title}
          </Text>
          {specs ? (
            <Text className="text-text-muted text-xs mb-2" numberOfLines={1}>
              {specs}
            </Text>
          ) : null}
          {grade ? (
            <View className={`self-start px-2 py-0.5 rounded-full border mb-2 ${grade.className}`}>
              <Text className="text-[11px] font-extrabold text-text">{grade.label}</Text>
            </View>
          ) : null}

          <View className="flex-row items-end justify-between pt-2 border-t border-borderc">
            <View>
              <Text className="text-text font-bold text-xl">{formatPrice(displayPrice, listing.currency)}</Text>
              {isAuction ? (
                <Text className="text-[11px] text-text-muted">
                  {`${listing.bidCount ? `${listing.bidCount} bids` : 'Starting bid'} · + Buyer Protection`}
                </Text>
              ) : null}
            </View>
            <View className="items-end">
              <Text className="text-[11px] font-bold text-emerald-700">
                {listing.freeShipping ? 'Free delivery' : 'Royal Mail tracked'}
              </Text>
              {place ? <Text className="text-[11px] text-text-muted">{place}</Text> : null}
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

export interface ExampleListing {
  id: string;
  title: string;
  image: ImageSourcePropType;
  specs: string;
  grade: 'A' | 'B' | 'C';
  deviceType: string;
  price: number;
}

/**
 * Example cards shown while the marketplace has few live listings, matching the
 * web homepage. Labelled "Example" and open the matching category, never a
 * checkout, so they can't be mistaken for stock.
 */
export const EXAMPLE_LISTINGS: ExampleListing[] = [
  {
    id: 'example-iphone',
    title: 'iPhone 14 Pro Max 256GB - Space Black',
    image: require('../../assets/images/examples/iphone-14-pro.jpg'),
    specs: 'Apple · iPhone 14 Pro Max',
    grade: 'A',
    deviceType: 'SMARTPHONE',
    price: 799,
  },
  {
    id: 'example-galaxy',
    title: 'Samsung Galaxy S23 Ultra 512GB - Phantom Black',
    image: require('../../assets/images/examples/samsung-galaxy-s23.jpg'),
    specs: 'Samsung · Galaxy S23 Ultra',
    grade: 'A',
    deviceType: 'SMARTPHONE',
    price: 699,
  },
  {
    id: 'example-macbook',
    title: 'MacBook Pro 14" M2 Pro 16GB / 512GB',
    image: require('../../assets/images/examples/macbook-pro.jpg'),
    specs: 'Apple · MacBook Pro 14"',
    grade: 'A',
    deviceType: 'LAPTOP',
    price: 1399,
  },
  {
    id: 'example-ipad',
    title: 'iPad Air 5th Gen 256GB Wi-Fi - Starlight',
    image: require('../../assets/images/examples/ipad-air.jpg'),
    specs: 'Apple · iPad Air',
    grade: 'B',
    deviceType: 'TABLET',
    price: 489,
  },
];

export function ExampleListingCard({
  example,
  onPress,
}: {
  example: ExampleListing;
  onPress: () => void;
}) {
  const grade = GRADE_STYLE[example.grade];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Example: ${example.title}. Browse similar devices.`}
      className="bg-surface rounded-2xl border border-borderc mb-4 overflow-hidden active:opacity-95"
    >
      <View className="w-full h-48 bg-surface-canvas items-center justify-center">
        <Image source={example.image} className="w-full h-full" resizeMode="cover" />
        <View className="absolute top-2.5 left-2.5 bg-primary/90 px-2.5 py-1 rounded-full">
          <Text className="text-[11px] text-white font-bold">Example</Text>
        </View>
      </View>

      <View className="p-3.5">
        <Text className="text-text font-semibold text-base leading-[22px] mb-1" numberOfLines={2}>
          {example.title}
        </Text>
        <Text className="text-text-muted text-xs mb-2" numberOfLines={1}>
          {example.specs}
        </Text>
        <View className={`self-start px-2 py-0.5 rounded-full border mb-2 ${grade.className}`}>
          <Text className="text-[11px] font-extrabold text-text">{grade.label}</Text>
        </View>

        <View className="flex-row items-end justify-between pt-2 border-t border-borderc">
          <View>
            <Text className="text-text font-bold text-xl">{formatPrice(buyerFacingPrice(example.price), 'GBP')}</Text>
            <Text className="text-[11px] text-text-muted">Example price</Text>
          </View>
          <Text className="text-[11px] font-bold text-emerald-700">Browse similar</Text>
        </View>
      </View>
    </Pressable>
  );
}
