import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Screen } from '@/src/components/ui';
import { authService } from '@/src/services';

export default function CheckEmailScreen() {
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleResend = async () => {
    setResending(true);
    setResendStatus('idle');
    setErrorMessage('');
    try {
      await authService.sendVerification();
      setResendStatus('sent');
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to resend verification email.');
      setResendStatus('error');
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Text className="text-2xl font-bold text-primary mb-3">Check your email</Text>
        <Text className="text-text-muted mb-6">
          We&apos;ve sent a verification link to your email address. Click the link to activate
          your account. The link expires in 24 hours.
        </Text>

        <View className="border-t border-borderc pt-6">
          <Text className="text-sm text-text-muted mb-3">
            Didn&apos;t receive it? Check your spam folder or resend.
          </Text>

          {resendStatus === 'sent' ? (
            <Text className="text-success text-sm font-medium">
              Verification email resent! Please check your inbox.
            </Text>
          ) : (
            <>
              <Button onPress={handleResend} loading={resending}>
                Resend verification email
              </Button>
              {resendStatus === 'error' ? (
                <Text className="text-danger text-sm mt-3">{errorMessage}</Text>
              ) : null}
            </>
          )}
        </View>

        <Text className="mt-6 text-sm text-text-muted text-center">
          Already verified?{' '}
          <Text className="text-primary font-medium" onPress={() => router.replace('/')}>
            Sign in
          </Text>
        </Text>
      </View>
    </Screen>
  );
}
