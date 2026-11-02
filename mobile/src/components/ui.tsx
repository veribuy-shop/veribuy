import React, { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PropsWithChildren<T = unknown> = T & { children?: React.ReactNode };

interface ButtonProps extends PropsWithChildren<{
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'accent' | 'green';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}> {}

export function Button({ onPress, variant = 'primary', loading, disabled, style, children }: ButtonProps) {
  const isDisabled = disabled || loading;
  const bg =
    variant === 'primary'
      ? 'bg-primary'
      : variant === 'accent'
      ? 'bg-accent'
      : variant === 'green'
      ? 'bg-green'
      : variant === 'secondary'
      ? 'bg-surface border border-border-strong'
      : variant === 'danger'
      ? 'bg-danger'
      : 'bg-transparent';
  const textColor =
    variant === 'outline'
      ? 'text-primary'
      : variant === 'accent'
      ? 'text-primary-dark font-black'
      : variant === 'secondary'
      ? 'text-text'
      : 'text-white';
  const border = variant === 'outline' ? 'border border-borderc' : '';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`${bg} ${border} min-h-12 py-3 px-4 rounded-xl items-center justify-center ${isDisabled ? 'opacity-50' : 'active:opacity-90'}`}
      style={style}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'accent' ? '#232F3E' : '#fff'} />
      ) : (
        <Text className={`${textColor} font-semibold text-[15px]`}>{children}</Text>
      )}
    </Pressable>
  );
}

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

const NUMERIC_KEYBOARDS = ['number-pad', 'decimal-pad', 'numeric', 'phone-pad'];

export function Input({ label, error, onFocus, onBlur, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  // iOS number pads have no return key, so give people a way to close them.
  const showDone = focused && NUMERIC_KEYBOARDS.includes(props.keyboardType ?? '');

  return (
    <View className="mb-4">
      {label ? <Text className="text-[13px] font-medium text-text mb-1.5">{label}</Text> : null}
      <View className="justify-center">
        <TextInput
          placeholderTextColor="#8A8A8A"
          className={`bg-surface border rounded-xl px-3.5 min-h-12 py-3 text-[15px] text-text ${error ? 'border-danger' : 'border-border-strong'}`}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {showDone ? (
          <Pressable
            onPress={Keyboard.dismiss}
            accessibilityRole="button"
            accessibilityLabel="Done"
            className="absolute right-1 h-10 px-3 items-center justify-center"
          >
            <Text className="text-[15px] font-semibold text-emerald-700">Done</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="text-[13px] text-danger mt-1">{error}</Text> : null}
    </View>
  );
}

export function Screen({ children, style, safeTop }: PropsWithChildren<{ style?: ViewStyle; safeTop?: boolean }>) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-surface-canvas px-4 pt-4" style={[safeTop ? { paddingTop: insets.top + 8 } : null, style]}>
      {children}
    </View>
  );
}

/**
 * Keeps a scrolling form above the keyboard under a native header. iOS scroll
 * views handle this with automaticallyAdjustKeyboardInsets, which Android ignores.
 */
export function KeyboardArea({ children }: PropsWithChildren) {
  const headerHeight = useHeaderHeight();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'android' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export function Card({ children, style, className }: PropsWithChildren<{ style?: ViewStyle; className?: string }>) {
  return (
    <View className={`bg-surface rounded-2xl border border-borderc p-4 mb-3 shadow-sm ${className || ''}`} style={style}>
      {children}
    </View>
  );
}

export function Tag({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <View className={`rounded-full px-2.5 py-0.5 ${className || 'bg-surface-alt border border-borderc'}`}>
      <Text className="text-xs font-semibold">{children}</Text>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="py-16 items-center">
      <Text className="text-text font-bold text-lg">{title}</Text>
      {subtitle ? <Text className="text-sm text-text-muted mt-1 text-center px-4">{subtitle}</Text> : null}
    </View>
  );
}

export function LoadingState() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <ActivityIndicator size="large" color="#2D7A4F" />
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const normalized = status?.toUpperCase() || '';
  let color = 'bg-surface-alt text-text';
  let label = normalized.charAt(0) + normalized.slice(1).toLowerCase().replace(/_/g, ' ');

  if (normalized === 'ACTIVE' || normalized === 'COMPLETED' || normalized === 'PASSED') {
    color = 'bg-grade-a-bg text-grade-a-text border border-emerald-200';
    if (normalized === 'PASSED') label = 'Trust Lens: Verified';
  } else if (normalized === 'ESCROW_HELD' || normalized === 'PAID' || normalized === 'PAYMENT_RECEIVED') {
    color = 'bg-amber-50 text-amber-800 border border-amber-200';
    label = 'Payment held';
  } else if (normalized === 'SHIPPED') {
    color = 'bg-grade-b-bg text-grade-b-text border border-blue-200';
    label = 'Dispatched';
  } else if (normalized === 'DELIVERED') {
    color = 'bg-indigo-50 text-indigo-800 border border-indigo-200';
    label = 'Delivered';
  } else if (normalized === 'DISPUTED' || normalized === 'FAILED' || normalized === 'REJECTED' || normalized === 'CANCELLED') {
    color = 'bg-discount-crimson-bg text-discount-crimson border border-rose-200';
    label = normalized === 'DISPUTED' ? 'Under review' : 'Cancelled';
  }

  return (
    <View className={`px-2.5 py-0.5 rounded-full ${color}`}>
      <Text className="text-[11px] font-semibold">{label}</Text>
    </View>
  );
}

