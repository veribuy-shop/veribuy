import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

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

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    (async () => {
      if (!profileUser) return;
      try {
        const profile = await usersService.getProfile(profileUser.id);
        setFirstName(profile.firstName || '');
        setLastName(profile.lastName || '');
        setPhone(profile.phone || '');
        setBio(profile.bio || '');
        setAvatarUrl(profile.avatarUrl || '');
      } catch {
        setError('Could not load your profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, [profileUser?.id]);

  const onSave = async () => {
    if (!profileUser) return;
    setSaving(true);
    setError('');
    try {
      await usersService.updateProfile(profileUser.id, {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || undefined,
        bio: bio || undefined,
        avatarUrl: avatarUrl || undefined,
      });
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Text className="text-text-muted text-center mt-10">Loading…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Card>
          <Text className="text-lg font-semibold text-text mb-3">Edit profile</Text>
          <Input label="First name" value={firstName} onChangeText={setFirstName} />
          <Input label="Last name" value={lastName} onChangeText={setLastName} />
          <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Input label="Bio" value={bio} onChangeText={setBio} multiline numberOfLines={4} />
          <Input
            label="Avatar URL"
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://…"
          />
          {error ? <Text className="text-danger text-sm mb-2">{error}</Text> : null}
        </Card>

        <View className="flex-row gap-3">
          <Button variant="outline" onPress={() => router.back()} disabled={saving}>
            Cancel
          </Button>
          <View className="flex-1">
            <Button onPress={onSave} loading={saving}>
              Save changes
            </Button>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
