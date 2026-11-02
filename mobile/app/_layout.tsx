import 'react-native-reanimated';
import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StripeProvider } from '@/src/lib/stripe';

import { AuthProvider } from '@/src/context/AuthContext';
import { useAuth } from '@/src/context/AuthContext';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

export const unstable_settings = { anchor: '(main)' };

function RootNavigator() {
  const { loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerTintColor: '#232F3E',
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTitleStyle: { fontSize: 17, fontWeight: '600', color: '#0F1111' },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: true,
      }}
    >
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen
        name="listing/[id]"
        options={{
          headerShown: true,
          title: 'Device details',
        }}
      />
      <Stack.Screen
        name="checkout"
        options={{
          headerShown: true,
          title: 'Checkout',
        }}
      />
      <Stack.Screen
        name="order/[id]"
        options={{
          headerShown: true,
          title: 'Your order',
        }}
      />
      <Stack.Screen
        name="conversation/[otherUserId]"
        options={{
          headerShown: true,
          title: 'Messages',
        }}
      />
      <Stack.Screen
        name="profile-edit"
        options={{
          headerShown: true,
          title: 'Edit profile',
        }}
      />
      <Stack.Screen
        name="admin"
        options={{
          headerShown: true,
          title: 'Admin',
        }}
      />
      <Stack.Screen name="check-email" options={{ headerShown: false }} />
      <Stack.Screen name="verify-email" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} urlScheme="veribuy">
        <StatusBar style="dark" />
        <RootNavigator />
      </StripeProvider>
    </AuthProvider>
  );
}
