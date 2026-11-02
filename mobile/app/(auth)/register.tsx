import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { usersService } from '@/src/services';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [validatingRef, setValidatingRef] = useState(false);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [refError, setRefError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    <Screen safeTop>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center justify-between h-12 mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="w-10 h-10 -ml-2 items-center justify-center"
            >
              <Ionicons name="chevron-back" size={24} color="#232F3E" />
            </TouchableOpacity>
            <BrandLogo height={40} />
            <View className="w-10" />
          </View>

          <Text className="text-[28px] font-bold text-text">Create your account</Text>
          <Text className="text-[15px] text-text-muted mt-1 mb-6 leading-[22px]">
            Buy with protection, or sell with 0% seller commission.
          </Text>

          <Field label="Full name" icon="person-outline" placeholder="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
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
          />
          <Field
            label="Password"
            icon="lock-closed-outline"
            placeholder="Choose a password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <Field
            label="Referral code (optional)"
            icon="pricetag-outline"
            placeholder="If a friend invited you"
            value={referralCode}
            onChangeText={(value) => setReferralCode(value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          {validatingRef ? (
            <Text className="text-[13px] text-text-muted -mt-2 mb-4">Checking referral code…</Text>
          ) : referrerName ? (
            <Text className="text-[13px] text-emerald-800 -mt-2 mb-4 leading-[18px]">
              Referred by {referrerName}. They earn £5 when you complete your first sale.
            </Text>
          ) : refError && referralCode.trim().length >= 4 ? (
            <Text className="text-[13px] text-danger -mt-2 mb-4">{refError}</Text>
          ) : null}

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
            <Text className="text-white text-[15px] font-semibold">{loading ? 'Creating account…' : 'Create account'}</Text>
          </TouchableOpacity>

          <View className="flex-row justify-center mt-5">
            <Text className="text-sm text-text-muted">Already have an account? </Text>
            <Link href="/login" style={{ color: '#256A44' }} className="text-sm font-semibold">
              Sign in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
