import 'react-native-reanimated';
import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StripeProvider } from '@stripe/stripe-react-native';

import { AuthProvider } from '@/src/context/AuthContext';
import { useAuth } from '@/src/context/AuthContext';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

function RootNavigator() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Public routes — always mounted (mirror web's check-email / verify-email pages) */}
      <Stack.Screen name="check-email" />
      <Stack.Screen name="verify-email" options={{ headerShown: false }} />
      {isAuthenticated ? (
        <>
          <Stack.Screen name="(main)" />
          <Stack.Screen name="listing/[id]" options={{ headerShown: true, title: 'Listing' }} />
          <Stack.Screen
            name="conversation/[otherUserId]"
            options={{ headerShown: true, title: 'Conversation' }}
          />
          <Stack.Screen name="admin" options={{ headerShown: true, title: 'Admin' }} />
          <Stack.Screen name="checkout" options={{ headerShown: true, title: 'Checkout' }} />
          <Stack.Screen name="profile-edit" options={{ headerShown: true, title: 'Edit profile' }} />
          <Stack.Screen name="order/[id]" options={{ headerShown: true, title: 'Order' }} />
        </>
      ) : (
        <Stack.Screen name="(auth)" />
      )}
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
