'use client';

import { useState, useEffect } from 'react';
import {
  Phone,
  ShieldCheck,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhoneVerificationModalProps {
  isOpen: boolean;
  initialPhone?: string;
  onClose: () => void;
  onVerified: (phone: string) => void;
}

export function PhoneVerificationModal({
  isOpen,
  initialPhone = '',
  onClose,
  onVerified,
}: PhoneVerificationModalProps) {
  const [step, setStep] = useState<'input' | 'otp' | 'success'>('input');
  const [phone, setPhone] = useState(initialPhone);
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (initialPhone) setPhone(initialPhone);
  }, [initialPhone]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  if (!isOpen) return null;

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phone.trim()) {
      setError('Please enter a UK phone number');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/phone/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to send verification SMS');
      }

      setStep('otp');
      setCountdown(60);
      if (data.devOtp) {
        setDevOtp(data.devOtp);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send SMS. Please check the number.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setError('Please enter the 6-digit code sent to your phone');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          code: otpCode.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Invalid or expired verification code');
      }

      setStep('success');
      setTimeout(() => {
        onVerified(data.phone || phone);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-100 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step 1: Phone input */}
        {step === 'input' && (
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[var(--color-green)] flex items-center justify-center mb-4 border border-emerald-100">
              <Phone className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-1">Verify UK Phone Number</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              We will send a 6-digit SMS code to verify your mobile number for secure escrow dispatch notifications.
            </p>

            {error && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  UK Mobile / Phone Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 07123 456789 or +44 7123 456789"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[var(--color-green)] focus:outline-none focus:border-transparent"
                  />
                </div>
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Supports standard UK prefixes (+44 7... or 07...)
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || !phone.trim()}
                className="w-full py-3.5 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending SMS Code...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Send SMS Verification Code</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: OTP verification */}
        {step === 'otp' && (
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[var(--color-green)] flex items-center justify-center mb-4 border border-emerald-100">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-1">Enter 6-Digit Code</h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              We sent a verification code to <strong className="text-gray-900 font-mono">{phone}</strong>.
            </p>

            {devOtp && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
                <span>Dev Test Code: <strong className="font-mono text-sm tracking-wider">{devOtp}</strong></span>
                <button
                  type="button"
                  onClick={() => setOtpCode(devOtp)}
                  className="px-2 py-1 bg-amber-200 text-amber-900 rounded font-bold hover:bg-amber-300 transition-colors text-[11px]"
                >
                  Auto-fill
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center text-2xl tracking-[0.3em] font-mono py-3 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[var(--color-green)] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full py-3.5 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm &amp; Verify Phone</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="text-gray-500 hover:text-gray-800 font-medium"
                >
                  &larr; Change Phone
                </button>

                {countdown > 0 ? (
                  <span className="text-gray-400">Resend in {countdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    className="text-[var(--color-green)] hover:underline font-bold"
                  >
                    Resend SMS
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-1">Phone Verified!</h3>
            <p className="text-xs text-gray-500">
              Your UK contact number is now verified and active on your account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
