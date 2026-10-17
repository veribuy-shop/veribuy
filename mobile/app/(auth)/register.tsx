import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { usersService } from '@/src/services';

export default function RegisterScreen() {
  const { register, socialLogin } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [validatingRef, setValidatingRef] = useState(false);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [refError, setRefError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'GOOGLE' | 'APPLE' | null>(null);
  const [socialModalProvider, setSocialModalProvider] = useState<'GOOGLE' | 'APPLE' | null>(null);
  const [socialEmailInput, setSocialEmailInput] = useState('');
  const [error, setError] = useState('');

  const executeSocialAuth = async (provider: 'GOOGLE' | 'APPLE', targetEmail: string) => {
    setSocialLoading(provider);
    setError('');
    try {
      const res = await socialLogin(provider, {
        email: targetEmail.trim(),
        name: name.trim() || undefined,
        referralCode: referrerName ? referralCode.trim() : undefined,
        action: 'register',
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
      setError(e?.message || `${provider} sign-up failed`);
    } finally {
      setSocialLoading(null);
    }
  };

  const onSocialAuth = async (provider: 'GOOGLE' | 'APPLE') => {
    if (email.trim()) {
      await executeSocialAuth(provider, email.trim());
    } else {
      setSocialEmailInput('');
      setSocialModalProvider(provider);
    }
  };

  // Debounced referral code validation
  useEffect(() => {
    const trimmed = referralCode.trim().toUpperCase();
    if (!trimmed) {
      setReferrerName(null);
      setRefError(null);
      return;
    }

    if (trimmed.length < 4) {
      setReferrerName(null);
      setRefError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setValidatingRef(true);
      try {
        const res = await usersService.validateReferralCode(trimmed);
        if (res.valid) {
          setReferrerName(res.referrerName || 'VeriBuy member');
          setRefError(null);
        } else {
          setReferrerName(null);
          setRefError('Invalid or unrecognised referral code');
        }
      } catch {
        setReferrerName(null);
        setRefError('Unable to verify referral code');
      } finally {
        setValidatingRef(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [referralCode]);

  const onSubmit = async () => {
    if (!name || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await register(
        name.trim(),
        email.trim(),
        password,
        referralCode.trim() || undefined,
      );
      router.replace(result.autoVerified ? '/(main)' : '/check-email');
    } catch (e: any) {
      setError(e?.message || 'Registration failed');
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
          {/* Top Bar */}
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity
              onPress={() => router.push('/login')}
              className="w-9 h-9 rounded-full bg-white border border-borderc items-center justify-center shadow-xs"
            >
              <Text className="text-base font-bold text-text">‹</Text>
            </TouchableOpacity>

            <BrandLogo height={44} />

            <View className="w-9 h-9 rounded-full bg-[#0B192C] items-center justify-center">
              <Text className="text-white text-xs font-bold">👤</Text>
            </View>
          </View>

          {/* Top Card: Segmented Toggle */}
          <View className="bg-white rounded-2xl border border-borderc p-4 mb-4 shadow-xs items-center">
            <View className="flex-row items-center justify-between w-full mb-3">
              <View className="bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                <Text className="text-emerald-700 text-[10px] font-extrabold">🛡️ 0% SELLER COMMISSION</Text>
              </View>
              <Text className="text-[10px] font-bold text-slate-600">Free Registration</Text>
            </View>

            <Text className="text-text font-black text-xl mb-1">Create VeriBuy Account</Text>
            <Text className="text-text-muted text-xs text-center px-4 leading-relaxed mb-4">
              Join thousands of UK tech enthusiasts trading with 100% escrow protection.
            </Text>

            {/* Segmented Control */}
            <View className="flex-row bg-[#eff4ff] p-1 rounded-xl w-full">
              <TouchableOpacity
                onPress={() => router.push('/login')}
                className="flex-1 py-2 items-center"
              >
                <Text className="text-text font-bold text-xs">→] Sign In</Text>
              </TouchableOpacity>
              <View className="flex-1 bg-[#0B192C] py-2 rounded-lg items-center shadow-xs">
                <Text className="text-white text-xs font-black">👤+ Create Account</Text>
              </View>
            </View>
          </View>

          {/* ── Social Sign Up Buttons (Apple & Google) ── */}
          <View className="space-y-2 mb-4">
            <TouchableOpacity
              onPress={() => onSocialAuth('APPLE')}
              disabled={loading || Boolean(socialLoading)}
              className="bg-white border border-borderc rounded-2xl p-3 flex-row items-center justify-between shadow-xs active:bg-slate-50"
            >
              <View className="flex-row items-center gap-2.5">
                <Text className="text-base"></Text>
                <Text className="text-text font-bold text-xs">Sign up with Apple</Text>
              </View>
              <View className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                <Text className="text-[9px] font-bold text-slate-700">
                  {socialLoading === 'APPLE' ? 'Setting up...' : '⚡ Instant'}
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
                <Text className="text-text font-bold text-xs">Sign up with Google</Text>
              </View>
              <View className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                <Text className="text-[9px] font-bold text-slate-700">
                  {socialLoading === 'GOOGLE' ? 'Setting up...' : '🔒 Passkey'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Divider ── */}
          <View className="flex-row items-center my-2 mb-4">
            <View className="flex-1 h-[1px] bg-slate-200" />
            <Text className="text-[10px] font-bold text-text-muted px-3 uppercase tracking-wider">
              Or register with email
            </Text>
            <View className="flex-1 h-[1px] bg-slate-200" />
          </View>

          {/* Form Card */}
          <View className="bg-white rounded-2xl border border-borderc p-4 mb-4 shadow-xs">
            {/* Full Name */}
            <View className="mb-3">
              <Text className="text-xs font-bold text-text mb-1">Full Name *</Text>
              <View className="flex-row items-center bg-[#eff4ff] border border-borderc rounded-xl px-3 py-2.5">
                <Text className="text-sm mr-2 text-text-muted">👤</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Alex Jenkins"
                  placeholderTextColor="#94A3B8"
                  className="flex-1 text-text text-xs font-medium"
                />
              </View>
            </View>

            {/* Email Address */}
            <View className="mb-3">
              <Text className="text-xs font-bold text-text mb-1">Email Address *</Text>
              <View className="flex-row items-center bg-[#eff4ff] border border-borderc rounded-xl px-3 py-2.5">
                <Text className="text-sm mr-2 text-text-muted">✉️</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="alex.jenkins@example.co.uk"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="flex-1 text-text text-xs font-medium"
                />
              </View>
            </View>

            {/* Password */}
            <View className="mb-3">
              <Text className="text-xs font-bold text-text mb-1">Password * (8+ chars)</Text>
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

            {/* Referral Code */}
            <View className="mb-3">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-xs font-bold text-text">Referral Code (Optional)</Text>
                <Text className="text-[10px] font-bold text-emerald-700">🎁 £5 Bonus</Text>
              </View>
              <View className="flex-row items-center bg-[#eff4ff] border border-borderc rounded-xl px-3 py-2.5">
                <Text className="text-sm mr-2 text-text-muted">🏷️</Text>
                <TextInput
                  value={referralCode}
                  onChangeText={(text) => setReferralCode(text.toUpperCase())}
                  placeholder="e.g. VB-A1B2C3"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  className="flex-1 text-text text-xs font-medium"
                />
              </View>
            </View>

            {validatingRef ? (
              <Text className="text-xs text-text-muted -mt-1 mb-3">Checking referral code…</Text>
            ) : referrerName ? (
              <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
                <Text className="text-xs font-bold text-emerald-800">
                  🎁 Referral Applied ({referrerName})
                </Text>
                <Text className="text-[11px] text-emerald-700 mt-0.5 leading-snug">
                  {referrerName} will receive their £5 bonus once you complete your first sale on VeriBuy.
                </Text>
              </View>
            ) : refError && referralCode.trim().length >= 4 ? (
              <Text className="text-xs text-rose-600 -mt-1 mb-3 font-medium">{refError}</Text>
            ) : null}

            {error ? (
              <Text className="text-rose-600 text-xs mb-3 font-medium">{error}</Text>
            ) : null}

            {/* Submit Button */}
            <TouchableOpacity
              onPress={onSubmit}
              disabled={loading}
              className="bg-[#059669] py-3.5 rounded-xl flex-row items-center justify-center gap-2 active:opacity-90 shadow-sm"
            >
              <Text className="text-white text-xs">🔒</Text>
              <Text className="text-white font-black text-xs tracking-wide">
                {loading ? 'Creating Account...' : 'Complete Registration →'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Trust Footer */}
          <View className="items-center mt-2">
            <View className="bg-white/80 border border-borderc px-3 py-1 rounded-full flex-row items-center gap-1.5 mb-2 shadow-xs">
              <Text className="text-[10px] text-emerald-700 font-bold">🔒 100% Escrow &amp; Bank-Grade Security</Text>
            </View>
            <Text className="text-[10px] text-text-muted text-center px-6 leading-relaxed">
              By registering you agree to the VeriBuy Marketplace Terms and 48-Hour Inspection Guidelines.
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
                Sign up with {socialModalProvider === 'GOOGLE' ? 'Google' : 'Apple'}
              </Text>
              <Text className="text-xs text-slate-500 text-center mt-1">
                Enter your {socialModalProvider === 'GOOGLE' ? 'Google' : 'Apple'} email address. We will verify your account.
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
                    executeSocialAuth(socialModalProvider, socialEmailInput.trim());
                  }
                }}
                disabled={!socialEmailInput.trim() || Boolean(socialLoading)}
                className="flex-1 py-3 rounded-xl bg-slate-900 items-center justify-center disabled:opacity-50"
              >
                <Text className="text-xs font-bold text-white">
                  {socialLoading ? 'Verifying...' : 'Continue'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
