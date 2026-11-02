import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { Button, Input, Screen, KeyboardArea } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { usersService } from '@/src/services';

const WHAT_HAPPENS = [
  'Your name, email, phone number and saved address are removed.',
  'Your listings are taken down and open offers are withdrawn.',
  'You won’t be able to sign in again, and this can’t be undone.',
  'We keep basic order and invoice records where the law requires it, without your contact details.',
];

export default function CloseAccountScreen() {
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = async () => {
    setBusy(true);
    setError('');
    try {
      await usersService.closeAccount(password);
      await logout().catch(() => undefined);
      router.replace('/(main)');
      Alert.alert('Account closed', 'Your account has been closed. Thanks for using VeriBuy.');
    } catch (e: any) {
      setError(e?.message || 'We could not close your account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!password) {
      setError('Enter your password to confirm.');
      return;
    }
    Alert.alert('Close your account?', 'This can’t be undone.', [
      { text: 'Keep my account', style: 'cancel' },
      { text: 'Close account', style: 'destructive', onPress: close },
    ]);
  };

  return (
    <Screen>
      <KeyboardArea>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Text className="text-[15px] font-semibold text-text mb-2">What happens when you close your account</Text>
        <View className="bg-surface border border-borderc rounded-2xl p-4 mb-5 gap-2.5">
          {WHAT_HAPPENS.map((line) => (
            <Text key={line} className="text-sm text-text-muted leading-5">
              {line}
            </Text>
          ))}
        </View>
        <Input
          label="Your password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError('');
          }}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          error={error || undefined}
        />
        <Button variant="danger" onPress={confirm} loading={busy}>
          Close my account
        </Button>
      </ScrollView>
      </KeyboardArea>
    </Screen>
  );
}
