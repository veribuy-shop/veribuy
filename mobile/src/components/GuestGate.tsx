import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { BrandLogo } from './BrandLogo';
import { Button, Card, Screen } from './ui';

interface GuestGateProps {
  title: string;
  subtitle: string;
  icon?: string;
}

export function GuestGate({
  title,
  subtitle,
  icon = '🔒',
}: GuestGateProps) {
  return (
    <Screen style={{ paddingTop: 60, justifyContent: 'center' }}>
      <View className="items-center mb-6">
        <BrandLogo width={160} height={50} />
      </View>

      <Card>
        <View className="items-center py-4">
          <Text className="text-4xl mb-3">{icon}</Text>
          <Text className="text-xl font-bold text-text text-center">{title}</Text>
          <Text className="text-xs text-text-muted text-center mt-2 px-3 leading-relaxed">
            {subtitle}
          </Text>

          <View className="w-full mt-6 space-y-2">
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
