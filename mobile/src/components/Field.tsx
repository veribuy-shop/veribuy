import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

export function Field({
  label,
  icon,
  error,
  trailing,
  ...props
}: TextInputProps & { label: string; icon: keyof typeof Ionicons.glyphMap; error?: boolean; trailing?: React.ReactNode }) {
  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-1.5">
        <Text className="text-[13px] font-medium text-text">{label}</Text>
        {trailing}
      </View>
      <View className={`flex-row items-center h-12 px-3.5 rounded-xl bg-surface border ${error ? 'border-danger' : 'border-border-strong'}`}>
        <Ionicons name={icon} size={18} color="#6F7373" />
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#8A8A8A"
          className="flex-1 ml-2.5 text-[15px] text-text"
          {...props}
        />
      </View>
    </View>
  );
}
