import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { BrandLogo } from '@/src/components/BrandLogo';
import { Field } from '@/src/components/Field';
import { Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/lib/api';
import { openLegalPage } from '@/src/lib/legal';
import { usersService } from '@/src/services';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [postcodeNote, setPostcodeNote] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
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

  // Same check as the web form: confirm the postcode and suggest the town.
  useEffect(() => {
    const clean = postalCode.replace(/\s+/g, '').toUpperCase();
    if (clean.length < 5) {
      setPostcodeNote('');
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.public.get<{ valid: boolean; adminCounty?: string; adminDistrict?: string; postcode?: string }>(
          `/auth/postcode-lookup/${encodeURIComponent(clean)}`,
        );
        if (res?.valid) {
          setPostcodeNote('');
          const town = res.adminDistrict || res.adminCounty;
          if (town) setCity((current) => current || town);
          if (res.postcode) setPostalCode(res.postcode);
        } else {
          setPostcodeNote('We can’t find that postcode. Please check it.');
        }
      } catch {
        // The lookup is a convenience; the address can still be typed.
        setPostcodeNote('');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [postalCode]);

  const accountProblem = (): string | null => {
    if (name.trim().length < 2) return 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return 'Use at least 8 characters with upper and lower case letters, a number and a symbol.';
    }
    return null;
  };

  const onContinue = () => {
    const problem = accountProblem();
    setError(problem ?? '');
    if (!problem) {
      Keyboard.dismiss();
      setStep(2);
    }
  };

  const onSubmit = async () => {
    if (phone.trim().length < 10) {
      setError('Enter your phone number.');
      return;
    }
    if (line1.trim().length < 3 || city.trim().length < 2 || postalCode.trim().length < 5) {
      setError('Enter your address, town and postcode.');
      return;
    }
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        line1: line1.trim(),
        ...(line2.trim() ? { line2: line2.trim() } : {}),
        city: city.trim(),
        postalCode: postalCode.trim().toUpperCase(),
        referralCode: referralCode.trim() || undefined,
        acceptedTerms: agreedToTerms,
      });
      router.replace(result.autoVerified ? '/(main)' : '/check-email');
    } catch (e: any) {
      setError(e?.message || 'We could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen safeTop>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center justify-between h-12 mb-4">
            <TouchableOpacity
              onPress={() => (step === 2 ? setStep(1) : router.back())}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="w-10 h-10 -ml-2 items-center justify-center"
            >
              <Ionicons name="chevron-back" size={24} color="#232F3E" />
            </TouchableOpacity>
            <BrandLogo height={40} />
            <View className="w-10" />
          </View>

          <Text className="text-[28px] font-bold text-text">{step === 1 ? 'Create your account' : 'Your UK address'}</Text>
          <Text className="text-[15px] text-text-muted mt-1 mb-6 leading-[22px]">
            {step === 1
              ? 'Buy with protection, or sell with 0% seller commission.'
              : 'Used for delivery and return labels. Buyers and sellers only see it when an order needs it.'}
          </Text>

          {step === 1 ? (
            <>
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
            placeholder="8+ characters, with a number and symbol"
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

            </>
          ) : (
            <>
              <Field label="Phone number" icon="call-outline" placeholder="07123 456789" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
              <Field label="Address line 1" icon="home-outline" placeholder="House number and street" value={line1} onChangeText={setLine1} autoComplete="street-address" textContentType="streetAddressLine1" />
              <Field label="Address line 2 (optional)" icon="business-outline" placeholder="Flat or building" value={line2} onChangeText={setLine2} textContentType="streetAddressLine2" />
              <Field label="Postcode" icon="location-outline" placeholder="e.g. M1 1AE" value={postalCode} onChangeText={(value) => setPostalCode(value.toUpperCase())} autoCapitalize="characters" autoCorrect={false} autoComplete="postal-code" textContentType="postalCode" error={!!postcodeNote} />
              {postcodeNote ? <Text className="text-[13px] text-danger -mt-2 mb-4">{postcodeNote}</Text> : null}
              <Field label="Town or city" icon="map-outline" value={city} onChangeText={setCity} textContentType="addressCity" />
              <View className="flex-row items-start mb-4">
                <Pressable
                  onPress={() => {
                    setAgreedToTerms((agreed) => !agreed);
                    setError('');
                  }}
                  accessibilityRole="checkbox"
                  accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
                  accessibilityState={{ checked: agreedToTerms }}
                  hitSlop={10}
                  className={`w-6 h-6 rounded-md border items-center justify-center mr-3 mt-0.5 ${agreedToTerms ? 'bg-primary border-primary' : 'bg-surface border-border-strong'}`}
                >
                  {agreedToTerms ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                </Pressable>
                <Text className="flex-1 text-[13px] text-text-muted leading-5">
                  I agree to the{' '}
                  <Text onPress={() => openLegalPage('terms')} accessibilityRole="link" className="font-semibold text-green">
                    Terms of Service
                  </Text>{' '}
                  and{' '}
                  <Text onPress={() => openLegalPage('privacy')} accessibilityRole="link" className="font-semibold text-green">
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </View>
            </>
          )}

          {error ? (
            <Text accessibilityLiveRegion="polite" className="text-sm text-danger mb-3">
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={step === 1 ? onContinue : onSubmit}
            disabled={loading}
            accessibilityRole="button"
            className={`h-12 rounded-xl bg-primary items-center justify-center ${loading ? 'opacity-60' : 'active:opacity-90'}`}
          >
            <Text className="text-white text-[15px] font-semibold">{step === 1 ? 'Continue' : loading ? 'Creating account…' : 'Create account'}</Text>
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
