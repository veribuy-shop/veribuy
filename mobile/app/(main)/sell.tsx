import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View, Pressable, Image } from 'react-native';

import { GuestGate } from '@/src/components/GuestGate';
import { Button, Input, Screen, Tag } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { evidenceService, listingsService, trustLensService } from '@/src/services';
import { Listing } from '@/src/types/entities';

import { validateImeiChecksum } from '@veribuy/common/evidence';

import { resolveDeviceWeightProfile } from '@/src/lib/shipping';

const DEVICE_TYPES = ['SMARTPHONE', 'TABLET', 'LAPTOP', 'SMARTWATCH', 'AIRPODS', 'DESKTOP', 'GAMING_CONSOLE', 'OTHER'];
const CONDITION_GRADES = ['A', 'B', 'C'];
const STORAGE_OPTIONS = ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB'];

const CHIP_LABEL: Record<string, string> = {
  SMARTPHONE: 'Smartphone',
  TABLET: 'Tablet',
  LAPTOP: 'Laptop',
  SMARTWATCH: 'Smartwatch',
  AIRPODS: 'Earbuds',
  DESKTOP: 'Desktop',
  GAMING_CONSOLE: 'Games console',
  OTHER: 'Other',
  A: 'A · Pristine',
  B: 'B · Good',
  C: 'C · Fair',
};

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
          <View
            className={`px-3.5 py-2 rounded-full border ${value === opt ? 'bg-primary border-primary' : 'bg-surface border-border-strong'}`}
          >
            <Text className={`text-[13px] font-medium ${value === opt ? 'text-white' : 'text-text'}`}>
              {CHIP_LABEL[opt] ?? opt}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

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

  // Photograph the device directly. JPEG at 0.8 keeps uploads small on mobile data.
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Camera access needed',
        'Allow camera access in Settings to photograph your device, or choose a photo from your library.',
      );
      return;
    }
    try {
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 });
      if (res.canceled || !res.assets?.[0]) return;
      setPickedImage(res.assets[0].uri);
    } catch {
      Alert.alert('Camera unavailable', 'We could not open the camera. You can choose a photo from your library instead.');
    }
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
    if (deviceType === 'SMARTPHONE' && imei.trim()) payload.imei = imei.replace(/[\s-]/g, '');
    return listingsService.create(payload);
  };

  const imeiCheck = validateImeiChecksum(imei);

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
    if (deviceType === 'SMARTPHONE' && !imeiCheck.valid) {
      setError(imeiCheck.status === 'empty' ? 'Enter the phone’s 15-digit IMEI. Dial *#06# to find it.' : imeiCheck.status === 'incomplete' ? `The IMEI is too short: ${imeiCheck.message}.` : imeiCheck.message);
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

      let photoUploaded = false;
      let verificationSubmitted = false;
      if (pickedImage) {
        try {
          await evidenceService.upload(
            listing.id,
            { uri: pickedImage, name: 'evidence.jpg', type: 'image/jpeg' },
            { type: 'DEVICE_IMAGE', description: 'Initial listing photo' },
          );
          photoUploaded = true;
        } catch (uploadErr) {
          console.warn('[SellScreen] Failed to upload initial evidence image:', uploadErr);
        }
      }

      // Same as the web form: nothing goes for review until its photo is in.
      if (photoUploaded) try {
        await trustLensService.submit({
          listingId: listing.id,
          conditionGrade: conditionGrade || undefined,
          imeiProvided: deviceType === 'SMARTPHONE' && !!imei.trim(),
          serialProvided: !!serialNumber.trim(),
          imei: deviceType === 'SMARTPHONE' ? imei.replace(/[\s-]/g, '') || undefined : undefined,
          serialNumber: serialNumber.trim() || undefined,
          brand: brand.trim() || undefined,
        });
        verificationSubmitted = true;
      } catch (trustLensErr) {
        console.warn('[SellScreen] Failed to submit Trust Lens verification request:', trustLensErr);
      }

      // Say exactly what happened — never claim a step succeeded when it didn't.
      const problems = [
        !photoUploaded ? 'your photo didn’t upload' : null,
        photoUploaded && !verificationSubmitted ? 'verification couldn’t be started' : null,
      ].filter(Boolean);
      Alert.alert(
        problems.length ? 'Listing saved — action needed' : 'Listing submitted',
        problems.length
          ? `Your listing was saved, but ${problems.join(' and ')}. Open it on veribuy.shop to add photos and finish verification.`
          : 'Your listing is with Trust Lens for review. We’ll message you when it’s live.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
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
        title="Sell with 0% commission"
        subtitle="Sign in or create an account to list your device with a Trust Lens review and tracked Royal Mail shipping."
        icon="cash-outline"
      />
    );
  }

  return (
    <Screen safeTop>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <Text className="text-[28px] font-bold text-text mb-1">Sell your device</Text>
          <Text className="text-[15px] text-text-muted mb-5">List your device with 0% seller commission</Text>

          <Input label="Title"
            placeholder="e.g. iPhone 14 Pro 256GB, Space Black" value={title} onChangeText={setTitle} />
          <Input
            label="Description"
            placeholder="Condition, what is included, any marks or faults (at least 50 characters)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <Text className="text-[13px] font-medium text-text mb-2">Device type</Text>
          <ChipRow options={DEVICE_TYPES} value={deviceType} onChange={setDeviceType} />

          {weightProfile ? (
            <View className="bg-surface-alt border border-borderc rounded-xl p-3 mb-3 flex-row items-center justify-between">
              <View className="flex-1 mr-2">
                <Text className="text-[11px] font-bold text-text">Postage estimate</Text>
                <Text className="text-[11px] text-text-muted mt-0.5">
                  {weightProfile.weightTierLabel} · ~{weightProfile.totalWeightGrams}g ({weightProfile.parcelFormat === 'SMALL_PARCEL' ? 'Small parcel' : 'Medium parcel'})
                </Text>
              </View>
              <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
                <Text className="text-[11px] font-bold text-emerald-800">Automatic</Text>
              </View>
            </View>
          ) : null}

          <Input label="Brand" value={brand} onChangeText={setBrand} />
          <Input label="Model" value={model} onChangeText={setModel} />

          <Text className="text-[13px] font-medium text-text mb-2">Condition grade</Text>
          <ChipRow options={CONDITION_GRADES} value={conditionGrade} onChange={setConditionGrade} />

          <Text className="text-[13px] font-medium text-text mb-2">Storage capacity</Text>
          <ChipRow options={STORAGE_OPTIONS} value={storageCapacity} onChange={setStorageCapacity} />

          <Input label="Colour (optional)" value={color} onChangeText={setColor} />

          {(deviceType === 'SMARTPHONE') && (
            <Input
              label="IMEI (dial *#06# to find it)"
              placeholder="15 digits"
              error={imei && imeiCheck.status === 'invalid' ? imeiCheck.message : undefined}
              value={imei}
              onChangeText={setImei}
              keyboardType="number-pad"
            />
          )}

          <Input label="Serial number (optional)" value={serialNumber} onChangeText={setSerialNumber} />

          <Input label="Your price (£)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

          {/* Delivery & Postage Options */}
          <Text className="text-sm font-semibold text-text mb-2">Delivery</Text>
          
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
                  Buyer pays postage
                </Text>
              </View>
              <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
                <Text className="text-[11px] font-bold text-emerald-800">£0 for you</Text>
              </View>
            </View>
            <Text className="text-xs text-text-muted ml-6 leading-relaxed">
              Royal Mail postage is worked out at checkout from the device’s weight and the buyer’s location. You pay nothing for postage.
            </Text>
          </Pressable>

          {/* Option 2: Seller Pays (Free postage for the buyer) */}
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
                  Free postage for the buyer
                </Text>
              </View>
              <View className="bg-warm-beige px-2 py-0.5 rounded-full">
                <Text className="text-[11px] font-semibold text-accent-dark">Attracts buyers</Text>
              </View>
            </View>
            <Text className="text-xs text-text-muted ml-6 leading-relaxed">
              You cover the Royal Mail Tracked postage cost, so buyers see free delivery.
            </Text>
          </Pressable>

          {/* Photo: camera or library */}
          <View className="border border-dashed border-borderc rounded-xl p-4 mb-3 items-center bg-surface-alt">
            {pickedImage ? (
              <Image
                source={{ uri: pickedImage }}
                className="w-full h-40 rounded-lg mb-3"
                resizeMode="cover"
                accessibilityLabel="Selected device photo"
              />
            ) : (
              <Text className="text-text-muted text-xs mb-3 text-center">
                Add a clear photo of the device in good light.
              </Text>
            )}
            <View className="flex-row gap-2 w-full">
              <Pressable
                onPress={takePhoto}
                accessibilityRole="button"
                className="flex-1 bg-[#232F3E] py-3 rounded-xl items-center"
              >
                <Text className="text-white font-bold text-xs">Take photo</Text>
              </Pressable>
              <Pressable
                onPress={pickImage}
                accessibilityRole="button"
                className="flex-1 bg-white border border-borderc py-3 rounded-xl items-center"
              >
                <Text className="text-text font-bold text-xs">{pickedImage ? 'Choose another' : 'Choose from library'}</Text>
              </Pressable>
            </View>
          </View>

          {/* Transparent Payout Card */}
          <View className="bg-surface border border-borderc rounded-xl p-4 mb-3.5">
            <Text className="text-xs font-bold text-text mb-2.5">Your payout</Text>
            
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-xs text-text-muted">Asking price</Text>
              <Text className="text-xs font-semibold text-text">
                £{isValidPrice ? parsedPrice.toFixed(2) : '0.00'}
              </Text>
            </View>

            <View className="flex-row justify-between mb-1.5">
              <Text className="text-xs text-text-muted">VeriBuy commission</Text>
              <Text className="text-xs font-bold text-emerald-600">0% (£0.00)</Text>
            </View>

            <View className="flex-row justify-between mb-2">
              <Text className="text-xs text-text-muted">Postage</Text>
              <Text className="text-xs text-text-muted">
                {freeShipping ? 'Paid by you' : 'Paid by the buyer'}
              </Text>
            </View>

            <View className="border-t border-borderc pt-2.5 flex-row justify-between items-center">
              <Text className="text-sm font-bold text-text">You receive</Text>
              <Text className="text-base font-bold text-emerald-700">
                £{isValidPrice ? parsedPrice.toFixed(2) : '0.00'}
              </Text>
            </View>
          </View>

          {/* 0% Commission Guarantee */}
          <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-2.5">
            <Text className="text-xs font-bold text-emerald-800 mb-0.5">0% seller commission</Text>
            <Text className="text-xs text-emerald-700 leading-snug">
              You keep your full asking price. The buyer pays a Buyer Protection fee, and you're paid once they confirm the device arrived as described.
            </Text>
          </View>

          {/* Refer a seller, earn £5 */}
          <View className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4 flex-row items-center justify-between">
            <View className="flex-1 mr-2">
              <Text className="text-xs font-bold text-amber-900 mb-0.5">Refer a seller, earn £5</Text>
              <Text className="text-xs text-amber-800 leading-snug">
                Share your referral link. You earn £5 when a seller you refer completes their first sale.
              </Text>
            </View>
            <View className="bg-amber-200/80 px-2 py-1 rounded-full">
              <Text className="text-[11px] font-black text-amber-900">+£5</Text>
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
