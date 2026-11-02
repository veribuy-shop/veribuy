import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, Input, LoadingState, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { prepareImage } from '@/src/lib/prepare-image';
import { evidenceService, listingsService } from '@/src/services';
import { EvidenceItem, Listing } from '@/src/types/entities';

const CONDITION_GRADES = [
  { value: 'A', label: 'A', hint: 'Like new with minimal signs of use.' },
  { value: 'B', label: 'B', hint: 'Normal wear with minor scratches or marks.' },
  { value: 'C', label: 'C', hint: 'Visible wear, scratches or dents. Fully working.' },
];
const MAX_PHOTOS = 10;

/** Trust Lens reviewed these, so changing them sends a verified listing back to review. */
const MATERIAL_FIELDS = ['title', 'description', 'conditionGrade', 'color', 'storageCapacity'] as const;

interface FormFields {
  title: string;
  description: string;
  price: string;
  conditionGrade: string;
  color: string;
  storageCapacity: string;
}

function fieldsFrom(listing: Listing): FormFields {
  return {
    title: listing.title ?? '',
    description: listing.description ?? '',
    price: listing.price != null ? String(listing.price) : '',
    conditionGrade: listing.conditionGrade ?? 'B',
    color: listing.color ?? '',
    storageCapacity: listing.storageCapacity ?? '',
  };
}

export default function EditListingScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [fields, setFields] = useState<FormFields | null>(null);
  const [photos, setPhotos] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [found, evidence] = await Promise.all([
        listingsService.get(id),
        // A listing with no photos yet has no evidence pack, and can still be edited.
        evidenceService.forListing(id).catch(() => [] as EvidenceItem[]),
      ]);
      setListing(found);
      setFields(fieldsFrom(found));
      setPhotos(evidence);
    } catch (e: any) {
      setLoadError(e?.message || 'We could not load this listing.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState />;

  if (!listing || !fields || listing.sellerId !== user?.id) {
    return (
      <Screen>
        <EmptyState
          title={loadError ? 'Listing unavailable' : 'You can’t edit this listing'}
          subtitle={loadError || 'Only the seller can make changes.'}
        />
      </Screen>
    );
  }

  if (listing.status === 'SOLD') {
    return (
      <Screen>
        <EmptyState title="This listing has sold" subtitle="Sold listings can’t be changed." />
      </Screen>
    );
  }

  const update = (key: keyof FormFields, value: string) => {
    setFields((current) => (current ? { ...current, [key]: value } : current));
    setError('');
  };

  const original = fieldsFrom(listing);
  const materialChange = MATERIAL_FIELDS.some((key) => fields[key].trim() !== original[key].trim());
  const priceChanged = Number(fields.price) !== Number(original.price);
  const willReturnToReview = materialChange && listing.trustLensStatus === 'PASSED';
  // A bidder committed to the auction as it stood, so its price is settled once bidding starts.
  const priceLocked = listing.format === 'AUCTION' && Number(listing.bidCount ?? 0) > 0;
  const canToggleSale = listing.status === 'ACTIVE' || listing.status === 'INACTIVE';

  const validate = (): string | null => {
    const title = fields.title.trim();
    const description = fields.description.trim();
    const price = Number(fields.price);
    if (title.length < 5) return 'The title needs at least 5 characters.';
    if (title.length > 100) return 'The title can be up to 100 characters.';
    if (description.length < 20) return 'The description needs at least 20 characters.';
    if (description.length > 2000) return 'The description can be up to 2,000 characters.';
    if (!fields.price.trim() || !Number.isFinite(price) || price <= 0) return 'Enter a price above £0.';
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Send only what changed: the server compares these to decide on a re-review.
      const changes: Record<string, unknown> = {};
      for (const key of MATERIAL_FIELDS) {
        if (fields[key].trim() !== original[key].trim()) changes[key] = fields[key].trim();
      }
      if (priceChanged && !priceLocked) changes.price = Math.round(Number(fields.price) * 100) / 100;
      if (Object.keys(changes).length > 0) {
        await listingsService.update(listing.id, changes);
      }
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Your changes were not saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onSave = () => {
    if (!willReturnToReview) {
      save();
      return;
    }
    Alert.alert(
      'This goes back to review',
      'You’ve changed details Trust Lens verified, so your listing leaves the marketplace until it’s reviewed again. Price changes alone don’t do this.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Save and send for review', onPress: save },
      ],
    );
  };

  const toggleSale = async () => {
    const next = listing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setSaving(true);
    setError('');
    try {
      await listingsService.update(listing.id, { status: next });
      setListing({ ...listing, status: next });
    } catch (e: any) {
      setError(e?.message || 'We could not change this listing. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const uploadAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setPhotoBusy(true);
    try {
      const added: EvidenceItem[] = [];
      for (const asset of assets.slice(0, MAX_PHOTOS - photos.length)) {
        const uri = await prepareImage(asset);
        added.push(
          await evidenceService.upload(
            listing.id,
            { uri, name: 'evidence.jpg', type: 'image/jpeg' },
            { type: 'DEVICE_IMAGE' },
          ),
        );
      }
      setPhotos((current) => [...current, ...added]);
      if (added.length > 0) refreshListing();
    } catch (e: any) {
      Alert.alert('Photo not added', e?.message || 'Please try another photo.');
      // Some of a batch may have landed before the failure.
      evidenceService.forListing(listing.id).then(setPhotos).catch(() => {});
    } finally {
      setPhotoBusy(false);
    }
  };

  /** Trust Lens reviewed the photos, so changing them on a verified listing means another review. */
  const confirmPhotoChange = (change: () => void) => {
    if (listing.trustLensStatus !== 'PASSED') {
      change();
      return;
    }
    Alert.alert(
      'This goes back to review',
      'Changing the photos of a verified listing takes it off sale until it’s reviewed again.',
      [
        { text: 'Keep it as it is', style: 'cancel' },
        { text: 'Continue', onPress: change },
      ],
    );
  };

  const refreshListing = () => {
    listingsService.get(listing.id).then(setListing).catch(() => {});
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to take photos of your device.');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 1 });
      if (!result.canceled) await uploadAssets(result.assets);
    } catch {
      Alert.alert('Camera unavailable', 'This device can’t use the camera. Choose from your photos instead.');
    }
  };

  const choosePhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 1,
    });
    if (!result.canceled) await uploadAssets(result.assets);
  };

  const removePhoto = (item: EvidenceItem) => {
    if (photos.length <= 1) {
      Alert.alert('Keep at least one photo', 'Add another photo before removing this one.');
      return;
    }
    const message =
      listing.trustLensStatus === 'PASSED'
        ? 'Buyers will no longer see it, and your listing goes off sale until it’s reviewed again.'
        : 'Buyers will no longer see it.';
    Alert.alert('Remove this photo?', message, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setPhotoBusy(true);
          try {
            await evidenceService.remove(item.id);
            setPhotos((current) => current.filter((photo) => photo.id !== item.id));
            refreshListing();
          } catch (e: any) {
            Alert.alert('Photo not removed', e?.message || 'Please try again.');
          } finally {
            setPhotoBusy(false);
          }
        },
      },
    ]);
  };

  const grade = CONDITION_GRADES.find((option) => option.value === fields.conditionGrade);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={96}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
        >
          <Text className="text-[13px] text-text-muted leading-[18px] mb-4">
            The device’s IMEI, serial number and verification result can’t be changed.
          </Text>

          <Text className="text-[13px] font-medium text-text mb-2">Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            {photos.map((item) => (
              <View key={item.id} className="w-24 h-24 rounded-xl bg-surface-alt overflow-hidden mr-2">
                <Image source={{ uri: item.url }} className="w-full h-full" />
                <Pressable
                  onPress={() => removePhoto(item)}
                  disabled={photoBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  hitSlop={8}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 items-center justify-center"
                >
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS
              ? [
                  { label: 'Camera', icon: 'camera-outline' as const, onPress: () => confirmPhotoChange(takePhoto) },
                  { label: 'Library', icon: 'images-outline' as const, onPress: () => confirmPhotoChange(choosePhotos) },
                ].map((source) => (
                  <Pressable
                    key={source.label}
                    onPress={source.onPress}
                    disabled={photoBusy}
                    accessibilityRole="button"
                    accessibilityLabel={`Add a photo from ${source.label.toLowerCase()}`}
                    className="w-24 h-24 rounded-xl border border-dashed border-border-strong items-center justify-center mr-2"
                  >
                    {photoBusy ? (
                      <ActivityIndicator color="#232F3E" />
                    ) : (
                      <>
                        <Ionicons name={source.icon} size={24} color="#565959" />
                        <Text className="text-xs font-medium text-text-muted mt-1">{source.label}</Text>
                      </>
                    )}
                  </Pressable>
                ))
              : null}
          </ScrollView>

          <Input label="Title" value={fields.title} onChangeText={(v) => update('title', v)} maxLength={100} />
          <Input
            label="Description"
            value={fields.description}
            onChangeText={(v) => update('description', v)}
            multiline
            maxLength={2000}
            style={{ minHeight: 110, textAlignVertical: 'top' }}
          />

          <Input
            label={listing.format === 'AUCTION' ? 'Starting price (£)' : 'Asking price (£)'}
            value={fields.price}
            onChangeText={(v) => update('price', v)}
            keyboardType="decimal-pad"
            editable={!priceLocked}
          />
          {priceLocked ? (
            <Text className="text-[13px] text-text-muted -mt-2 mb-4">
              Bidding has started, so the price can’t change.
            </Text>
          ) : null}

          <Text className="text-[13px] font-medium text-text mb-2">Condition</Text>
          <View className="flex-row mb-1.5">
            {CONDITION_GRADES.map((option) => {
              const selected = option.value === fields.conditionGrade;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => update('conditionGrade', option.value)}
                  accessibilityRole="button"
                  accessibilityLabel={`Grade ${option.label}`}
                  accessibilityState={{ selected }}
                  className={`mr-2 w-12 min-h-10 items-center justify-center rounded-full border ${selected ? 'bg-primary border-primary' : 'bg-surface border-borderc'}`}
                >
                  <Text className={`text-[13px] font-medium ${selected ? 'text-white' : 'text-text'}`}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {grade ? <Text className="text-[13px] text-text-muted mb-4">{grade.hint}</Text> : null}

          <Input label="Colour (optional)" value={fields.color} onChangeText={(v) => update('color', v)} maxLength={50} />
          <Input
            label="Storage (optional)"
            value={fields.storageCapacity}
            onChangeText={(v) => update('storageCapacity', v)}
            maxLength={20}
          />

          {willReturnToReview ? (
            <View className="flex-row bg-grade-c-bg rounded-xl p-3 mb-4">
              <Ionicons name="information-circle-outline" size={18} color="#8A6100" />
              <Text className="flex-1 text-[13px] text-grade-c-text ml-2 leading-[18px]">
                Saving sends this listing back to review, and it won’t be for sale until it passes again.
              </Text>
            </View>
          ) : null}

          {error ? (
            <Text accessibilityRole="alert" className="text-sm text-danger mb-3">
              {error}
            </Text>
          ) : null}

          <Button onPress={onSave} loading={saving} disabled={photoBusy}>
            Save changes
          </Button>

          {canToggleSale ? (
            <View className="mt-2.5 mb-6">
              <Button variant="secondary" onPress={toggleSale} disabled={saving || photoBusy}>
                {listing.status === 'ACTIVE' ? 'Take off sale' : 'Put back on sale'}
              </Button>
            </View>
          ) : (
            <View className="mb-6" />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
