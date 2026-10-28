import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View, Pressable, Image } from 'react-native';

import { Button, Input, Screen, Tag } from '@/src/components/ui';
import { evidenceService, listingsService, trustLensService } from '@/src/services';
import { Listing } from '@/src/types/entities';

import { resolveDeviceWeightProfile } from '@/src/lib/shipping';

const DEVICE_TYPES = ['SMARTPHONE', 'TABLET', 'LAPTOP', 'SMARTWATCH', 'AIRPODS', 'DESKTOP', 'GAMING_CONSOLE', 'OTHER'];
const CONDITION_GRADES = ['A', 'B', 'C'];
const STORAGE_OPTIONS = ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB'];

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

import { GuestGate } from '@/src/components/GuestGate';
import { useAuth } from '@/src/context/AuthContext';

export default function SellScreen() {
  const { isAuthenticated } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deviceType, setDeviceType] = useState<string | undefined>();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [conditionGrade, setConditionGrade] = useState<string | undefined>();
  const [storageCapacity, setStorageCapacity] = useState<string | undefined>();
  const [color, setColor] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [imei, setImei] = useState('');
  const [price, setPrice] = useState('');
  const [freeShipping, setFreeShipping] = useState(false);

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
      freeShipping,
    };
    if (conditionGrade) payload.conditionGrade = conditionGrade;
    if (storageCapacity) payload.storageCapacity = storageCapacity;
    if (color.trim()) payload.color = color.trim();
    if (serialNumber.trim()) payload.serialNumber = serialNumber.trim();
    if (imei.trim()) payload.imei = imei.trim();
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

    if (!pickedImage) {
      setError('Please select at least one clear photo of your device.');
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
        } catch (uploadErr) {
          console.warn('[SellScreen] Non-fatal: failed to upload initial evidence image:', uploadErr);
        }
      }

      try {
        await trustLensService.submit({
          listingId: listing.id,
          conditionGrade: conditionGrade || undefined,
          imeiProvided: !!imei.trim(),
          serialProvided: !!serialNumber.trim(),
          imei: imei.trim() || undefined,
          serialNumber: serialNumber.trim() || undefined,
          brand: brand.trim() || undefined,
        });
      } catch (trustLensErr) {
        console.warn('[SellScreen] Non-fatal: failed to submit Trust Lens verification request:', trustLensErr);
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
    setStorageCapacity(undefined);
    setColor('');
    setSerialNumber('');
    setImei('');
    setPrice('');
    setFreeShipping(false);
    setPickedImage(null);
  };

  const parsedPrice = Number(price);
  const isValidPrice = Number.isFinite(parsedPrice) && parsedPrice > 0;
  const weightProfile = deviceType ? resolveDeviceWeightProfile(deviceType, brand, model, 1) : null;

  if (!isAuthenticated) {
    return (
      <GuestGate
        title="Sell with 0% Commission"
        subtitle="Sign in or create an account to list your device with verified Trust Lens™ diagnostics and automated Royal Mail shipping."
        icon="💰"
      />
    );
  }

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

          {weightProfile ? (
            <View className="bg-surface-alt border border-borderc rounded-xl p-3 mb-3 flex-row items-center justify-between">
              <View className="flex-1 mr-2">
                <Text className="text-[11px] font-bold text-text">📦 Royal Mail Automated Weight Profiling</Text>
                <Text className="text-[11px] text-text-muted mt-0.5">
                  {weightProfile.weightTierLabel} · ~{weightProfile.totalWeightGrams}g ({weightProfile.parcelFormat === 'SMALL_PARCEL' ? 'Small Parcel' : 'Medium Parcel'})
                </Text>
              </View>
              <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
                <Text className="text-[10px] font-bold text-emerald-800">Auto-mapped</Text>
              </View>
            </View>
          ) : null}

          <Input label="Brand *" value={brand} onChangeText={setBrand} />
          <Input label="Model *" value={model} onChangeText={setModel} />

          <Text className="text-sm text-text-muted mb-1">Condition grade</Text>
          <ChipRow options={CONDITION_GRADES} value={conditionGrade} onChange={setConditionGrade} />

          <Text className="text-sm text-text-muted mb-1">Storage capacity</Text>
          <ChipRow options={STORAGE_OPTIONS} value={storageCapacity} onChange={setStorageCapacity} />

          <Input label="Color (e.g. Space Grey, Titanium)" value={color} onChangeText={setColor} />

          {(deviceType === 'SMARTPHONE' || deviceType === 'TABLET' || deviceType === 'SMARTWATCH') && (
            <Input
              label="IMEI / Hardware Identifier (15 digits)"
              placeholder="e.g. 352094081234567"
              value={imei}
              onChangeText={setImei}
              keyboardType="number-pad"
            />
          )}

          <Input label="Serial Number (Optional)" value={serialNumber} onChangeText={setSerialNumber} />

          <Input label="Price (GBP £) *" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

          {/* Delivery & Postage Options */}
          <Text className="text-sm font-semibold text-text mb-2">Delivery Method & Postage</Text>
          
          {/* Option 1: Buyer Pays */}
          <Pressable
            onPress={() => setFreeShipping(false)}
            className={`p-3.5 rounded-xl border mb-2.5 ${
              !freeShipping
                ? 'bg-emerald-50/70 border-emerald-500'
                : 'bg-surface border-borderc'
            }`}
          >
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center">
                <View
                  className={`w-4 h-4 rounded-full border items-center justify-center mr-2.5 ${
                    !freeShipping ? 'border-emerald-600 bg-emerald-600' : 'border-borderc'
                  }`}
                >
                  {!freeShipping && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                </View>
                <Text className="font-semibold text-sm text-text">
                  Buyer Pays Shipping (Standard)
                </Text>
              </View>
              <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
                <Text className="text-[11px] font-bold text-emerald-800">£0 for You</Text>
              </View>
            </View>
            <Text className="text-xs text-text-muted ml-6 leading-relaxed">
              Postage is calculated dynamically at checkout via Royal Mail Tracked rates based on device category, weight profile, and buyer&apos;s UK location. You pay £0 for shipping.
            </Text>
          </Pressable>

          {/* Option 2: Seller Pays (Free Shipping for Buyer) */}
          <Pressable
            onPress={() => setFreeShipping(true)}
            className={`p-3.5 rounded-xl border mb-3.5 ${
              freeShipping
                ? 'bg-emerald-50/70 border-emerald-500'
                : 'bg-surface border-borderc'
            }`}
          >
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center">
                <View
                  className={`w-4 h-4 rounded-full border items-center justify-center mr-2.5 ${
                    freeShipping ? 'border-emerald-600 bg-emerald-600' : 'border-borderc'
                  }`}
                >
                  {freeShipping && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                </View>
                <Text className="font-semibold text-sm text-text">
                  Free Shipping for Buyer
                </Text>
              </View>
              <View className="bg-warm-beige px-2 py-0.5 rounded-full">
                <Text className="text-[11px] font-semibold text-accent-dark">Attracts Buyers</Text>
              </View>
            </View>
            <Text className="text-xs text-text-muted ml-6 leading-relaxed">
              You cover the Royal Mail Tracked postage cost. Free shipping listings typically sell up to 2x faster.
            </Text>
          </Pressable>

          {/* Photo upload */}
          <Pressable onPress={pickImage} className="border border-dashed border-borderc rounded-xl p-4 mb-3 items-center bg-surface-alt">
            {pickedImage ? (
              <Image source={{ uri: pickedImage }} className="w-full h-40 rounded-lg" resizeMode="cover" />
            ) : (
              <Text className="text-accent font-semibold">Add a photo for the evidence pack</Text>
            )}
          </Pressable>

          {/* Transparent Payout Card */}
          <View className="bg-surface border border-borderc rounded-xl p-4 mb-3.5">
            <Text className="text-xs font-bold text-text mb-2.5 uppercase tracking-wide">Payout Breakdown</Text>
            
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-xs text-text-muted">Asking Price</Text>
              <Text className="text-xs font-semibold text-text">
                £{isValidPrice ? parsedPrice.toFixed(2) : '0.00'}
              </Text>
            </View>

            <View className="flex-row justify-between mb-1.5">
              <Text className="text-xs text-text-muted">VeriBuy Commission</Text>
              <Text className="text-xs font-bold text-emerald-600">0% (£0.00)</Text>
            </View>

            <View className="flex-row justify-between mb-2">
              <Text className="text-xs text-text-muted">Postage Fee</Text>
              <Text className="text-xs text-text-muted">
                {freeShipping ? 'Covered by Seller' : 'Paid by Buyer (Royal Mail Live)'}
              </Text>
            </View>

            <View className="border-t border-borderc pt-2.5 flex-row justify-between items-center">
              <Text className="text-sm font-bold text-text">Estimated Payout</Text>
              <Text className="text-base font-bold text-emerald-700">
                £{isValidPrice ? parsedPrice.toFixed(2) : '0.00'}
              </Text>
            </View>
          </View>

          {/* 0% Commission Guarantee */}
          <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-2.5">
            <Text className="text-xs font-bold text-emerald-800 mb-0.5">💰 0% Seller Commission Guarantee</Text>
            <Text className="text-xs text-emerald-700 leading-snug">
              You keep 100% of your device sale price. Funds are vaulted securely in escrow and released automatically following the buyer&apos;s 48-hour inspection window.
            </Text>
          </View>

          {/* £5 First-Sale Referral Bounty */}
          <View className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4 flex-row items-center justify-between">
            <View className="flex-1 mr-2">
              <Text className="text-xs font-bold text-amber-900 mb-0.5">🎁 £5 First-Sale Referral Bounty</Text>
              <Text className="text-xs text-amber-800 leading-snug">
                Earn £5 cash bonus on your first sale! Share your referral link with fellow sellers to earn an additional £5 on each of their first sales.
              </Text>
            </View>
            <View className="bg-amber-200/80 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-black text-amber-900">+£5 CASH</Text>
            </View>
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
