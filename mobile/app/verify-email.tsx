import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Screen } from '@/src/components/ui';
import { authService } from '@/src/services';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const hasCalled = useRef(false);

  useEffect(() => {
    if (hasCalled.current) return;
    hasCalled.current = true;

    if (!token) {
      setErrorMessage('Missing verification token. Please use the link from your email.');
      setStatus('error');
      return;
    }

    (async () => {
      try {
        await authService.verifyEmail(token);
        setStatus('success');
        setTimeout(() => router.replace('/'), 3000);
      } catch (e: any) {
        setErrorMessage(e?.message || 'Verification failed. The link may have expired.');
        setStatus('error');
      }
    })();
  }, [token]);

  return (
    <Screen>
      <View className="flex-1 justify-center">
        {status === 'verifying' && (
          <>
            <Text className="text-2xl font-bold text-primary mb-2">Verifying your email</Text>
            <Text className="text-text-muted">Please wait a moment…</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <Text className="text-2xl font-bold text-primary mb-3">Email verified!</Text>
            <Text className="text-text-muted mb-6">
              Your account is now active. Redirecting you to sign in…
            </Text>
            <Button onPress={() => router.replace('/')}>Sign in now</Button>
          </>
        )}

        {status === 'error' && (
          <>
            <Text className="text-2xl font-bold text-primary mb-3">Verification failed</Text>
            <Text className="text-text-muted mb-6">{errorMessage}</Text>
            <Button onPress={() => router.replace('/check-email')}>Resend verification email</Button>
          </>
        )}
      </View>
    </Screen>
  );
}
