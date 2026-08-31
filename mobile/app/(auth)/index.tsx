import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { Button, Input, Screen } from '@/src/components/ui';
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
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center"
      >
        <View className="mb-6">
          <Text className="text-3xl font-bold text-primary">VeriBuy</Text>
          <Text className="text-text-muted mt-1">Verified electronics marketplace</Text>
        </View>

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        {error ? <Text className="text-danger text-sm mb-2">{error}</Text> : null}

        <Button onPress={onSubmit} loading={loading}>
          Sign in
        </Button>

        <Link href="/forgot-password" className="text-primary text-center mt-3">
          Forgot password?
        </Link>

        <Link href="/register" className="text-primary text-center mt-6 font-semibold">
          Create an account
        </Link>
      </KeyboardAvoidingView>
    </Screen>
  );
}
