'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Coins,
  MapPin,
  Phone,
  Shield,
  CheckCircle2,
  Building2,
  User as UserIcon,
  Gift,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/brand-logo';

const WHY_JOIN = [
  { icon: ShieldCheck, label: '100% Trust Lens™ Verified Hardware' },
  { icon: Lock,        label: 'Stripe Escrow Payment Protection' },
  { icon: Coins,       label: '0% Seller Commission (Keep 100%)' },
  { icon: RotateCcw,  label: '48-Hour Money-Back Guarantee' },
];

function AppleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 170 170" fill="currentColor">
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12.01-14.42-6.1-9.35-10.8-19.74-14.09-31.18-3.29-11.43-4.94-22.38-4.94-32.84 0-14.28 3.59-25.99 10.77-35.13 7.18-9.14 16.29-13.82 27.32-14.04 4.58 0 9.87 1.25 15.87 3.76 6 2.5 9.98 3.76 11.95 3.76 1.77 0 5.86-1.29 12.28-3.87 6.42-2.58 11.75-3.72 15.99-3.41 12.01.62 21.6 4.79 28.77 12.51-10.72 6.53-15.97 15.65-15.75 27.36.21 9.38 3.82 17.18 10.83 23.41 4.14 3.7 8.93 6.33 14.38 7.89-2.22 6.75-4.8 13.23-7.75 19.46zM119.22 33.15c0-6.73 2.45-13.13 7.35-19.2 4.9-6.07 10.9-10.02 18-11.85.22 1.4.33 2.7.33 3.9 0 6.64-2.57 13.08-7.71 19.32-5.14 6.24-11.18 10.15-18.12 11.73-.24-1.3-.35-2.6-.35-3.9z" />
    </svg>
  );
}

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export default function RegisterPage() {
  const { register, socialLogin } = useAuth();
  const [socialLoading, setSocialLoading] = useState<'GOOGLE' | 'APPLE' | null>(null);
  const [socialModalProvider, setSocialModalProvider] = useState<'GOOGLE' | 'APPLE' | null>(null);
  const [socialModalEmail, setSocialModalEmail] = useState('');
  const [socialModalName, setSocialModalName] = useState('');

  const [step, setStep]                   = useState<1 | 2>(1);
  const [accountType, setAccountType]     = useState<'INDIVIDUAL' | 'BUSINESS'>('INDIVIDUAL');
  const [name, setName]                   = useState('');
  const [companyName, setCompanyName]     = useState('');
  const [companyNumber, setCompanyNumber] = useState('');
  const [vatNumber, setVatNumber]         = useState('');
  const [email, setEmail]                 = useState('');
  const [phone, setPhone]                 = useState('');
  const [line1, setLine1]                 = useState('');
  const [line2, setLine2]                 = useState('');
  const [city, setCity]                   = useState('');
  const [postalCode, setPostalCode]       = useState('');
  const [password, setPassword]           = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError]                 = useState('');
  const [loading, setLoading]             = useState(false);

  const triggerSocialSignUp = async (provider: 'GOOGLE' | 'APPLE', targetEmail: string, targetName?: string) => {
    setError('');
    setSocialLoading(provider);
    try {
      await socialLogin(provider, {
        email: targetEmail.trim(),
        name: (targetName || name).trim() || undefined,
        referralCode: referralStatus === 'valid' ? referralCode : undefined,
        action: 'register',
      });
      setSocialModalProvider(null);
    } catch (err: any) {
      setError(err.message || `${provider} sign-up failed. Please try again.`);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleSocialSignUpClick = (provider: 'GOOGLE' | 'APPLE') => {
    setError('');
    if (email.trim()) {
      triggerSocialSignUp(provider, email.trim());
    } else {
      setSocialModalEmail('');
      setSocialModalProvider(provider);
    }
  };

  // Postcode live validation state
  const [postcodeLoading, setPostcodeLoading] = useState(false);
  const [postcodeValid, setPostcodeValid]     = useState<boolean | null>(null);
  const [postcodeDetails, setPostcodeDetails] = useState<string | null>(null);
  const postcodeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Referral code state
  const [referralCode, setReferralCode]       = useState('');
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralStatus, setReferralStatus]   = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [referralMessage, setReferralMessage] = useState<string | null>(null);
  const referralDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const validateReferral = async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) {
      setReferralStatus('idle');
      setReferralMessage(null);
      return;
    }
    setReferralLoading(true);
    try {
      const res = await fetch(`/api/auth/validate-referral?code=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (res.ok && data.valid) {
        setReferralStatus('valid');
        setReferralMessage(data.message || `Invited by ${data.referrerName}`);
      } else {
        setReferralStatus('invalid');
        setReferralMessage(null);
      }
    } catch {
      setReferralStatus('idle');
    } finally {
      setReferralLoading(false);
    }
  };

  const handleReferralCodeChange = (val: string) => {
    const clean = val.toUpperCase();
    setReferralCode(clean);
    if (referralDebounceRef.current) clearTimeout(referralDebounceRef.current);
    if (!clean.trim()) {
      setReferralStatus('idle');
      setReferralMessage(null);
      return;
    }
    referralDebounceRef.current = setTimeout(() => {
      validateReferral(clean);
    }, 400);
  };

  // Check URL query parameters for ?ref=... on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref') || params.get('referral');
      if (ref) {
        const cleanRef = ref.trim().toUpperCase();
        setReferralCode(cleanRef);
        validateReferral(cleanRef);
      }
    }
  }, []);

  // Live Postcode PAF verification
  useEffect(() => {
    const clean = postalCode.trim().replace(/\s+/g, '').toUpperCase();
    if (clean.length < 5) {
      setPostcodeValid(null);
      setPostcodeDetails(null);
      return;
    }

    if (postcodeDebounceRef.current) {
      clearTimeout(postcodeDebounceRef.current);
    }

    postcodeDebounceRef.current = setTimeout(async () => {
      setPostcodeLoading(true);
      try {
        const res = await fetch(`/api/verify-postcode?postcode=${encodeURIComponent(clean)}`);
        const data = await res.json();
        if (res.ok && data.valid) {
          setPostcodeValid(true);
          const location = data.adminCounty || data.adminDistrict || 'UK';
          setPostcodeDetails(`${location}, ${data.country || 'UK'}`);
          if (!city.trim() && (data.adminCounty || data.adminDistrict)) {
            setCity(data.adminCounty || data.adminDistrict);
          }
          if (data.postcode) {
            setPostalCode(data.postcode);
          }
        } else {
          setPostcodeValid(false);
          setPostcodeDetails(null);
        }
      } catch {
        setPostcodeValid(null);
      } finally {
        setPostcodeLoading(false);
      }
    }, 500);

    return () => {
      if (postcodeDebounceRef.current) clearTimeout(postcodeDebounceRef.current);
    };
  }, [postalCode]);

  // UK Phone format regex
  const ukPhoneRegex = /^(?:(?:\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}|\+44\s?\d{4}\s?\d{6}|0\d{4}\s?\d{6})$/;
  const phoneValid = ukPhoneRegex.test(phone.trim()) || phone.trim().length >= 10;

  const companyNameValid = accountType === 'INDIVIDUAL' || companyName.trim().length >= 2;
  const nameValid       = name.trim().length >= 2;
  const emailValid      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const line1Valid      = line1.trim().length >= 3;
  const cityValid       = city.trim().length >= 2;
  const isPostalCodeFormatValid = postalCode.trim().length >= 5;
  const passwordHasLength  = password.length >= 8;
  const passwordHasUpper   = /[A-Z]/.test(password);
  const passwordHasLower   = /[a-z]/.test(password);
  const passwordHasDigit   = /\d/.test(password);
  const passwordHasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  const passwordValid = passwordHasLength && passwordHasUpper && passwordHasLower && passwordHasDigit && passwordHasSpecial;

  const canSubmit = nameValid && companyNameValid && emailValid && phoneValid && line1Valid && cityValid && isPostalCodeFormatValid && passwordValid && agreedToTerms;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setError('Please fill in all required fields and accept the marketplace terms.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        line1: line1.trim(),
        line2: line2.trim() || undefined,
        city: city.trim(),
        postalCode: postalCode.trim().toUpperCase(),
        country: 'United Kingdom',
        accountType,
        companyName: accountType === 'BUSINESS' ? companyName.trim() : undefined,
        companyNumber: accountType === 'BUSINESS' && companyNumber.trim() ? companyNumber.trim() : undefined,
        vatNumber: accountType === 'BUSINESS' && vatNumber.trim() ? vatNumber.trim() : undefined,
        referralCode: referralCode.trim() ? referralCode.trim().toUpperCase() : undefined,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 min-h-[calc(100vh-4rem)] bg-white">
      {/* -- Left: Form -- */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 py-12 max-w-xl mx-auto w-full">
        {/* Step Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <span className={cn(step === 1 ? 'text-[var(--color-green)]' : 'text-gray-400')}>
              Step 1: Account &amp; Address Details
            </span>
            <span className={cn(step === 2 ? 'text-[var(--color-green)]' : 'text-gray-400')}>
              Step 2: Confirmation
            </span>
          </div>
          <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-[var(--color-green)] rounded-full transition-all duration-300"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>

        {/* Heading */}
        <div className="mb-6">
          <Link href="/" aria-label="Back to home" className="inline-block mb-4">
            <BrandLogo priority className="h-14 sm:h-16 w-auto" />
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[var(--color-green)] border border-emerald-200 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Join VeriBuy Marketplace</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
            {step === 1 ? 'Create Your Account' : 'Confirm & Complete'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === 1
              ? 'Buy verified electronics with escrow or sell with 0% commission.'
              : 'Review your details and finish setting up your account.'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="flex items-center justify-between gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{error}</span>
            </div>
            {error.toLowerCase().includes('already exists') && (
              <Link href="/login" className="underline font-bold text-red-900 shrink-0 hover:text-black">
                Sign in instead →
              </Link>
            )}
          </div>
        )}

        {/* Privacy Callout Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-start gap-3">
          <Shield className="w-5 h-5 text-[var(--color-green)] shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-900 leading-relaxed font-medium">
            <strong>Privacy Guarantee:</strong> Your full address and phone number are securely stored for verified escrow transactions. Only your <strong>City / County</strong> (e.g. Manchester, Liverpool) will be visible to buyers as your dispatch origin.
          </p>
        </div>

        {/* ── 1-Click Social Sign Up (Apple & Google) ── */}
        {step === 1 && (
          <div className="mb-6">
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleSocialSignUpClick('APPLE')}
                disabled={loading || Boolean(socialLoading)}
                className="w-full py-3 px-4 bg-black text-white hover:bg-gray-900 rounded-xl font-bold text-xs flex items-center justify-between transition-all shadow-xs disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <AppleIcon className="w-4 h-4 fill-white" />
                  <span>Sign up with Apple</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/15 text-white">
                  {socialLoading === 'APPLE' ? 'Setting up...' : '⚡ Instant'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSocialSignUpClick('GOOGLE')}
                disabled={loading || Boolean(socialLoading)}
                className="w-full py-3 px-4 bg-white border border-gray-200 hover:bg-slate-50 text-gray-800 rounded-xl font-bold text-xs flex items-center justify-between transition-all shadow-xs disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <GoogleIcon className="w-4 h-4" />
                  <span>Sign up with Google</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                  {socialLoading === 'GOOGLE' ? 'Setting up...' : '🔒 Passkey'}
                </span>
              </button>
            </div>

            <div className="relative flex items-center justify-center my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <span className="relative bg-white px-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                or sign up with email
              </span>
            </div>
          </div>
        )}

        {/* -- Step 1: Form Fields -- */}
        {step === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              if (nameValid && companyNameValid && emailValid && phoneValid && line1Valid && cityValid && isPostalCodeFormatValid && passwordValid && agreedToTerms) {
                setStep(2);
              } else if (!agreedToTerms) {
                setError('Please agree to the Terms of Service and Privacy Policy to proceed.');
              } else if (accountType === 'BUSINESS' && !companyNameValid) {
                setError('Please provide your registered Company / Organization Name.');
              } else if (!phoneValid) {
                setError('Please enter a valid UK contact phone number.');
              } else if (!line1Valid || !cityValid || !isPostalCodeFormatValid) {
                setError('Please enter your complete address (Street Address, City/County, and Postcode).');
              } else {
                setError('Please complete all fields according to the criteria.');
              }
            }}
            className="space-y-4"
            noValidate
          >
            {/* Account Type Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                Account Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccountType('INDIVIDUAL')}
                  className={cn(
                    'p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between',
                    accountType === 'INDIVIDUAL'
                      ? 'border-[var(--color-green)] bg-emerald-50/50 shadow-xs ring-1 ring-[var(--color-green)]'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-gray-500" />
                      Personal
                    </span>
                    {accountType === 'INDIVIDUAL' && <CheckCircle2 className="w-4 h-4 text-[var(--color-green)]" />}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-tight">Buy &amp; sell single pre-owned devices</p>
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType('BUSINESS')}
                  className={cn(
                    'p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between',
                    accountType === 'BUSINESS'
                      ? 'border-[var(--color-green)] bg-emerald-50/50 shadow-xs ring-1 ring-[var(--color-green)]'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-500" />
                      Business / Org
                    </span>
                    {accountType === 'BUSINESS' && <CheckCircle2 className="w-4 h-4 text-[var(--color-green)]" />}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-tight">Retailer/refurbisher with bulk listings</p>
                </button>
              </div>
            </div>

            {/* Business Specific Fields */}
            {accountType === 'BUSINESS' && (
              <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 space-y-3.5">
                <div>
                  <label htmlFor="reg-company-name" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Company / Organization Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-company-name"
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Tech Refurbishing Ltd"
                    className={cn(
                      'w-full px-4 py-3 border border-[var(--color-border)] rounded-xl text-sm bg-white',
                      'text-gray-900 placeholder:text-gray-400',
                      'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent transition-all shadow-xs',
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-company-number" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      Company Number <span className="text-gray-400 text-[10px] font-normal">(Optional)</span>
                    </label>
                    <input
                      id="reg-company-number"
                      type="text"
                      value={companyNumber}
                      onChange={(e) => setCompanyNumber(e.target.value)}
                      placeholder="e.g. 12345678"
                      className={cn(
                        'w-full px-4 py-3 border border-[var(--color-border)] rounded-xl text-sm bg-white',
                        'text-gray-900 placeholder:text-gray-400',
                        'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent transition-all shadow-xs',
                      )}
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-vat-number" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      VAT Number <span className="text-gray-400 text-[10px] font-normal">(Optional)</span>
                    </label>
                    <input
                      id="reg-vat-number"
                      type="text"
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      placeholder="e.g. GB 123 4567 89"
                      className={cn(
                        'w-full px-4 py-3 border border-[var(--color-border)] rounded-xl text-sm bg-white',
                        'text-gray-900 placeholder:text-gray-400',
                        'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent transition-all shadow-xs',
                      )}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Full Name */}
            <div>
              <label htmlFor="reg-name" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="e.g. Jane Doe"
                className={cn(
                  'w-full px-4 py-3 border border-[var(--color-border)] rounded-xl text-sm bg-white',
                  'text-gray-900 placeholder:text-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent transition-all shadow-xs',
                )}
              />
            </div>

            {/* Email Address */}
            <div>
              <label htmlFor="reg-email" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="jane.doe@example.com"
                className={cn(
                  'w-full px-4 py-3 border border-[var(--color-border)] rounded-xl text-sm bg-white',
                  'text-gray-900 placeholder:text-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent transition-all shadow-xs',
                )}
              />
            </div>

            {/* Phone Number */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="reg-phone" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-600" /> Private to your account
                </span>
              </div>
              <input
                id="reg-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="e.g. 07123 456789 or +44 7123 456789"
                className={cn(
                  'w-full px-4 py-3 border border-[var(--color-border)] rounded-xl text-sm bg-white',
                  'text-gray-900 placeholder:text-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent transition-all shadow-xs',
                )}
              />
            </div>

            {/* Street Address Line 1 */}
            <div>
              <label htmlFor="reg-line1" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Street Address <span className="text-red-500">*</span>
              </label>
              <input
                id="reg-line1"
                type="text"
                required
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                autoComplete="address-line1"
                placeholder="e.g. 24 Market Street"
                className={cn(
                  'w-full px-4 py-3 border border-[var(--color-border)] rounded-xl text-sm bg-white',
                  'text-gray-900 placeholder:text-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent transition-all shadow-xs',
                )}
              />
            </div>

            {/* Street Address Line 2 (Optional) */}
            <div>
              <label htmlFor="reg-line2" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Apartment / Suite <span className="text-gray-400 font-normal normal-case">(Optional)</span>
              </label>
              <input
                id="reg-line2"
                type="text"
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
                autoComplete="address-line2"
                placeholder="e.g. Flat 3B"
                className={cn(
                  'w-full px-4 py-3 border border-[var(--color-border)] rounded-xl text-sm bg-white',
                  'text-gray-900 placeholder:text-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent transition-all shadow-xs',
                )}
              />
            </div>

            {/* City / UK County + Postcode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="reg-city" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    City / County <span className="text-red-500">*</span>
                  </label>
                </div>
                <input
                  id="reg-city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  autoComplete="address-level2"
                  placeholder="e.g. Manchester, Liverpool"
                  className={cn(
                    'w-full px-4 py-3 border border-[var(--color-border)] rounded-xl text-sm bg-white',
                    'text-gray-900 placeholder:text-gray-400',
                    'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent transition-all shadow-xs',
                  )}
                />
                <span className="text-[10px] text-gray-400 mt-1 block">Public dispatch origin on listings</span>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="reg-postal" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    UK Postcode <span className="text-red-500">*</span>
                  </label>
                </div>
                <div className="relative">
                  <input
                    id="reg-postal"
                    type="text"
                    required
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    autoComplete="postal-code"
                    placeholder="e.g. M1 1AA"
                    className={cn(
                      'w-full px-4 py-3 border rounded-xl text-sm bg-white uppercase',
                      postcodeValid === true
                        ? 'border-emerald-500 focus:ring-emerald-500'
                        : postcodeValid === false
                        ? 'border-amber-400 focus:ring-amber-400'
                        : 'border-[var(--color-border)] focus:ring-[var(--color-green)]',
                      'text-gray-900 placeholder:text-gray-400',
                      'focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-xs',
                    )}
                  />
                  {postcodeLoading && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--color-green)]" />
                    </div>
                  )}
                  {postcodeValid === true && !postcodeLoading && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                  )}
                </div>

                {/* Live validation feedback */}
                {postcodeLoading && (
                  <span className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                    Checking Royal Mail database...
                  </span>
                )}
                {postcodeValid === true && postcodeDetails && (
                  <span className="text-[10px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                    ✓ PAF Validated: {postcodeDetails}
                  </span>
                )}
                {postcodeValid === false && (
                  <span className="text-[10px] text-amber-600 font-medium mt-1 block">
                    Please check UK postcode format (e.g. M1 1AA, SW1A 1AA)
                  </span>
                )}
                {postcodeValid === null && !postcodeLoading && (
                  <span className="text-[10px] text-gray-400 mt-1 block">Kept strictly private</span>
                )}
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={cn(
                    'w-full px-4 py-3 pr-20 border border-[var(--color-border)] rounded-xl text-sm bg-white',
                    'text-gray-900 placeholder:text-gray-400',
                    'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent transition-all shadow-xs',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors font-medium"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>

              {/* Dynamic Password Validation Requirements */}
              {password.length > 0 && (
                <div className="mt-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                  {[
                    { ok: passwordHasLength,  label: '8+ characters' },
                    { ok: passwordHasUpper,   label: 'One uppercase letter' },
                    { ok: passwordHasLower,   label: 'One lowercase letter' },
                    { ok: passwordHasDigit,   label: 'One number' },
                    { ok: passwordHasSpecial, label: 'One symbol (!@#$)' },
                  ].map(({ ok, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      {ok ? (
                        <Check className="w-3.5 h-3.5 text-[var(--color-green)] shrink-0" />
                      ) : (
                        <span className="w-3 h-3 rounded-full border border-gray-300 inline-block shrink-0" />
                      )}
                      <span className={ok ? 'text-gray-900 font-semibold' : 'text-gray-400'}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Referral Code (Optional) */}
            <div className="pt-3 border-t border-gray-100">
              <label htmlFor="reg-referral-code" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-emerald-600" />
                  Referral Code
                </span>
                <span className="text-[11px] font-normal text-emerald-700 font-semibold lowercase">Optional promo</span>
              </label>
              <div className="relative">
                <input
                  id="reg-referral-code"
                  type="text"
                  value={referralCode}
                  onChange={(e) => handleReferralCodeChange(e.target.value)}
                  placeholder="e.g. VB-9K2L1P"
                  maxLength={20}
                  className={cn(
                    'w-full px-4 py-2.5 border rounded-xl text-sm font-mono tracking-wider uppercase transition-all shadow-xs',
                    referralStatus === 'valid'
                      ? 'border-emerald-300 bg-emerald-50/50 text-emerald-950 focus:ring-emerald-500'
                      : referralStatus === 'invalid'
                      ? 'border-amber-300 bg-amber-50/30 text-amber-950 focus:ring-amber-500'
                      : 'border-[var(--color-border)] bg-white text-gray-900 focus:ring-[var(--color-green)] focus:outline-none'
                  )}
                />
                {referralLoading && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  </div>
                )}
                {referralStatus === 'valid' && !referralLoading && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                )}
              </div>
              {referralStatus === 'valid' && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-800 font-medium bg-emerald-50 border border-emerald-200/60 px-3 py-1.5 rounded-lg">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{referralMessage || 'Referral applied'} — Your inviter receives £5 when your first sale completes!</span>
                </div>
              )}
              {referralStatus === 'invalid' && (
                <p className="text-[11px] text-amber-700 mt-1">
                  Referral code not recognized. You can still create your account without one.
                </p>
              )}
            </div>

            {/* Terms Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[var(--color-green)] focus:ring-[var(--color-green)]"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                I agree to the{' '}
                <Link href="/terms" className="text-[var(--color-green)] font-semibold hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-[var(--color-green)] font-semibold hover:underline">Privacy Policy</Link>.
              </span>
            </label>

            {/* Next Button */}
            <button
              type="submit"
              className="w-full py-3.5 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg mt-2 flex items-center justify-center gap-2"
            >
              <span>Continue to Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* -- Step 2: Confirmation -- */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="bg-[var(--color-surface-alt)] rounded-2xl p-5 border border-[var(--color-border)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Account &amp; Dispatch Summary</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Account Type:</span>
                  <span className="font-bold text-gray-900">
                    {accountType === 'BUSINESS' ? 'Business / Organization' : 'Personal Individual'}
                  </span>
                </div>
                {accountType === 'BUSINESS' && companyName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Company Name:</span>
                    <span className="font-bold text-gray-900">{companyName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">{accountType === 'BUSINESS' ? 'Representative:' : 'Name:'}</span>
                  <span className="font-bold text-gray-900">{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Email:</span>
                  <span className="font-bold text-gray-900">{email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Phone:</span>
                  <span className="font-bold text-gray-900 font-mono flex items-center gap-1.5">
                    {phone}
                    <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">UK Format Validated</span>
                  </span>
                </div>
                {referralCode && (
                  <div className="flex justify-between border-t border-gray-100 pt-2">
                    <span className="text-gray-500">Referral Promo:</span>
                    <span className="font-bold text-emerald-700 font-mono flex items-center gap-1 text-xs">
                      <Gift className="w-3.5 h-3.5" /> {referralCode}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Public Dispatch Origin:</span>
                  <span className="font-bold text-[var(--color-green)] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {city.trim()}, UK
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200/60">
                  <span className="text-gray-500">Shipping Address:</span>
                  <span className="text-xs font-medium text-gray-700 text-right">
                    {line1}{line2 ? `, ${line2}` : ''}, {city}, {postalCode}
                    {postcodeValid && (
                      <span className="block text-[10px] text-emerald-600 font-bold mt-0.5">
                        ✓ Royal Mail PAF Validated
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200/60">
                  <span className="text-gray-500">Seller Commission:</span>
                  <span className="font-bold text-[var(--color-green)]">0% Guaranteed</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); }}
                className="w-1/3 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors"
              >
                &larr; Back
              </button>

              <button
                type="submit"
                disabled={loading || !canSubmit}
                className="w-2/3 py-3.5 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Finish &amp; Register</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p className="mt-8 text-xs text-gray-500 text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--color-green)] font-bold hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      {/* -- Right: Trust Panel -- */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 flex-col justify-center px-12 py-12 text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: 'radial-gradient(circle at 70% 30%, #10B981 0%, transparent 60%)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-md">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-6">
            <ShieldCheck className="w-6 h-6 text-emerald-300" />
          </div>

          <h2 className="text-3xl font-black text-white mb-6 leading-tight tracking-tight">
            Why Join the VeriBuy Marketplace?
          </h2>

          <div className="space-y-4 mb-10">
            {WHY_JOIN.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 text-emerald-300 flex items-center justify-center shrink-0 border border-white/10">
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <span className="text-xs font-semibold text-emerald-100">{label}</span>
              </div>
            ))}
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
            <p className="text-xs text-emerald-100/90 leading-relaxed italic mb-3">
              &ldquo;I sold my iPhone 14 Pro Max in 2 days. The IMEI check made the listing standout, and I kept 100% of my £750 sale price.&rdquo;
            </p>
            <p className="text-[11px] font-bold text-emerald-300">&mdash; David M., Manchester</p>
          </div>
        </div>
      </div>

      {/* ── Social Sign-Up Email Dialog ── */}
      {socialModalProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                {socialModalProvider === 'APPLE' ? (
                  <AppleIcon className="w-6 h-6 fill-black" />
                ) : (
                  <GoogleIcon className="w-6 h-6" />
                )}
              </div>
              <h3 className="text-lg font-black text-gray-900">
                Sign up with {socialModalProvider === 'APPLE' ? 'Apple' : 'Google'}
              </h3>
              <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                Enter your {socialModalProvider === 'APPLE' ? 'Apple ID' : 'Google'} email address. We will verify your email to secure your account.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (socialModalEmail.trim()) {
                  triggerSocialSignUp(socialModalProvider, socialModalEmail.trim(), socialModalName.trim());
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  value={socialModalName}
                  onChange={(e) => setSocialModalName(e.target.value)}
                  placeholder="e.g. Alex Jenkins"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={socialModalEmail}
                  onChange={(e) => setSocialModalEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSocialModalProvider(null)}
                  disabled={Boolean(socialLoading)}
                  className="flex-1 py-3 px-4 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!socialModalEmail.trim() || Boolean(socialLoading)}
                  className="flex-1 py-3 px-4 bg-black text-white hover:bg-gray-900 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {socialLoading ? 'Verifying...' : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
