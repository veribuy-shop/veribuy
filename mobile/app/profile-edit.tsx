import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { BrandLogo } from '@/src/components/BrandLogo';
import { Button, Card, Input, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { usersService } from '@/src/services';
import { User, UserProfile } from '@/src/types/entities';

export default function ProfileEditScreen() {
  const { user } = useAuth();
  const profileUser = user as User | null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Personal details
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Shipping & Dispatch Address
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('GB');

  useEffect(() => {
    (async () => {
      if (!profileUser) return;
      try {
        const profile = await usersService.getProfile(profileUser.id);
        setDisplayName(profile.displayName || profileUser.name || '');
        setFirstName(profile.firstName || '');
        setLastName(profile.lastName || '');
        setPhone(profile.phone || '');
        setBio(profile.bio || '');
        setAvatarUrl(profile.avatarUrl || '');
        setLine1(profile.line1 || '');
        setLine2(profile.line2 || '');
        setCity(profile.city || '');
        setState(profile.state || '');
        setPostalCode(profile.postalCode || '');
        setCountry(profile.country || 'GB');
      } catch {
        // Fallback default
        setDisplayName(profileUser.name || '');
      } finally {
        setLoading(false);
      }
    })();
  }, [profileUser?.id]);

  const onPickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.[0]) return;
    setAvatarUrl(res.assets[0].uri);
  };

  const onSave = async () => {
    if (!profileUser) return;
    setSaving(true);
    setError('');
    try {
      await usersService.updateProfile(profileUser.id, {
        displayName: displayName.trim() || undefined,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        line1: line1.trim() || undefined,
        line2: line2.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        country: country.trim() || 'GB',
      });
      Alert.alert('Profile Updated', 'Your profile and default delivery address have been saved successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      setError(e?.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Text className="text-text-muted text-xs">Loading profile details...</Text>
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundColor: '#F8F9FF', paddingTop: Platform.OS === 'web' ? 16 : 44 }}>
      {/* ── Top Header Bar ──────────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between mb-3 px-1">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-white border border-borderc items-center justify-center shadow-xs"
        >
          <Text className="text-base font-bold text-text">‹</Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-2">
          <BrandLogo height={38} />
          <Text className="text-xs font-black text-text">Account Profile</Text>
        </View>

        <View className="w-9 h-9" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Avatar Header */}
          <View className="items-center my-3">
            <TouchableOpacity
              onPress={onPickAvatar}
              className="w-20 h-20 rounded-full bg-slate-900 overflow-hidden items-center justify-center border-2 border-emerald-500 shadow-md relative"
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <Text className="text-white text-2xl font-black">
                  {(displayName || 'VB').slice(0, 2).toUpperCase()}
                </Text>
              )}
              <View className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 items-center">
                <Text className="text-white text-[8px] font-bold">CHANGE</Text>
              </View>
            </TouchableOpacity>
            <Text className="text-sm font-black text-text mt-2">{displayName || user?.email}</Text>
            <Text className="text-[11px] text-emerald-700 font-bold">✓ Verified VeriBuy Member</Text>
          </View>

          {/* Personal Information Card */}
          <Card className="mb-3.5">
            <Text className="text-xs font-black text-text uppercase tracking-wider mb-2.5">
              Personal Information
            </Text>

            <Input
              label="Display Name (Public)"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g. AlexJ_Tech"
            />

            <View className="flex-row gap-2">
              <View className="flex-1">
                <Input
                  label="First Name"
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Alex"
                />
              </View>
              <View className="flex-1">
                <Input
                  label="Last Name"
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Jenkins"
                />
              </View>
            </View>

            <Input
              label="Phone Number (for Royal Mail delivery updates)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+44 7123 456789"
            />

            <Input
              label="Bio / Trader Introduction"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              placeholder="Specializing in pristine Apple Silicon & flagship electronics..."
            />
          </Card>

          {/* Default Delivery & Return Address Card */}
          <Card className="mb-3.5">
            <View className="flex-row items-center justify-between mb-2.5">
              <Text className="text-xs font-black text-text uppercase tracking-wider">
                Default UK Delivery &amp; Return Address
              </Text>
              <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Text className="text-[9px] font-bold text-emerald-800">Auto-fills Checkout</Text>
              </View>
            </View>

            <Input
              label="Address Line 1"
              value={line1}
              onChangeText={setLine1}
              placeholder="Flat 4B, 18 Kensington Church Street"
            />

            <Input
              label="Address Line 2 (Optional)"
              value={line2}
              onChangeText={setLine2}
              placeholder="Apartment, suite, or building"
            />

            <View className="flex-row gap-2">
              <View className="flex-1">
                <Input
                  label="City / Town"
                  value={city}
                  onChangeText={setCity}
                  placeholder="London"
                />
              </View>
              <View className="w-32">
                <Input
                  label="Postcode"
                  value={postalCode}
                  onChangeText={(v) => setPostalCode(v.toUpperCase())}
                  placeholder="W8 4EP"
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </Card>

          {error ? <Text className="text-danger text-sm mb-3 px-1">{error}</Text> : null}

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <Button variant="outline" onPress={() => router.back()} disabled={saving}>
              Cancel
            </Button>
            <View className="flex-1">
              <Button onPress={onSave} loading={saving}>
                Save Changes
              </Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
