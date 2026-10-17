import { Link, router } from 'expo-router';
import { Image, Platform, Pressable, Text, TouchableOpacity, View } from 'react-native';

import { formatPrice } from '../lib/currency';
import { Listing } from '../types/entities';

export function ListingCard({ listing }: { listing: Listing }) {
  const price = formatPrice(listing.price, listing.currency);
  const origPrice = listing.originalPrice
    ? formatPrice(listing.originalPrice, listing.currency)
    : null;
  const image = listing.images?.[0];

  const discountPercent =
    listing.originalPrice && listing.originalPrice > listing.price
      ? Math.round(((listing.originalPrice - listing.price) / listing.originalPrice) * 100)
      : null;

  const isGradeA = listing.conditionGrade === 'A' || listing.condition === 'EXCELLENT';
  const isGradeB = listing.conditionGrade === 'B' || listing.condition === 'GOOD';

  const gradeBadgeClass = isGradeA
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : isGradeB
    ? 'bg-blue-50 text-blue-800 border-blue-200'
    : 'bg-amber-50 text-amber-800 border-amber-200';

  const gradeLabel = isGradeA
    ? 'Grade A Pristine'
    : isGradeB
    ? 'Grade B Excellent'
    : 'Grade C Good';

  const battery = listing.batteryHealth || (isGradeA ? 94 : isGradeB ? 88 : 84);

  return (
    <Link href={`/listing/${listing.id}`} asChild>
      <Pressable
        className="bg-surface rounded-2xl border border-borderc mb-4 overflow-hidden shadow-sm active:opacity-95"
        style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined}
      >
        {/* Product Image Frame with Overlays */}
        <View className="relative w-full h-48 bg-surface-canvas overflow-hidden items-center justify-center">
          {image ? (
            <Image
              source={{ uri: image }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full items-center justify-center bg-surface-alt">
              <Text className="text-text-muted text-xs font-semibold">📷 Verified Device</Text>
            </View>
          )}

          {/* Floating Top-Left Trust Lens Badge */}
          <View className="absolute top-2.5 left-2.5 bg-white/95 px-2.5 py-1 rounded-full border border-emerald-300 shadow-sm flex-row items-center gap-1">
            <Text className="text-[10px] text-emerald-700 font-bold">🛡️ Trust Lens™ Checked</Text>
          </View>

          {/* Floating Top-Right Discount Badge */}
          {discountPercent ? (
            <View className="absolute top-2.5 right-2.5 bg-[#E11D48] px-2.5 py-1 rounded-full shadow-sm">
              <Text className="text-[10px] font-black text-white">Save {discountPercent}%</Text>
            </View>
          ) : null}

          {/* Floating Bottom-Right Shipping Tag */}
          <View className="absolute bottom-2.5 right-2.5 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-md border border-borderc shadow-xs">
            <Text className="text-[9px] font-bold text-text-muted">
              {listing.freeShipping ? '🚚 Free Dispatch' : '📦 Royal Mail Tracked'}
            </Text>
          </View>
        </View>

        {/* Content Container */}
        <View className="p-3.5">
          {/* Title & Condition Grade Badge */}
          <View className="flex-row items-start justify-between gap-2 mb-1">
            <Text className="text-text font-black text-base flex-1" numberOfLines={1}>
              {listing.title}
            </Text>
            <View className={`px-2 py-0.5 rounded-full border ${gradeBadgeClass}`}>
              <Text className="text-[10px] font-extrabold">{gradeLabel}</Text>
            </View>
          </View>

          {/* Meta specs */}
          <Text className="text-text-muted text-xs mb-2.5 font-medium">
            {listing.brand} · {listing.model}
            {listing.storageCapacity ? ` · ${listing.storageCapacity}` : ''}
            {listing.color ? ` · ${listing.color}` : ''}
          </Text>

          {/* Battery Health Status Bar */}
          <View className="bg-surface-alt border border-borderc rounded-xl p-2 mb-2.5">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-[11px] font-bold text-text flex-row items-center">
                🔋 Battery Health Status
              </Text>
              <Text className="text-[11px] font-black text-emerald-700">{battery}%</Text>
            </View>
            <View className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <View
                className="h-full bg-emerald-600 rounded-full"
                style={{ width: `${Math.min(100, battery)}%` }}
              />
            </View>
          </View>

          {/* Hardware Checks Pill Row */}
          <View className="flex-row items-center flex-wrap gap-1.5 mb-3">
            <View className="flex-row items-center bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <Text className="text-[10px] font-bold text-emerald-800">✓ OLED Screen OEM</Text>
            </View>
            <View className="flex-row items-center bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <Text className="text-[10px] font-bold text-emerald-800">✓ Face ID Active</Text>
            </View>
            <View className="flex-row items-center bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              <Text className="text-[10px] font-bold text-slate-700">✓ 0 Scratches</Text>
            </View>
          </View>

          {/* Bottom Pricing & Escrow Action */}
          <View className="flex-row items-center justify-between pt-2 border-t border-borderc">
            <View>
              {origPrice ? (
                <Text className="text-text-muted text-[10px] line-through font-medium">
                  Retail {origPrice}
                </Text>
              ) : null}
              <View className="flex-row items-baseline gap-1">
                <Text className="text-text font-black text-xl">{price}</Text>
                <Text className="text-emerald-700 font-bold text-[10px]">No Buyer Fee</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                router.push(`/checkout?listingId=${listing.id}`);
              }}
              className="bg-[#0B192C] px-3.5 py-2 rounded-xl flex-row items-center gap-1.5 shadow-sm active:opacity-90"
            >
              <Text className="text-white text-xs">🔒</Text>
              <Text className="text-white font-black text-xs">Escrow Buy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
