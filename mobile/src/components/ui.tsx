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

interface ButtonProps extends PropsWithChildren<{ onPress: () => void; variant?: 'primary' | 'secondary' | 'outline' | 'danger'; loading?: boolean; disabled?: boolean; style?: ViewStyle }> {}

export function Button({ onPress, variant = 'primary', loading, disabled, style, children }: ButtonProps) {
  const isDisabled = disabled || loading;
  const bg = variant === 'primary' ? 'bg-primary' : variant === 'secondary' ? 'bg-surface-alt' : variant === 'danger' ? 'bg-danger' : 'bg-transparent';
  const textColor = variant === 'outline' ? 'text-primary' : variant === 'secondary' ? 'text-text' : 'text-white';
  const border = variant === 'outline' ? 'border border-borderc' : '';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`${bg} ${border} py-3 px-4 rounded-lg items-center justify-center ${isDisabled ? 'opacity-50' : ''}`}
      style={style}
    >
      {loading ? <ActivityIndicator color={variant === 'outline' ? '#232F3E' : '#fff'} /> : <Text className={`${textColor} font-semibold`}>{children}</Text>}
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
    <View className="flex-1 bg-warm-beige px-4 pt-4" style={style}>
      {children}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return (
    <View className="bg-surface rounded-xl border border-borderc p-4 mb-3" style={style}>
      {children}
    </View>
  );
}

export function Tag({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <View className={`rounded-full px-2 py-0.5 ${className || 'bg-warm-beige'}`}>
      <Text className="text-xs">{children}</Text>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="py-16 items-center">
      <Text className="text-text-muted text-lg">{title}</Text>
      {subtitle ? <Text className="text-sm text-warm-tan mt-1">{subtitle}</Text> : null}
    </View>
  );
}

export function LoadingState() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <ActivityIndicator size="large" color="#232F3E" />
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const normalized = status?.toUpperCase() || '';
  let color = 'bg-warm-beige text-text';
  let label = normalized.replace('_', ' ');

  if (normalized === 'ACTIVE' || normalized === 'COMPLETED' || normalized === 'PASSED') {
    color = 'bg-emerald-100 text-emerald-800';
    if (normalized === 'PASSED') label = 'Trust Lens: Verified';
  } else if (normalized === 'ESCROW_HELD' || normalized === 'PAID' || normalized === 'PAYMENT_RECEIVED') {
    color = 'bg-amber-100 text-amber-800';
    label = 'In Escrow';
  } else if (normalized === 'SHIPPED') {
    color = 'bg-blue-100 text-blue-800';
    label = 'Dispatched';
  } else if (normalized === 'DELIVERED') {
    color = 'bg-indigo-100 text-indigo-800';
    label = 'Delivered (48h Check)';
  } else if (normalized === 'DISPUTED' || normalized === 'FAILED' || normalized === 'REJECTED' || normalized === 'CANCELLED') {
    color = 'bg-red-100 text-red-800';
  } else if (normalized === 'REQUIRES_REVIEW' || normalized === 'PENDING') {
    color = 'bg-amber-50 text-amber-700';
    if (normalized === 'REQUIRES_REVIEW') label = 'Under Review';
  } else if (normalized === 'SOLD') {
    color = 'bg-slate-200 text-slate-800';
  }

  return (
    <View className={`rounded-full px-2.5 py-1 ${color.split(' ')[0]}`}>
      <Text className={`text-[11px] font-semibold ${color.split(' ')[1]}`}>{label || status}</Text>
    </View>
  );
}

