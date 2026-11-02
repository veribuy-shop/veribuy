import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { BrandLogo } from './BrandLogo';
import { Button, Card, Screen } from './ui';

interface GuestGateProps {
  title: string;
  subtitle: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function GuestGate({
  title,
  subtitle,
  icon = 'lock-closed-outline',
}: GuestGateProps) {
  return (
    <Screen style={{ justifyContent: 'center' }}>
      <View className="items-center mb-6">
        <BrandLogo width={160} height={50} />
      </View>

      <Card>
        <View className="items-center py-4">
          <View className="mb-3"><Ionicons name={icon} size={38} color="#232F3E" /></View>
          <Text className="text-xl font-bold text-text text-center">{title}</Text>
          <Text className="text-sm text-text-muted text-center mt-2 px-3 leading-5">
            {subtitle}
          </Text>

          <View className="w-full mt-6 gap-2">
            <Button onPress={() => router.push('/login')}>
              Sign in to your account
            </Button>
            <Button
              variant="outline"
              onPress={() => router.push('/register')}
            >
              Create a free account
            </Button>
          </View>
        </View>
      </Card>
    </Screen>
  );
}
