import { ComponentRef, useRef, useState } from 'react';
import { Platform, TextInput } from 'react-native';

/**
 * iOS empties a secure field on the next keystroke after it's re-masked, sending
 * an empty value and then only the new characters. This puts the text back.
 */
export function restoreAfterRemask(kept: string, next: string): string {
  return next.startsWith(kept) ? next : kept + next;
}

/**
 * Show or hide state for a password field. On Android, keyboards suggest and learn
 * whatever they see in a plain text field, so showing the password closes the
 * keyboard and tapping back into the field masks it again.
 */
export function usePasswordVisibility(value: string | undefined, onChangeText?: (text: string) => void) {
  const [revealed, setRevealed] = useState(false);
  // The text to protect after re-masking on iOS, until the field has caught up with it.
  const restoring = useRef<string | null>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  return {
    revealed,
    inputRef,
    toggle: () => {
      restoring.current = revealed && Platform.OS === 'ios' ? (value ?? '') : null;
      if (!revealed && Platform.OS === 'android') inputRef.current?.blur();
      setRevealed(!revealed);
    },
    onFocus: () => {
      if (Platform.OS === 'android') setRevealed(false);
    },
    onChangeText: (text: string) => {
      const kept = restoring.current;
      if (kept === null || text.startsWith(kept)) {
        restoring.current = null;
        onChangeText?.(text);
        return;
      }
      onChangeText?.(restoreAfterRemask(kept, text));
    },
  };
}
