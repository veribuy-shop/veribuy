import 'react-native-reanimated';
import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StripeProvider } from '@/src/lib/stripe';

import { AuthProvider } from '@/src/context/AuthContext';
import { useAuth } from '@/src/context/AuthContext';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

function RootNavigator() {
  const { loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="(main)">
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen
        name="listing/[id]"
        options={{
          headerShown: true,
          title: 'Device Details',
          headerBackTitle: 'Back',
          headerTintColor: '#232F3E',
        }}
      />
      <Stack.Screen
        name="checkout"
        options={{
          headerShown: true,
          title: 'Escrow Checkout',
          headerBackTitle: 'Back',
          headerTintColor: '#232F3E',
        }}
      />
      <Stack.Screen
        name="order/[id]"
        options={{
          headerShown: true,
          title: 'Order Fulfillment',
          headerBackTitle: 'Orders',
          headerTintColor: '#232F3E',
        }}
      />
      <Stack.Screen
        name="conversation/[otherUserId]"
        options={{
          headerShown: true,
          title: 'Messages',
          headerBackTitle: 'Back',
          headerTintColor: '#232F3E',
        }}
      />
      <Stack.Screen
        name="profile-edit"
        options={{
          headerShown: true,
          title: 'Edit Profile',
          headerBackTitle: 'Profile',
          headerTintColor: '#232F3E',
        }}
      />
      <Stack.Screen
        name="admin"
        options={{
          headerShown: true,
          title: 'Admin Dashboard',
          headerBackTitle: 'Back',
          headerTintColor: '#232F3E',
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
