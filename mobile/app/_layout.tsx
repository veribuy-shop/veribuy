import * as SplashScreen from 'expo-splash-screen';
import { AppState, LogBox } from 'react-native';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StripeProvider } from '@/src/lib/stripe';

import { AuthProvider } from '@/src/context/AuthContext';
import { useAuth } from '@/src/context/AuthContext';
import { configService } from '@/src/services';

// Raised by a dependency, not this app, and its banner covers the bottom of every screen in dev.
LogBox.ignoreLogs(['ImageBackground is deprecated']);

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

export const unstable_settings = { anchor: '(main)' };

// How long the splash waits for the marketplace rules before showing the app anyway.
const CONFIG_LOAD_TIMEOUT_MS = 5000;

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { loading } = useAuth();
  const [configReady, setConfigReady] = useState(false);

  // Prices include the fee, so load the rules before the first screen draws.
  useEffect(() => {
    const timeout = new Promise((resolve) => setTimeout(resolve, CONFIG_LOAD_TIMEOUT_MS));
    Promise.race([configService.refresh(), timeout]).finally(() => setConfigReady(true));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') configService.refresh();
    });
    return () => subscription.remove();
  }, []);

  const ready = !loading && configReady;

  // Keep the splash up until the first screen can draw, so there's no blank flash.
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) {
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
      <Stack.Screen name="my-listings" options={{ headerShown: true, title: 'Your listings' }} />
      <Stack.Screen name="offers" options={{ headerShown: true, title: 'Offers' }} />
      <Stack.Screen name="listing/edit/[id]" options={{ headerShown: true, title: 'Edit listing' }} />
      <Stack.Screen name="updates" options={{ headerShown: true, title: 'VeriBuy updates' }} />
      <Stack.Screen name="close-account" options={{ headerShown: true, title: 'Close account' }} />
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
