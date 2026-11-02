import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';

import { prepareImage } from '../lib/prepare-image';

const MAX_PHOTOS = 10;

interface PhotoSlotProps {
  label: string;
  hint: string;
  /** Photos still needed; 0 when the slot is optional or already satisfied. */
  minCount: number;
  required: boolean;
  photos: string[];
  onChange: (next: string[]) => void;
  onBusy?: (busy: boolean) => void;
}

/** One group of evidence photos: take them with the camera or pick several at once. */
export function PhotoSlot({ label, hint, minCount, required, photos, onChange, onBusy }: PhotoSlotProps) {
  const remaining = MAX_PHOTOS - photos.length;

  const add = async (assets: ImagePicker.ImagePickerAsset[]) => {
    onBusy?.(true);
    try {
      const prepared = await Promise.all(assets.map((asset) => prepareImage(asset)));
      onChange([...photos, ...prepared].slice(0, MAX_PHOTOS));
    } catch {
      Alert.alert('Photo not added', 'We could not read that photo. Please try another one.');
    } finally {
      onBusy?.(false);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Camera access needed',
        'Allow camera access in Settings to photograph your device, or choose photos from your library.',
      );
      return;
    }
    try {
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 });
      if (!res.canceled && res.assets?.length) await add(res.assets);
    } catch {
      Alert.alert('Camera unavailable', 'We could not open the camera. You can choose photos from your library instead.');
    }
  };

  const pickFromLibrary = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (!res.canceled && res.assets?.length) await add(res.assets);
  };

  const status = required
    ? photos.length >= minCount
      ? 'Done'
      : minCount > 1
        ? `${photos.length} of ${minCount}`
        : 'Required'
    : 'Optional';
  const done = required && photos.length >= minCount;

  return (
    <View className="bg-surface border border-borderc rounded-2xl p-4 mb-3">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-[15px] font-semibold text-text flex-1 mr-2">{label}</Text>
        <View className={`px-2.5 py-0.5 rounded-full ${done ? 'bg-emerald-100' : 'bg-surface-alt'}`}>
          <Text className={`text-xs font-semibold ${done ? 'text-emerald-800' : 'text-text-muted'}`}>{status}</Text>
        </View>
      </View>
      <Text className="text-[13px] text-text-muted leading-[18px] mb-3">{hint}</Text>

      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          {photos.map((uri, index) => (
            <View key={uri} className="mr-2">
              <Image
                source={{ uri }}
                className="w-20 h-20 rounded-xl bg-surface-alt"
                accessibilityLabel={`${label} ${index + 1}`}
              />
              <Pressable
                onPress={() => onChange(photos.filter((photo) => photo !== uri))}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${label.toLowerCase()} ${index + 1}`}
                hitSlop={8}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 items-center justify-center"
              >
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {remaining > 0 ? (
        <View className="flex-row gap-2">
          <Pressable
            onPress={takePhoto}
            accessibilityRole="button"
            accessibilityLabel={`Take ${label.toLowerCase()}`}
            className="flex-1 flex-row gap-1.5 min-h-11 bg-primary rounded-xl items-center justify-center active:opacity-90"
          >
            <Ionicons name="camera-outline" size={17} color="#FFFFFF" />
            <Text className="text-white font-semibold text-[13px]">Take photo</Text>
          </Pressable>
          <Pressable
            onPress={pickFromLibrary}
            accessibilityRole="button"
            accessibilityLabel={`Choose ${label.toLowerCase()} from library`}
            className="flex-1 flex-row gap-1.5 min-h-11 bg-surface border border-border-strong rounded-xl items-center justify-center active:opacity-90"
          >
            <Ionicons name="images-outline" size={17} color="#232F3E" />
            <Text className="text-text font-semibold text-[13px]">From library</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
