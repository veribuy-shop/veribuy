'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConfirmVariant = 'danger' | 'warning';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  loadingLabel?: string;
  variant?: ConfirmVariant;
}

const variantConfig: Record<ConfirmVariant, {
  iconBg: string;
  iconColor: string;
  buttonBg: string;
  icon: typeof AlertTriangle;
}> = {
  danger: {
    iconBg: 'bg-red-50',
    iconColor: 'text-[var(--color-danger)]',
    buttonBg: 'bg-[var(--color-danger)]',
    icon: AlertTriangle,
  },
  warning: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    buttonBg: 'bg-amber-600',
    icon: AlertTriangle,
  },
};

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isLoading = false,
  loadingLabel = 'Processing...',
  variant = 'danger',
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl border border-[var(--color-border)] p-6 max-w-md w-full mx-4"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={cn('flex items-center justify-center w-10 h-10 rounded-full', config.iconBg)}>
            <Icon className={cn('w-5 h-5', config.iconColor)} />
          </div>
          <h3 id="confirm-modal-title" className="text-lg font-semibold text-[var(--color-text)]">
            {title}
          </h3>
        </div>
        <p id="confirm-modal-desc" className="text-sm text-[var(--color-text-muted)] mb-4">
          {description}
        </p>

        {children && (
          <div className="bg-[var(--color-surface-alt)] rounded-lg p-3 mb-6">
            {children}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-[var(--color-text)] bg-[var(--color-surface-alt)] rounded-lg hover:bg-[var(--color-border)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2',
              config.buttonBg,
            )}
          >
            {isLoading && (
              <div className="motion-safe:animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
            )}
            {isLoading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
