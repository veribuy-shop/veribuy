import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { BrandLogo } from '@/src/components/BrandLogo';
import { Field } from '@/src/components/Field';
import { Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await login(email.trim(), password);
      router.replace(user.role === 'ADMIN' ? '/admin' : '/(main)');
    } catch (e: any) {
      setError(e?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen safeTop>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center justify-between h-12 mb-4">
            <TouchableOpacity
              onPress={() => router.push('/(main)')}
              accessibilityRole="button"
              accessibilityLabel="Browse without signing in"
              className="w-10 h-10 -ml-2 items-center justify-center"
            >
              <Ionicons name="chevron-back" size={24} color="#232F3E" />
            </TouchableOpacity>
            <BrandLogo height={40} />
            <View className="w-10" />
          </View>

          <Text className="text-[28px] font-bold text-text">Welcome back</Text>
          <Text className="text-[15px] text-text-muted mt-1 mb-6 leading-[22px]">
            Sign in to buy, sell and track your orders.
          </Text>

          <Field
            label="Email"
            icon="mail-outline"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
          />
          <Field
            label="Password"
            icon="lock-closed-outline"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            trailing={
              <Link href="/forgot-password" style={{ color: '#256A44' }} className="text-[13px] font-medium">
                Forgot password?
              </Link>
            }
          />

          {error ? (
            <Text accessibilityLiveRegion="polite" className="text-sm text-danger mb-3">
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={onSubmit}
            disabled={loading}
            accessibilityRole="button"
            className={`h-12 rounded-xl bg-primary items-center justify-center ${loading ? 'opacity-60' : 'active:opacity-90'}`}
          >
            <Text className="text-white text-[15px] font-semibold">{loading ? 'Signing in…' : 'Sign in'}</Text>
          </TouchableOpacity>

          <View className="flex-row justify-center mt-5">
            <Text className="text-sm text-text-muted">New to VeriBuy? </Text>
            <Link href="/register" style={{ color: '#256A44' }} className="text-sm font-semibold">
              Create an account
            </Link>
          </View>

          <View className="flex-row items-start gap-2 mt-auto pt-8">
            <Ionicons name="shield-checkmark-outline" size={16} color="#2D7A4F" />
            <Text className="flex-1 text-[13px] text-text-muted leading-[18px]">
              Phones are IMEI-checked and every listing is reviewed. Your payment is held until you confirm delivery.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
