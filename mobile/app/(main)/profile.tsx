import { router } from 'expo-router';
import { Text, View, Pressable } from 'react-native';

import { Button, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <Screen style={{ paddingTop: 64 }}>
      <Text className="text-2xl font-bold text-primary mb-4">Profile</Text>

      <View className="bg-surface rounded-xl border border-borderc p-4 mb-5">
        <Text className="text-lg font-semibold text-text">{user?.name}</Text>
        <Text className="text-text-muted text-sm mt-0.5">{user?.email}</Text>
        <Text className="text-accent-dark text-xs mt-1">Role: {user?.role}</Text>
      </View>

      {user?.role === 'ADMIN' ? (
        <Pressable
          onPress={() => router.push('/admin')}
          className="bg-primary rounded-lg py-3 px-4 mb-3"
        >
          <Text className="text-white font-semibold text-center">Admin Dashboard</Text>
        </Pressable>
      ) : null}

      <Button variant="secondary" onPress={() => router.push('/profile-edit')}>
        Edit profile
      </Button>

      <View style={{ height: 12 }} />

      <Button variant="outline" onPress={() => logout()}>
        Sign out
      </Button>
    </Screen>
  );
}
