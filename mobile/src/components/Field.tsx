import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, TextInput, TextInputProps, View } from 'react-native';

import { usePasswordVisibility } from '../lib/password-visibility';

export function Field({
  label,
  icon,
  error,
  trailing,
  ...props
}: TextInputProps & { label: string; icon: keyof typeof Ionicons.glyphMap; error?: boolean; trailing?: React.ReactNode }) {
  const password = usePasswordVisibility(props.value, props.onChangeText);
  const isPassword = !!props.secureTextEntry;

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-1.5">
        <Text className="text-[13px] font-medium text-text">{label}</Text>
        {trailing}
      </View>
      <View className={`flex-row items-center h-12 px-3.5 rounded-xl bg-surface border ${error ? 'border-danger' : 'border-border-strong'}`}>
        <Ionicons name={icon} size={18} color="#6F7373" />
        <TextInput
          ref={password.inputRef}
          accessibilityLabel={label}
          placeholderTextColor="#8A8A8A"
          className="flex-1 ml-2.5 text-[15px] text-text"
          {...props}
          {...(isPassword ? { secureTextEntry: !password.revealed, onChangeText: password.onChangeText, onFocus: (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => { password.onFocus(); props.onFocus?.(e); }, autoCapitalize: 'none' as const, autoCorrect: false, spellCheck: false } : {})}
        />
        {isPassword ? (
          <Pressable
            onPress={password.toggle}
            accessibilityRole="button"
            accessibilityLabel={password.revealed ? 'Hide password' : 'Show password'}
            hitSlop={12}
            className="ml-2 h-10 w-8 items-center justify-center"
          >
            <Ionicons name={password.revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color="#565959" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
