import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { BrandLogo } from '@/src/components/BrandLogo';
import { Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';

export default function LoginScreen() {
  const { login, socialLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'GOOGLE' | 'APPLE' | null>(null);
  const [socialModalProvider, setSocialModalProvider] = useState<'GOOGLE' | 'APPLE' | null>(null);
  const [socialEmailInput, setSocialEmailInput] = useState('');
  const [error, setError] = useState('');

  const executeSocialLogin = async (provider: 'GOOGLE' | 'APPLE', targetEmail: string) => {
    setSocialLoading(provider);
    setError('');
    try {
      const res = await socialLogin(provider, {
        email: targetEmail.trim(),
        action: 'login',
      });

      setSocialModalProvider(null);

      if (res.requiresEmailVerification || !res.user.isEmailVerified) {
        router.replace('/check-email');
      } else if (res.requiresProfileCompletion) {
        router.replace('/profile-edit');
      } else {
        router.replace(res.user.role === 'ADMIN' ? '/admin' : '/(main)');
      }
    } catch (e: any) {
      setError(e?.message || `${provider} sign-in failed`);
    } finally {
      setSocialLoading(null);
    }
  };

  const onSocialAuth = async (provider: 'GOOGLE' | 'APPLE') => {
    if (email.trim()) {
      await executeSocialLogin(provider, email.trim());
    } else {
      setSocialEmailInput('');
      setSocialModalProvider(provider);
    }
  };

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
    <Screen style={{ backgroundColor: '#F8F9FF', paddingTop: Platform.OS === 'web' ? 20 : 44 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Top Bar (Matching screen2.png) ──────────────────────────────── */}
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity
              onPress={() => router.push('/(main)')}
              className="w-9 h-9 rounded-full bg-white border border-borderc items-center justify-center shadow-xs"
            >
              <Text className="text-base font-bold text-text">‹</Text>
            </TouchableOpacity>

            <BrandLogo height={44} />

            <View className="w-9 h-9 rounded-full bg-[#0B192C] items-center justify-center">
              <Text className="text-white text-xs font-bold">👤</Text>
            </View>
          </View>

          {/* ── Top Hero Card: Welcome & Segmented Toggle ─────────────────────── */}
          <View className="bg-white rounded-2xl border border-borderc p-4 mb-3 shadow-xs items-center">
            <View className="flex-row items-center justify-between w-full mb-3">
              <View className="bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex-row items-center gap-1">
                <Text className="text-emerald-700 text-[10px] font-extrabold">🛡️ TRUST LENS™ PROTOCOL</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <View className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                <Text className="text-[10px] font-bold text-slate-600">Escrow Active</Text>
              </View>
            </View>

            {/* Lock Avatar */}
            <View className="relative mb-2">
              <View className="w-14 h-14 rounded-2xl bg-[#eff4ff] border border-borderc items-center justify-center">
                <Text className="text-2xl">🔒</Text>
              </View>
              <View className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 items-center justify-center border-2 border-white">
                <Text className="text-[9px] text-white font-bold">✓</Text>
              </View>
            </View>

            <Text className="text-text font-black text-xl mb-1">Welcome to VeriBuy</Text>
            <Text className="text-text-muted text-xs text-center px-4 leading-relaxed mb-4">
              Secure verification with buyer &amp; seller escrow protection on every gadget.
            </Text>

            {/* Segmented Control */}
            <View className="flex-row bg-[#eff4ff] p-1 rounded-xl w-full">
              <View className="flex-1 bg-[#0B192C] py-2 rounded-lg items-center shadow-xs">
                <Text className="text-white text-xs font-black">→] Sign In</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/register')}
                className="flex-1 py-2 items-center"
              >
                <Text className="text-text font-bold text-xs">👤+ Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Social Auth Buttons (Matching screen2.png) ───────────────────── */}
          <View className="space-y-2 mb-4">
            <TouchableOpacity
              onPress={() => onSocialAuth('APPLE')}
              disabled={loading || Boolean(socialLoading)}
              className="bg-white border border-borderc rounded-2xl p-3 flex-row items-center justify-between shadow-xs active:bg-slate-50"
            >
              <View className="flex-row items-center gap-2.5">
                <Text className="text-base"></Text>
                <Text className="text-text font-bold text-xs">Continue with Apple</Text>
              </View>
              <View className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                <Text className="text-[9px] font-bold text-slate-700">
                  {socialLoading === 'APPLE' ? 'Signing in...' : '⚡ Instant'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onSocialAuth('GOOGLE')}
              disabled={loading || Boolean(socialLoading)}
              className="bg-white border border-borderc rounded-2xl p-3 flex-row items-center justify-between shadow-xs active:bg-slate-50"
            >
              <View className="flex-row items-center gap-2.5">
                <Text className="text-base font-black text-rose-500">G</Text>
                <Text className="text-text font-bold text-xs">Continue with Google</Text>
              </View>
              <View className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                <Text className="text-[9px] font-bold text-slate-700">
                  {socialLoading === 'GOOGLE' ? 'Signing in...' : '🔒 Passkey'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Divider ─────────────────────────────────────────────────────── */}
          <View className="flex-row items-center my-3">
            <View className="flex-1 h-[1px] bg-slate-200" />
            <Text className="text-[10px] font-bold text-text-muted px-3 uppercase tracking-wider">
              Or with Email Credentials
            </Text>
            <View className="flex-1 h-[1px] bg-slate-200" />
          </View>

          {/* ── Email Credentials Form (Matching screen2.png) ────────────────── */}
          <View className="bg-white rounded-2xl border border-borderc p-4 mb-3 shadow-xs">
            {/* Email Field */}
            <View className="mb-3">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-xs font-bold text-text">Email Address</Text>
                <Text className="text-[10px] font-bold text-emerald-700">🛡️ Clean IMEI Registry</Text>
              </View>
              <View className="flex-row items-center bg-[#eff4ff] border border-borderc rounded-xl px-3 py-2.5">
                <Text className="text-sm mr-2 text-text-muted">✉️</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="s.jenkins@veribuy.co.uk"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="flex-1 text-text text-xs font-medium"
                />
              </View>
            </View>

            {/* Password Field */}
            <View className="mb-3">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-xs font-bold text-text">Password</Text>
                <Link href="/forgot-password" className="text-[10px] font-bold text-blue-600">
                  Forgot password?
                </Link>
              </View>
              <View className="flex-row items-center bg-[#eff4ff] border border-borderc rounded-xl px-3 py-2.5">
                <Text className="text-sm mr-2 text-text-muted">🔒</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••••••"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  className="flex-1 text-text text-xs font-medium"
                />
              </View>
            </View>

            {error ? (
              <Text className="text-rose-600 text-xs mb-2 font-medium">{error}</Text>
            ) : null}

            {/* Trust Callout */}
            <View className="bg-[#eff4ff] border border-borderc rounded-xl p-2.5 mb-3.5 flex-row items-center gap-2">
              <Text className="text-emerald-700 text-xs font-bold">🛡️</Text>
              <Text className="text-[10px] text-text-muted font-medium flex-1">
                Protected by Stripe Escrow &amp; GSMA Blacklist sync
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={onSubmit}
              disabled={loading}
              className="bg-[#0B192C] py-3.5 rounded-xl flex-row items-center justify-center gap-2 active:opacity-90 shadow-sm"
            >
              <Text className="text-white text-xs">🛡️</Text>
              <Text className="text-white font-black text-xs tracking-wide">
                {loading ? 'Authenticating...' : 'Sign In with Escrow Shield →'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Bottom Link Card: New to VeriBuy? ─────────────────────────────── */}
          <TouchableOpacity
            onPress={() => router.push('/register')}
            className="bg-white rounded-2xl border border-borderc p-3.5 mb-4 shadow-xs flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 items-center justify-center">
                <Text className="text-xl">🐷</Text>
              </View>
              <View>
                <Text className="text-xs font-black text-text">New to VeriBuy?</Text>
                <Text className="text-[10px] text-text-muted">Register with 0% Seller Commission</Text>
              </View>
            </View>
            <Text className="text-base text-text-muted font-bold">›</Text>
          </TouchableOpacity>

          {/* ── Trust Footer (Matching screen2.png) ──────────────────────────── */}
          <View className="items-center mt-2">
            <View className="bg-white/80 border border-borderc px-3 py-1 rounded-full flex-row items-center gap-1.5 mb-2 shadow-xs">
              <Text className="text-[10px] text-emerald-700 font-bold">🔒 Protected by 256-bit SSL &amp; Stripe Escrow</Text>
            </View>
            <Text className="text-[10px] text-text-muted text-center px-6 leading-relaxed">
              Every device authenticated before payment release. Zero unverified sellers.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Social Email Entry Modal ── */}
      <Modal
        visible={Boolean(socialModalProvider)}
        transparent
        animationType="fade"
        onRequestClose={() => setSocialModalProvider(null)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <View className="items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-slate-100 items-center justify-center mb-2">
                <Text className="text-xl">
                  {socialModalProvider === 'GOOGLE' ? '🌐' : ''}
                </Text>
              </View>
              <Text className="text-base font-black text-slate-900">
                Sign in with {socialModalProvider === 'GOOGLE' ? 'Google' : 'Apple'}
              </Text>
              <Text className="text-xs text-slate-500 text-center mt-1">
                Enter your {socialModalProvider === 'GOOGLE' ? 'Google' : 'Apple'} email address to access your verified account.
              </Text>
            </View>

            <View className="mb-4">
              <Text className="text-xs font-bold text-slate-700 mb-1">Email Address *</Text>
              <TextInput
                value={socialEmailInput}
                onChangeText={setSocialEmailInput}
                placeholder="your.email@example.com"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800"
              />
            </View>

            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setSocialModalProvider(null)}
                disabled={Boolean(socialLoading)}
                className="flex-1 py-3 rounded-xl border border-slate-200 items-center justify-center"
              >
                <Text className="text-xs font-bold text-slate-600">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (socialModalProvider && socialEmailInput.trim()) {
                    executeSocialLogin(socialModalProvider, socialEmailInput.trim());
                  }
                }}
                disabled={!socialEmailInput.trim() || Boolean(socialLoading)}
                className="flex-1 py-3 rounded-xl bg-slate-900 items-center justify-center disabled:opacity-50"
              >
                <Text className="text-xs font-bold text-white">
                  {socialLoading ? 'Signing in...' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
