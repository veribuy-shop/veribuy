import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View, Pressable, Image } from 'react-native';

import { Button, Input, Screen, Tag } from '@/src/components/ui';
import { evidenceService, listingsService } from '@/src/services';
import { Listing } from '@/src/types/entities';

const DEVICE_TYPES = ['SMARTPHONE', 'TABLET', 'LAPTOP', 'SMARTWATCH', 'DESKTOP', 'GAMING_CONSOLE', 'OTHER'];
const CONDITION_GRADES = ['A', 'B', 'C'];

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value?: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap mb-3">
      {options.map((opt) => (
        <Pressable key={opt} onPress={() => onChange(opt)} className="mr-2 mb-2">
          <Tag className={value === opt ? 'bg-accent' : 'bg-warm-beige'}>{opt.replace('_', ' ')}</Tag>
        </Pressable>
      ))}
    </View>
  );
}

export default function SellScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deviceType, setDeviceType] = useState<string | undefined>();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [conditionGrade, setConditionGrade] = useState<string | undefined>();
  const [imei, setImei] = useState('');
  const [price, setPrice] = useState('');

  const [pickedImage, setPickedImage] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.[0]) return;
    setPickedImage(res.assets[0].uri);
  };

  const createListing = async (): Promise<Listing> => {
    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      deviceType,
      brand: brand.trim(),
      model: model.trim(),
      price: Number(price),
      currency: 'GBP',
    };
    if (imei.trim()) payload.imei = imei.trim();
    if (conditionGrade) payload.conditionGrade = conditionGrade;
    return listingsService.create(payload);
  };

  const onSubmit = async () => {
    if (!title || !description || !deviceType || !brand || !model || !price) {
      setError('Please fill in Title, Description, Device type, Brand, Model and Price.');
      return;
    }
    if (title.trim().length < 10) {
      setError('Title must be at least 10 characters.');
      return;
    }
    if (description.trim().length < 50) {
      setError('Description must be at least 50 characters.');
      return;
    }
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount < 0.01) {
      setError('Price must be at least £0.01.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const listing = await createListing();

      if (pickedImage) {
        try {
          await evidenceService.upload(
            listing.id,
            { uri: pickedImage, name: 'evidence.jpg', type: 'image/jpeg' },
            { type: 'DEVICE_IMAGE', description: 'Initial listing photo' },
          );
        } catch {
          // Non-fatal: listing exists even if evidence upload fails
        }
      }

      Alert.alert('Listing created', 'Your listing is now registered with Trust Lens™ and under review.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      reset();
    } catch (e: any) {
      setError(e?.message || 'Could not create listing.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setTitle('');
    setDescription('');
    setDeviceType(undefined);
    setBrand('');
    setModel('');
    setConditionGrade(undefined);
    setImei('');
    setPrice('');
    setPickedImage(null);
  };

  return (
    <Screen style={{ paddingTop: 20 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <Text className="text-2xl font-bold text-primary mb-1">Sell your device</Text>
          <Text className="text-text-muted mb-4">Create a verified listing with 0% seller commission</Text>

          <Input label="Title * (10+ chars)" value={title} onChangeText={setTitle} />
          <Input
            label="Description * (50+ chars)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <Text className="text-sm text-text-muted mb-1">Device type *</Text>
          <ChipRow options={DEVICE_TYPES} value={deviceType} onChange={setDeviceType} />

          <Input label="Brand *" value={brand} onChangeText={setBrand} />
          <Input label="Model *" value={model} onChangeText={setModel} />

          <Text className="text-sm text-text-muted mb-1">Condition grade</Text>
          <ChipRow options={CONDITION_GRADES} value={conditionGrade} onChange={setConditionGrade} />

          {(deviceType === 'SMARTPHONE' || deviceType === 'TABLET' || deviceType === 'SMARTWATCH') && (
            <Input
              label="IMEI / Hardware Identifier (15 digits)"
              placeholder="e.g. 352094081234567"
              value={imei}
              onChangeText={setImei}
              keyboardType="number-pad"
            />
          )}

          <Input label="Price (GBP £) *" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

          <Pressable onPress={pickImage} className="border border-dashed border-borderc rounded-xl p-4 mb-3 items-center bg-surface-alt">
            {pickedImage ? (
              <Image source={{ uri: pickedImage }} className="w-full h-40 rounded-lg" resizeMode="cover" />
            ) : (
              <Text className="text-accent font-semibold">Add a photo for the evidence pack</Text>
            )}
          </Pressable>

          <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-4">
            <Text className="text-xs font-bold text-emerald-800 mb-0.5">💰 0% Seller Commission</Text>
            <Text className="text-xs text-emerald-700 leading-snug">
              You keep 100% of the sale price. Payout is released automatically to your account following the buyer&apos;s 48-hour delivery inspection window.
            </Text>
          </View>

          {error ? <Text className="text-danger text-sm mb-2">{error}</Text> : null}

          <Button onPress={onSubmit} loading={loading}>
            Publish listing
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
