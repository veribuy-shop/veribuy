import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { Button, Input, Screen } from '@/src/components/ui';
import { authService } from '@/src/services';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const onSubmit = async () => {
    if (!email) return;
    setLoading(true);
    setMessage('');
    try {
      await authService.forgotPassword(email.trim());
      setMessage('If that email is registered, a reset link has been sent.');
    } catch {
      setMessage('If that email is registered, a reset link has been sent.');
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
        <Text className="text-2xl font-bold text-primary mb-2">Reset password</Text>
        <Text className="text-text-muted mb-6">
          Enter your email and we'll send you a link to reset your password.
        </Text>

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        {message ? <Text className="text-success text-sm mb-2">{message}</Text> : null}

        <Button onPress={onSubmit} loading={loading}>
          Send reset link
        </Button>

        <View className="mt-4">
          <Link href="/" className="text-primary text-center">
            Back to sign in
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
