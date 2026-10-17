import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

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
      ? 'bg-surface-alt'
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
      className={`${bg} ${border} py-3 px-4 rounded-xl items-center justify-center ${isDisabled ? 'opacity-50' : 'active:opacity-90'}`}
      style={style}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'accent' ? '#232F3E' : '#fff'} />
      ) : (
        <Text className={`${textColor} font-bold text-sm`}>{children}</Text>
      )}
    </Pressable>
  );
}

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  return (
    <View className="mb-3">
      {label ? <Text className="text-sm text-text-muted mb-1">{label}</Text> : null}
      <TextInput
        placeholderTextColor="#AAAAAA"
        className={`bg-surface border rounded-lg px-3 py-3 text-text ${error ? 'border-danger' : 'border-borderc'}`}
        {...props}
      />
      {error ? <Text className="text-xs text-danger mt-1">{error}</Text> : null}
    </View>
  );
}

export function Screen({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return (
    <View className="flex-1 bg-surface-canvas px-4 pt-4" style={style}>
      {children}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return (
    <View className="bg-surface rounded-2xl border border-borderc p-4 mb-3 shadow-sm" style={style}>
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
      <ActivityIndicator size="large" color="#059669" />
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const normalized = status?.toUpperCase() || '';
  let color = 'bg-surface-alt text-text';
  let label = normalized.replace('_', ' ');

  if (normalized === 'ACTIVE' || normalized === 'COMPLETED' || normalized === 'PASSED') {
    color = 'bg-grade-a-bg text-grade-a-text border border-emerald-200';
    if (normalized === 'PASSED') label = 'Trust Lens: Verified';
  } else if (normalized === 'ESCROW_HELD' || normalized === 'PAID' || normalized === 'PAYMENT_RECEIVED') {
    color = 'bg-amber-50 text-amber-800 border border-amber-200';
    label = 'In Escrow';
  } else if (normalized === 'SHIPPED') {
    color = 'bg-grade-b-bg text-grade-b-text border border-blue-200';
    label = 'Dispatched';
  } else if (normalized === 'DELIVERED') {
    color = 'bg-indigo-50 text-indigo-800 border border-indigo-200';
    label = 'Delivered (48h Check)';
  } else if (normalized === 'DISPUTED' || normalized === 'FAILED' || normalized === 'REJECTED' || normalized === 'CANCELLED') {
    color = 'bg-discount-crimson-bg text-discount-crimson border border-rose-200';
    label = normalized === 'DISPUTED' ? 'Under Review' : 'Cancelled';
  }

  return (
    <View className={`px-2.5 py-0.5 rounded-full ${color}`}>
      <Text className="text-[10px] font-bold">{label}</Text>
    </View>
  );
}

