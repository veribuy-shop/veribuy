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
} from 'lucide-react';
import { cn } from '@/lib/utils';

const WHY_JOIN = [
  { icon: ShieldCheck, label: '100% Trust Lens™ Verified Hardware' },
  { icon: Lock,        label: 'Stripe Escrow Payment Protection' },
  { icon: Coins,       label: '0% Seller Commission (Keep 100%)' },
  { icon: RotateCcw,  label: '48-Hour Money-Back Guarantee' },
];

export default function RegisterPage() {
  const { register } = useAuth();

  const [step, setStep]                   = useState<1 | 2>(1);
  const [name, setName]                   = useState('');
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

  // Postcode live validation state
  const [postcodeLoading, setPostcodeLoading] = useState(false);
  const [postcodeValid, setPostcodeValid]     = useState<boolean | null>(null);
  const [postcodeDetails, setPostcodeDetails] = useState<string | null>(null);
  const postcodeDebounceRef = useRef<NodeJS.Timeout | null>(null);

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

  const canSubmit = nameValid && emailValid && phoneValid && line1Valid && cityValid && isPostalCodeFormatValid && passwordValid && agreedToTerms;

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
          <div role="alert" className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Privacy Callout Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-start gap-3">
          <Shield className="w-5 h-5 text-[var(--color-green)] shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-900 leading-relaxed font-medium">
            <strong>Privacy Guarantee:</strong> Your full address and phone number are securely stored for verified escrow transactions. Only your <strong>City / County</strong> (e.g. Manchester, Liverpool) will be visible to buyers as your dispatch origin.
          </p>
        </div>

        {/* -- Step 1: Form Fields -- */}
        {step === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              if (nameValid && emailValid && phoneValid && line1Valid && cityValid && isPostalCodeFormatValid && passwordValid && agreedToTerms) {
                setStep(2);
              } else if (!agreedToTerms) {
                setError('Please agree to the Terms of Service and Privacy Policy to proceed.');
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
                  <span className="text-gray-500">Name:</span>
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
    </div>
  );
}
