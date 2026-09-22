'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import {
  Lightbulb,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Smartphone,
  Eye,
  Info,
  X,
  Battery,
  Layers,
  Truck,
  Building2,
  PackageCheck,
  Gavel,
  Flame,
  Timer,
  Clock,
} from 'lucide-react';

function validateImeiChecksum(imei: string): { valid: boolean; status: 'empty' | 'incomplete' | 'invalid' | 'valid'; message: string } {
  const clean = imei.trim().replace(/[\s-]/g, '');
  if (!clean) {
    return { valid: false, status: 'empty', message: 'Enter your 15-digit device IMEI' };
  }
  if (!/^\d+$/.test(clean)) {
    return { valid: false, status: 'invalid', message: 'IMEI must contain numbers only' };
  }
  if (clean.length < 15) {
    return { valid: false, status: 'incomplete', message: `${clean.length}/15 digits entered` };
  }
  if (clean.length > 15) {
    return { valid: false, status: 'invalid', message: 'IMEI must be exactly 15 digits' };
  }

  // Luhn algorithm verification
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(clean.charAt(i), 10);
    // Double every second digit from right-to-left (or odd indices 1, 3, 5... for 15-digit string)
    if (i % 2 !== 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  if (sum % 10 === 0) {
    return { valid: true, status: 'valid', message: 'Valid 15-digit IMEI & checksum' };
  } else {
    return { valid: false, status: 'invalid', message: 'Check digit mismatch — please verify the digits' };
  }
}

type DeviceType = string;
type ConditionGrade = 'A' | 'B' | 'C';

interface DeviceTypeOption {
  value: string;
  label: string;
}

interface ListingFormData {
  // Step 1: Device Details
  deviceType: DeviceType;
  brand: string;
  model: string;
  title: string;
  description: string;
  city?: string;
  
  // Bulk / Inventory details
  isBulkListing: boolean;
  quantity: number;
  color: string;
  storageCapacity: string;
  
  // Step 2: Condition
  conditionGrade: ConditionGrade;
  cosmeticCondition: string;
  functionalIssues: string;
  accessories: string[];
  
  // Step 3: Format & Pricing & Delivery
  format: 'FIXED_PRICE' | 'AUCTION';
  price: string;
  currency: string;
  startingBid: string;
  reservePrice: string;
  durationDays: number;
  buyItNowPrice: string;
  freeShipping: boolean;
  
  // Step 4: Device Identifiers & Evidence
  imei: string;
  serialNumber: string;
  deviceImages: File[];
  screenImages: File[];
  settingsScreenshot: File[];
}

const COLOR_OPTIONS = [
  'Space Black',
  'Space Gray',
  'Silver',
  'Gold',
  'Midnight',
  'Starlight',
  'Deep Purple',
  'Natural Titanium',
  'Black Titanium',
  'White Titanium',
  'Desert Titanium',
  'Blue',
  'Green',
  'Red',
  'White',
  'Black',
  'Other',
];

const STORAGE_OPTIONS = [
  '64GB',
  '128GB',
  '256GB',
  '512GB',
  '1TB',
  '2TB',
  'Other',
];

const STEPS = [
  { id: 1, name: 'Device Details', description: 'Basic device information' },
  { id: 2, name: 'Condition', description: 'Device condition assessment' },
  { id: 3, name: 'Pricing', description: 'Set your price' },
  { id: 4, name: 'Verification', description: 'IMEI/Serial & Evidence' },
];

// Display labels for device types; the accepted values come from the backend
// /api/listings/options endpoint (mirroring the DB DeviceType enum).
const DEVICE_TYPE_LABELS: Record<string, string> = {
  SMARTPHONE: 'Smartphone',
  TABLET: 'Tablet',
  LAPTOP: 'Laptop',
  SMARTWATCH: 'Smartwatch',
  AIRPODS: 'AirPods',
  DESKTOP: 'Desktop',
  GAMING_CONSOLE: 'Gaming Console',
  OTHER: 'Other',
};

const POPULAR_BRANDS: Record<string, string[]> = {
  SMARTPHONE: ['Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi', 'Motorola', 'Other'],
  TABLET: ['Apple', 'Samsung', 'Microsoft', 'Lenovo', 'Amazon', 'Other'],
  LAPTOP: ['Apple', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'Microsoft', 'Other'],
  SMARTWATCH: ['Apple', 'Samsung', 'Garmin', 'Fitbit', 'Other'],
  AIRPODS: ['Apple', 'Other'],
  DESKTOP: ['Apple', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'Other'],
  GAMING_CONSOLE: ['Sony', 'Microsoft', 'Nintendo', 'Valve', 'Other'],
  OTHER: ['Other'],
};

// Device type values + labels are fetched from the backend so the form always
// reflects the DB enum and never drifts from what the API actually accepts.

const ACCESSORIES_OPTIONS = [
  'Original Box',
  'Charger',
  'Cable',
  'Earphones/Headphones',
  'Case/Cover',
  'Screen Protector',
  'Manual/Documentation',
];


/**
 * PERF-06: Generates stable blob URLs for an array of File objects and revokes
 * them on cleanup to prevent memory leaks from URL.createObjectURL.
 */
function useObjectURLs(files: File[]): string[] {
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    // Revoke previous URLs before creating new ones
    urlsRef.current.forEach(url => URL.revokeObjectURL(url));
    urlsRef.current = files.map(file => URL.createObjectURL(file));
    return () => {
      urlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, [files]);

  return urlsRef.current;
}

export default function CreateListingPage() {
  const router = useRouter();
  const { user, authFetch } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [deviceTypeOptions, setDeviceTypeOptions] = useState<DeviceTypeOption[]>([]);
  const [showImeiGuide, setShowImeiGuide] = useState(false);

  // Fetch the accepted device types from the backend so the form mirrors the DB enum.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/listings/options', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const types = Array.isArray(data?.deviceTypes) ? data.deviceTypes : [];
        if (types.length > 0) {
          setDeviceTypeOptions(
            types.map((value: string) => ({
              value,
              label: DEVICE_TYPE_LABELS[value] ?? value,
            }))
          );
        }
      } catch {
        // fall back to the hardcoded defaults below if the backend is unreachable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [formData, setFormData] = useState<ListingFormData>({
    deviceType: 'SMARTPHONE',
    brand: '',
    model: '',
    title: '',
    description: '',
    city: '',
    isBulkListing: user?.accountType === 'BUSINESS',
    quantity: 1,
    color: '',
    storageCapacity: '',
    conditionGrade: 'B',
    cosmeticCondition: '',
    functionalIssues: '',
    accessories: [],
    format: 'FIXED_PRICE',
    price: '',
    currency: 'GBP',
    startingBid: '0.99',
    reservePrice: '',
    durationDays: 7,
    buyItNowPrice: '',
    freeShipping: false,
    imei: '',
    serialNumber: '',
    deviceImages: [],
    screenImages: [],
    settingsScreenshot: [],
  });

  // Automatically enable bulk listing mode for business accounts
  useEffect(() => {
    if (user?.accountType === 'BUSINESS') {
      setFormData(prev => ({ ...prev, isBulkListing: true }));
    }
  }, [user?.accountType]);

  // Pre-fill seller's dispatch city from their saved profile
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/users/${user.id}/profile`, { credentials: 'include' });
        if (res.ok) {
          const profile = await res.json();
          const userCity = profile?.address?.city || profile?.city;
          if (userCity) {
            setFormData(prev => ({ ...prev, city: prev.city || userCity }));
          }
        }
      } catch {
        // Best-effort prefill — ignore lookup failures.
      }
    })();
  }, [user?.id]);

  // PERF-06: useObjectURLs must be called after formData is declared so the
  // initial empty arrays are accessible on first render.
  const deviceImageURLs    = useObjectURLs(formData.deviceImages);
  const screenImageURLs    = useObjectURLs(formData.screenImages);
  const settingsImageURLs  = useObjectURLs(formData.settingsScreenshot);

  const updateFormData = (field: keyof ListingFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // DATA-04: Validate file type (images only) and size (max 10 MB) before
  // storing files in state. Invalid files are rejected with a visible error.
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

  const handleFileChange = (field: keyof ListingFormData, files: FileList | null) => {
    if (!files) return;

    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        errors.push(`"${file.name}" is not an image file and was skipped.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`"${file.name}" exceeds the 10 MB size limit and was skipped.`);
        return;
      }
      validFiles.push(file);
    });

    if (errors.length > 0) {
      setError(errors.join(' '));
    }

    if (validFiles.length > 0) {
      updateFormData(field, validFiles);
    }
  };

  const toggleAccessory = (accessory: string) => {
    const current = formData.accessories;
    if (current.includes(accessory)) {
      updateFormData('accessories', current.filter(a => a !== accessory));
    } else {
      updateFormData('accessories', [...current, accessory]);
    }
  };

  const validateStep = (step: number): boolean => {
    setError('');
    
    if (step === 1) {
      if (!formData.deviceType || !formData.brand || !formData.model || !formData.title || !formData.description) {
        setError('Please fill in all required fields');
        return false;
      }
      if (formData.title.length < 10) {
        setError('Title must be at least 10 characters');
        return false;
      }
      if (formData.description.length < 50) {
        setError('Description must be at least 50 characters');
        return false;
      }
      if (formData.isBulkListing && (!formData.quantity || formData.quantity < 1)) {
        setError('Please specify a valid inventory quantity (minimum 1 unit)');
        return false;
      }
    }
    
    if (step === 2) {
      if (!formData.conditionGrade || !formData.cosmeticCondition) {
        setError('Please select condition grade and describe cosmetic condition');
        return false;
      }
    }
    
    if (step === 3) {
      if (formData.format === 'AUCTION') {
        const startingBid = parseFloat(formData.startingBid);
        if (!formData.startingBid || isNaN(startingBid) || startingBid <= 0) {
          setError('Please enter a valid starting bid amount (minimum £0.01)');
          return false;
        }
        if (formData.reservePrice) {
          const reserve = parseFloat(formData.reservePrice);
          if (isNaN(reserve) || reserve < startingBid) {
            setError('Reserve price must be greater than or equal to the starting bid');
            return false;
          }
        }
        if (formData.buyItNowPrice) {
          const bin = parseFloat(formData.buyItNowPrice);
          if (isNaN(bin) || bin <= startingBid) {
            setError('Buy It Now price must be higher than the starting bid');
            return false;
          }
        }
      } else {
        const price = parseFloat(formData.price);
        if (!formData.price || isNaN(price) || price <= 0) {
          setError('Please enter a valid price');
          return false;
        }
      }
    }
    
    if (step === 4) {
      // For bulk inventory listings, IMEI is not required upfront; 1 representative photo is required
      if (formData.isBulkListing) {
        if (formData.deviceImages.length < 1) {
          setError('Please upload at least 1 representative photo of the inventory batch');
          return false;
        }
        return true;
      }

      // Smartphones are verified by IMEI only (serial optional). This matches the
      // server-side Trust Lens requirement.
      if (formData.deviceType === 'SMARTPHONE') {
        if (!formData.imei) {
          setError('Smartphones require an IMEI for verification');
          return false;
        }
      } else {
        // Other IMEI-capable devices must provide an identifier (IMEI or serial).
        // Laptops and AirPods have no IMEI, so the serial (or none) is acceptable.
        const requiresIdentifier = !['LAPTOP', 'AIRPODS'].includes(formData.deviceType);
        if (requiresIdentifier && !formData.imei && !formData.serialNumber) {
          setError('IMEI or Serial Number is required for verification');
          return false;
        }
      }
      
      if (formData.deviceImages.length < 3) {
        setError('Please upload at least 3 device images');
        return false;
      }
      
      if (formData.screenImages.length < 1) {
        setError('Please upload at least 1 screen/display image');
        return false;
      }
    }
    
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError('');
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    setIsSubmitting(true);
    setError('');

    try {
      // Step 1: Create the listing first
      // SEC-06: sellerId is intentionally omitted — the BFF API route derives it
      // from the verified JWT token. Never trust client-supplied identity fields.
      const isAuction = formData.format === 'AUCTION';
      const listingData = {
        deviceType: formData.deviceType,
        brand: formData.brand,
        model: formData.model,
        title: formData.title,
        description: `${formData.description}\n\nCosmetic Condition: ${formData.cosmeticCondition}\nFunctional Issues: ${formData.functionalIssues || 'None reported'}\nIncluded Accessories: ${formData.accessories.join(', ') || 'None'}`,
        price: isAuction
          ? (formData.buyItNowPrice ? parseFloat(formData.buyItNowPrice) : parseFloat(formData.startingBid || '0.99'))
          : parseFloat(formData.price),
        currency: formData.currency,
        conditionGrade: formData.conditionGrade,
        quantity: formData.isBulkListing ? (Number(formData.quantity) || 1) : 1,
        color: formData.color || undefined,
        storageCapacity: formData.storageCapacity || undefined,
        freeShipping: formData.freeShipping,
        isBulkListing: formData.isBulkListing,
        format: formData.format,
        startingBid: isAuction ? parseFloat(formData.startingBid || '0.99') : undefined,
        reservePrice: isAuction && formData.reservePrice ? parseFloat(formData.reservePrice) : undefined,
        durationDays: isAuction ? Number(formData.durationDays) || 7 : undefined,
        buyItNowPrice: isAuction && formData.buyItNowPrice ? parseFloat(formData.buyItNowPrice) : undefined,
        imei: formData.isBulkListing ? undefined : (formData.imei || undefined),
        serialNumber: formData.isBulkListing ? undefined : (formData.serialNumber || undefined),
        city: formData.city || undefined,
      };

      const response = await authFetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listingData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create listing');
      }

      const listing = await response.json();
      
      // Step 2: Upload all evidence files to the newly created listing
      const allFiles = [
        ...formData.deviceImages.map(f => ({ file: f, type: 'DEVICE_IMAGE' })),
        ...formData.screenImages.map(f => ({ file: f, type: 'SCREEN_IMAGE' })),
        ...formData.settingsScreenshot.map(f => ({ file: f, type: 'SETTINGS_SCREENSHOT' })),
      ];

      if (allFiles.length > 0) {
        setUploadingFiles(true);

        // PERF-05: Upload all evidence files in parallel with Promise.allSettled so
        // a single failed upload does not block the rest. Individual failures are
        // logged but don't abort the listing creation flow.
        const uploadResults = await Promise.allSettled(
          allFiles.map(({ file, type }) => {
            const uploadFormData = new FormData();
            uploadFormData.append('file', file);
            uploadFormData.append('listingId', listing.id);
            // SEC-06: sellerId intentionally not appended — evidence service derives it
            // from the JWT token forwarded by the BFF API route.
            uploadFormData.append('type', type);
            return authFetch('/api/evidence', {
              method: 'POST',
              body: uploadFormData,
            }).then(res => {
              if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
              return res;
            });
          })
        );

        // Log any individual upload failures without failing the whole submission
        uploadResults.forEach((result, i) => {
          if (result.status === 'rejected') {
            console.error(`Evidence upload error (${allFiles[i].file.name}):`, result.reason);
          }
        });

        // Mark all files as 100% in the progress tracker
        setUploadProgress(
          Object.fromEntries(allFiles.map(({ file }) => [file.name, 100]))
        );
      }

      // For bulk listings, skip Trust Lens single-item IMEI verification and navigate to detail page
      if (formData.isBulkListing) {
        router.push(`/listings/${listing.id}`);
        return;
      }
      
      // Step 3: Create verification request in Trust Lens
      let verificationFailed = false;
      try {
        if (!user?.id) {
          console.error('User ID unavailable when creating verification request — skipping');
          verificationFailed = true;
        } else {
          const verificationData = {
            listingId: listing.id,
            // SEC-06: sellerId intentionally omitted — the backend derives it from
            // the verified JWT token (sellerId is the authenticated user's id).
            conditionGrade: formData.conditionGrade,
            imeiProvided: !!formData.imei,
            serialProvided: !!formData.serialNumber,
            imei: formData.imei || undefined,
            serialNumber: formData.serialNumber || undefined,
            brand: formData.brand || undefined,
          };

          const verificationResponse = await authFetch('/api/trust-lens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(verificationData),
          });

          if (!verificationResponse.ok) {
            const data = await verificationResponse.json().catch(() => ({}));
            console.error('Failed to create verification request:', data.error || verificationResponse.status);
            verificationFailed = true;
          }
        }
      } catch (verificationError) {
        console.error('Verification request error:', verificationError);
        verificationFailed = true;
        // Don't block the flow if verification fails
      }
      
      // For IMEI-verified smartphones, route to the dedicated Verification Report
      // stage so the seller sees the live check run and the pass/fail outcome.
      // Other device types keep going to the listing detail page.
      if (formData.deviceType === 'SMARTPHONE' && formData.imei) {
        router.push(`/verification/${listing.id}`);
      } else {
        router.push(`/listings/${listing.id}${verificationFailed ? '?verification=failed' : ''}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create listing');
      setIsSubmitting(false);
      setUploadingFiles(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-[var(--color-border)] p-8 text-center">
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-4">Authentication Required</h1>
          <p className="text-[var(--color-text-muted)] mb-6">
            You need to be logged in to create listings.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90"
          >
            Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">Create New Listing</h1>
          <p className="text-[var(--color-text-muted)]">
            List your device and get it verified through Trust Lens for buyer confidence
          </p>
        </div>

        {/* Progress Steps */}
        <div
          className="mb-8"
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label={`Step ${currentStep} of ${STEPS.length}: ${STEPS[currentStep - 1].name}`}
        >
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    aria-hidden="true"
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold mb-2 ${
                      currentStep >= step.id
                        ? 'bg-[var(--color-green)] text-white'
                        : 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {step.id}
                  </div>
                  <div className="text-center">
                    <div className={`text-sm font-medium ${currentStep >= step.id ? 'text-[var(--color-green)]' : 'text-[var(--color-text-muted)]'}`}>
                      {step.name}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] hidden sm:block">{step.description}</div>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div aria-hidden="true" className={`h-1 flex-1 mx-2 ${currentStep > step.id ? 'bg-[var(--color-green)]' : 'bg-[var(--color-border)]'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step announcement for screen readers */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].name}
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-8 mb-6">
          {error && (
            <div role="alert" className="mb-6 p-4 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-xl">
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
            </div>
          )}

          {/* Step 1: Device Details */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <h2 className="text-xl font-semibold text-[var(--color-text)]">Device Details</h2>
                {user?.accountType === 'BUSINESS' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <Building2 className="w-3.5 h-3.5 text-[var(--color-green)]" />
                    Verified Business Account
                  </span>
                )}
              </div>

              {/* Organization Listing Mode Toggle for Business Sellers */}
              {user?.accountType === 'BUSINESS' && (
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200">
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 mb-2.5">
                    Listing Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updateFormData('isBulkListing', true)}
                      className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                        formData.isBulkListing
                          ? 'border-[var(--color-green)] bg-white shadow-xs ring-1 ring-[var(--color-green)]'
                          : 'border-emerald-100 bg-white/60 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs text-gray-900 mb-1">
                        <span className="flex items-center gap-1.5">
                          <PackageCheck className="w-3.5 h-3.5 text-[var(--color-green)]" />
                          Bulk Inventory Listing
                        </span>
                        {formData.isBulkListing && <CheckCircle2 className="w-4 h-4 text-[var(--color-green)]" />}
                      </div>
                      <p className="text-[11px] text-gray-500">List multi-unit inventory by quantity, color, and storage without individual IMEIs.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateFormData('isBulkListing', false)}
                      className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                        !formData.isBulkListing
                          ? 'border-[var(--color-green)] bg-white shadow-xs ring-1 ring-[var(--color-green)]'
                          : 'border-emerald-100 bg-white/60 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs text-gray-900 mb-1">
                        <span className="flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-gray-600" />
                          Single Device Listing
                        </span>
                        {!formData.isBulkListing && <CheckCircle2 className="w-4 h-4 text-[var(--color-green)]" />}
                      </div>
                      <p className="text-[11px] text-gray-500">List 1 specific device with individual IMEI and Trust Lens diagnostics.</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Bulk Specifications (Quantity, Color, Storage) */}
              {formData.isBulkListing && (
                <div className="p-4 rounded-xl bg-gray-50/90 border border-gray-200/90 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                    <PackageCheck className="w-4 h-4 text-[var(--color-green)]" />
                    Inventory Specifications
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Quantity */}
                    <div>
                      <label htmlFor="bulk-quantity" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                        Quantity in Stock <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="bulk-quantity"
                        type="number"
                        min="1"
                        required
                        value={formData.quantity}
                        onChange={(e) => updateFormData('quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent bg-white text-sm"
                      />
                      <p className="mt-1 text-[11px] text-gray-400">Total units available</p>
                    </div>

                    {/* Color */}
                    <div>
                      <label htmlFor="bulk-color" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                        Color
                      </label>
                      <select
                        id="bulk-color"
                        value={formData.color}
                        onChange={(e) => updateFormData('color', e.target.value)}
                        className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent bg-white text-sm"
                      >
                        <option value="">Select color</option>
                        {COLOR_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Storage Capacity */}
                    <div>
                      <label htmlFor="bulk-storage" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                        Storage Capacity
                      </label>
                      <select
                        id="bulk-storage"
                        value={formData.storageCapacity}
                        onChange={(e) => updateFormData('storageCapacity', e.target.value)}
                        className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent bg-white text-sm"
                      >
                        <option value="">Select storage</option>
                        {STORAGE_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="device-type" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Device Type <span className="text-red-500" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <select
                  id="device-type"
                  value={formData.deviceType}
                  onChange={(e) => {
                    updateFormData('deviceType', e.target.value as DeviceType);
                    updateFormData('brand', '');
                  }}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                >
                  {deviceTypeOptions.length > 0
                    ? deviceTypeOptions.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))
                    : Object.keys(POPULAR_BRANDS).map(value => (
                        <option key={value} value={value}>{DEVICE_TYPE_LABELS[value] ?? value}</option>
                      ))}
                </select>
              </div>

              <div>
                <label htmlFor="device-brand" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Brand <span className="text-red-500" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <select
                  id="device-brand"
                  value={formData.brand}
                  onChange={(e) => updateFormData('brand', e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                >
                  <option value="">Select a brand</option>
                  {(POPULAR_BRANDS[formData.deviceType] ?? ['Other']).map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="device-model" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Model <span className="text-red-500" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <input
                  id="device-model"
                  type="text"
                  value={formData.model}
                  onChange={(e) => updateFormData('model', e.target.value)}
                  placeholder="e.g., iPhone 14 Pro Max, Galaxy S23 Ultra"
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="listing-title" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Listing Title <span className="text-red-500" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <input
                  id="listing-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => updateFormData('title', e.target.value)}
                  placeholder="e.g., Like New iPhone 14 Pro Max 256GB - Space Black"
                  maxLength={100}
                  aria-describedby="listing-title-hint"
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                />
                <p id="listing-title-hint" className="mt-1 text-xs text-[var(--color-text-muted)]">{formData.title.length}/100 characters (minimum 10)</p>
              </div>

              <div>
                <label htmlFor="listing-description" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Description <span className="text-red-500" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <textarea
                  id="listing-description"
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  placeholder="Describe your device in detail. Include specifications, purchase date, usage history, etc."
                  rows={6}
                  maxLength={2000}
                  aria-describedby="listing-description-hint"
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                />
                <p id="listing-description-hint" className="mt-1 text-xs text-[var(--color-text-muted)]">{formData.description.length}/2000 characters (minimum 50)</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="listing-city" className="block text-sm font-medium text-[var(--color-text)]">
                    Dispatch Location / Ships From <span className="text-gray-400 font-normal text-xs">(City / Town)</span>
                  </label>
                  <span className="text-xs text-gray-400">e.g. London, Manchester</span>
                </div>
                <input
                  id="listing-city"
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => updateFormData('city', e.target.value)}
                  placeholder="e.g. London, UK"
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                />
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Displayed on your listing as the dispatch location and used to compute buyer shipping.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Condition */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-text)] mb-1">Device Condition</h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Select the grade that best reflects your device. Honest grading prevents disputes and returns.
                </p>
              </div>
              
              <fieldset>
                <legend className="block text-sm font-medium text-[var(--color-text)] mb-3">
                  Condition Grade <span className="text-red-500" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </legend>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Grade A */}
                  <button
                    type="button"
                    aria-pressed={formData.conditionGrade === 'A'}
                    onClick={() => updateFormData('conditionGrade', 'A')}
                    className={`relative p-5 border-2 rounded-xl text-left transition-all flex flex-col justify-between ${
                      formData.conditionGrade === 'A'
                        ? 'border-[var(--color-green)] bg-[var(--color-green)]/10 shadow-sm ring-1 ring-[var(--color-green)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]/40 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--color-green)]/20 text-[var(--color-green)]">
                          Grade A
                        </span>
                        <Sparkles className="w-4 h-4 text-[var(--color-green)]" aria-hidden="true" />
                      </div>
                      <div className="font-bold text-lg text-[var(--color-text)] mb-1">Pristine / Like New</div>
                      <p className="text-xs text-[var(--color-text-muted)] mb-3">Flawless cosmetic condition with minimal to zero signs of use.</p>
                      
                      <div className="space-y-1.5 text-xs text-[var(--color-text)] border-t border-[var(--color-border)]/60 pt-3">
                        <div className="flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-[var(--color-green)] shrink-0" aria-hidden="true" />
                          <span><strong>Screen:</strong> No scratches or blemishes</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-[var(--color-green)] shrink-0" aria-hidden="true" />
                          <span><strong>Body:</strong> Flawless casing / edges</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Battery className="w-3.5 h-3.5 text-[var(--color-green)] shrink-0" aria-hidden="true" />
                          <span><strong>Battery:</strong> 85% - 100% capacity</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Grade B */}
                  <button
                    type="button"
                    aria-pressed={formData.conditionGrade === 'B'}
                    onClick={() => updateFormData('conditionGrade', 'B')}
                    className={`relative p-5 border-2 rounded-xl text-left transition-all flex flex-col justify-between ${
                      formData.conditionGrade === 'B'
                        ? 'border-[var(--color-green)] bg-[var(--color-green)]/10 shadow-sm ring-1 ring-[var(--color-green)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]/40 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-700">
                          Grade B
                        </span>
                        <Smartphone className="w-4 h-4 text-blue-600" aria-hidden="true" />
                      </div>
                      <div className="font-bold text-lg text-[var(--color-text)] mb-1">Good Condition</div>
                      <p className="text-xs text-[var(--color-text-muted)] mb-3">Light normal wear. Fully functional with minor cosmetic marks.</p>
                      
                      <div className="space-y-1.5 text-xs text-[var(--color-text)] border-t border-[var(--color-border)]/60 pt-3">
                        <div className="flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                          <span><strong>Screen:</strong> Micro-scratches only</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                          <span><strong>Body:</strong> Light scuffs or edge wear</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Battery className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                          <span><strong>Battery:</strong> 80% - 84% capacity</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Grade C */}
                  <button
                    type="button"
                    aria-pressed={formData.conditionGrade === 'C'}
                    onClick={() => updateFormData('conditionGrade', 'C')}
                    className={`relative p-5 border-2 rounded-xl text-left transition-all flex flex-col justify-between ${
                      formData.conditionGrade === 'C'
                        ? 'border-[var(--color-green)] bg-[var(--color-green)]/10 shadow-sm ring-1 ring-[var(--color-green)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]/40 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-700">
                          Grade C
                        </span>
                        <Info className="w-4 h-4 text-amber-600" aria-hidden="true" />
                      </div>
                      <div className="font-bold text-lg text-[var(--color-text)] mb-1">Fair / Budget</div>
                      <p className="text-xs text-[var(--color-text-muted)] mb-3">Visible cosmetic wear and scratches, but 100% working hardware.</p>
                      
                      <div className="space-y-1.5 text-xs text-[var(--color-text)] border-t border-[var(--color-border)]/60 pt-3">
                        <div className="flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                          <span><strong>Screen:</strong> Visible light scratches</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                          <span><strong>Body:</strong> Noticeable marks/dents</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Battery className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                          <span><strong>Battery:</strong> 75% - 79% capacity</span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </fieldset>

              <div>
                <label htmlFor="cosmetic-condition" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Cosmetic Condition Details <span className="text-red-500" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <textarea
                  id="cosmetic-condition"
                  value={formData.cosmeticCondition}
                  onChange={(e) => updateFormData('cosmeticCondition', e.target.value)}
                  placeholder="Describe any scratches, dents, discoloration, or other cosmetic issues"
                  rows={4}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="functional-issues" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Functional Issues (if any)
                </label>
                <textarea
                  id="functional-issues"
                  value={formData.functionalIssues}
                  onChange={(e) => updateFormData('functionalIssues', e.target.value)}
                  placeholder="List any functional problems (e.g., battery life, buttons, connectivity). Leave empty if none."
                  rows={4}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                />
              </div>

              <fieldset>
                <legend className="block text-sm font-medium text-[var(--color-text)] mb-3">
                  Included Accessories
                </legend>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {ACCESSORIES_OPTIONS.map(accessory => (
                    <button
                      key={accessory}
                      type="button"
                      aria-pressed={formData.accessories.includes(accessory)}
                      onClick={() => toggleAccessory(accessory)}
                      className={`px-4 py-2 border-2 rounded-md text-sm transition ${
                        formData.accessories.includes(accessory)
                          ? 'border-[var(--color-green)] bg-[var(--color-green)]/10 text-[var(--color-green)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]/30'
                      }`}
                    >
                      {accessory}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {/* Step 3: Format & Pricing */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">Selling Format & Pricing</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                Choose how you want to sell your device. List at a fixed price or start an exciting auction.
              </p>

              {/* Format Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => updateFormData('format', 'FIXED_PRICE')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.format === 'FIXED_PRICE'
                      ? 'border-[var(--color-green)] bg-[var(--color-green)]/5 ring-1 ring-[var(--color-green)]'
                      : 'border-[var(--color-border)] bg-white hover:border-[var(--color-text-muted)]/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-base text-[var(--color-text)]">Buy It Now</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Fixed Price</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Set a fixed asking price for immediate purchase with escrow checkout.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => updateFormData('format', 'AUCTION')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.format === 'AUCTION'
                      ? 'border-[var(--color-green)] bg-[var(--color-green)]/5 ring-1 ring-[var(--color-green)]'
                      : 'border-[var(--color-border)] bg-white hover:border-[var(--color-text-muted)]/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Gavel className="w-4 h-4 text-amber-600" />
                      <span className="font-semibold text-base text-[var(--color-text)]">Online Auction</span>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">eBay Style</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Let buyers compete with proxy bidding, soft-close extensions, and optional reserve price.
                  </p>
                </button>
              </div>

              {/* Fixed Price Form */}
              {formData.format === 'FIXED_PRICE' && (
                <div className="space-y-4 pt-2">
                  <div>
                    <label htmlFor="listing-price" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Price <span className="text-red-500" aria-hidden="true">*</span>
                      <span className="sr-only">(required)</span>
                    </label>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <input
                          id="listing-price"
                          type="number"
                          value={formData.price}
                          onChange={(e) => updateFormData('price', e.target.value)}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                        />
                      </div>
                      <label htmlFor="listing-currency" className="sr-only">Currency</label>
                      <select
                        id="listing-currency"
                        value={formData.currency}
                        onChange={(e) => updateFormData('currency', e.target.value)}
                        className="px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                      >
                        <option value="GBP">GBP (£)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                    <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                      Set a competitive price. Trust Lens verification helps you command higher prices.
                    </p>
                  </div>

                  <div className="bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg p-4">
                    <h3 className="font-semibold text-[var(--color-text)] mb-2">
                      <Lightbulb className="w-4 h-4 inline mr-1" aria-hidden="true" /> Pricing Tips
                    </h3>
                    <ul className="text-sm text-[var(--color-text-muted)] space-y-1">
                      <li>• Trust Lens verified listings give buyers confidence and attract more interest</li>
                      <li>• Grade A devices typically sell for 15-20% more than Grade B</li>
                      <li>• Include accessories to justify premium pricing</li>
                      <li>• Research similar devices on VeriBuy to set competitive prices</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Auction Configuration Form */}
              {formData.format === 'AUCTION' && (
                <div className="space-y-5 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Starting Bid */}
                    <div>
                      <label htmlFor="listing-starting-bid" className="block text-sm font-medium text-[var(--color-text)] mb-1">
                        Starting Bid (£) <span className="text-red-500" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="listing-starting-bid"
                        type="number"
                        value={formData.startingBid}
                        onChange={(e) => updateFormData('startingBid', e.target.value)}
                        placeholder="0.99"
                        step="0.01"
                        min="0.01"
                        className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                      />
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Starting at £0.99 attracts up to 3x more initial bidders.
                      </p>
                    </div>

                    {/* Auction Duration */}
                    <div>
                      <label htmlFor="listing-duration" className="block text-sm font-medium text-[var(--color-text)] mb-1">
                        Auction Duration <span className="text-red-500" aria-hidden="true">*</span>
                      </label>
                      <select
                        id="listing-duration"
                        value={formData.durationDays}
                        onChange={(e) => updateFormData('durationDays', Number(e.target.value))}
                        className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent bg-white"
                      >
                        <option value={1}>1 Day (Flash Auction)</option>
                        <option value={3}>3 Days</option>
                        <option value={5}>5 Days</option>
                        <option value={7}>7 Days (Recommended)</option>
                        <option value={10}>10 Days</option>
                      </select>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        7-day auctions allow peak visibility across weekend browsing.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Reserve Price (Optional) */}
                    <div>
                      <label htmlFor="listing-reserve-price" className="block text-sm font-medium text-[var(--color-text)] mb-1">
                        Reserve Price (£) <span className="text-xs font-normal text-[var(--color-text-muted)]">(Optional)</span>
                      </label>
                      <input
                        id="listing-reserve-price"
                        type="number"
                        value={formData.reservePrice}
                        onChange={(e) => updateFormData('reservePrice', e.target.value)}
                        placeholder="e.g. 250.00"
                        step="0.01"
                        min="0"
                        className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                      />
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Hidden minimum price. Item won&apos;t sell unless bids reach this threshold.
                      </p>
                    </div>

                    {/* Buy It Now Price (Optional) */}
                    <div>
                      <label htmlFor="listing-bin-price" className="block text-sm font-medium text-[var(--color-text)] mb-1">
                        Buy It Now Price (£) <span className="text-xs font-normal text-[var(--color-text-muted)]">(Optional)</span>
                      </label>
                      <input
                        id="listing-bin-price"
                        type="number"
                        value={formData.buyItNowPrice}
                        onChange={(e) => updateFormData('buyItNowPrice', e.target.value)}
                        placeholder="e.g. 350.00"
                        step="0.01"
                        min="0"
                        className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                      />
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Allows buyers to bypass the auction and purchase instantly.
                      </p>
                    </div>
                  </div>

                  {/* Anti-sniping protection callout */}
                  <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-amber-950">
                      <Timer className="w-4 h-4 text-amber-700" />
                      <span>VeriBuy Anti-Sniping Protection Included</span>
                    </div>
                    <p>
                      If a bid is placed within the final 2 minutes of the auction, the clock automatically extends by +2 minutes to ensure fair competition and protect against automated sniping bots.
                    </p>
                  </div>
                </div>
              )}

              {/* Delivery & Shipping Option */}
              <div className="border-t border-[var(--color-border)] pt-6">
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-1">
                  Delivery Method & Shipping Cost
                </label>
                <p className="text-sm text-[var(--color-text-muted)] mb-4">
                  Choose whether you cover delivery or if the buyer pays for shipping at checkout.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => updateFormData('freeShipping', false)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      !formData.freeShipping
                        ? 'border-[var(--color-green)] bg-[var(--color-green)]/5 ring-1 ring-[var(--color-green)]'
                        : 'border-[var(--color-border)] bg-white hover:border-[var(--color-text-muted)]/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-[var(--color-text-muted)]" />
                        <span className="font-semibold text-sm text-[var(--color-text)]">Buyer Pays Shipping</span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        !formData.freeShipping ? 'border-[var(--color-green)] bg-[var(--color-green)]' : 'border-gray-300'
                      }`}>
                        {!formData.freeShipping && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      Standard tracked UK courier shipping fee (£12.00) will be paid by the buyer during checkout.
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      Buyer protection fee is calculated separately.
                    </p>
                  </div>

                  <div
                    onClick={() => updateFormData('freeShipping', true)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      formData.freeShipping
                        ? 'border-[var(--color-green)] bg-[var(--color-green)]/5 ring-1 ring-[var(--color-green)]'
                        : 'border-[var(--color-border)] bg-white hover:border-[var(--color-text-muted)]/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-[var(--color-green)]" />
                        <div>
                          <span className="font-semibold text-sm text-[var(--color-text)]">Free UK Delivery</span>
                          <span className="ml-2 text-xs bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Covered by Seller</span>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        formData.freeShipping ? 'border-[var(--color-green)] bg-[var(--color-green)]' : 'border-gray-300'
                      }`}>
                        {formData.freeShipping && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      You cover delivery (assumed included in your asking price). Buyer pays <strong className="text-emerald-700">£0.00</strong> for shipping.
                    </p>
                    <p className="text-xs text-amber-700 font-medium mt-1">
                      Note: VeriBuy Buyer Protection fee remains applicable to ensure secure escrow.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Verification & Evidence */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">
                {formData.isBulkListing ? 'Batch Verification & Photo Evidence' : 'Trust Lens Verification'}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mb-6">
                {formData.isBulkListing
                  ? 'Upload representative photos of your inventory batch. Bulk listings operate under your verified business credentials.'
                  : 'Provide device identifiers and evidence images for verification. This helps build buyer trust and reduces disputes.'}
              </p>

              {formData.isBulkListing ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-emerald-100 rounded-lg text-emerald-700">
                      <PackageCheck className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-emerald-950 text-base flex items-center gap-2">
                        Business Bulk Inventory Authorization
                        <span className="text-xs bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-semibold">
                          IMEI Check Waived
                        </span>
                      </h3>
                      <p className="text-xs text-emerald-800 mt-1">
                        Individual 15-digit IMEI verification is not required upfront for bulk business inventory. Each unit dispatched will be fulfilled under your Verified Business credentials.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="bg-white border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-md font-medium">
                          Stock: <strong>{formData.quantity} units</strong>
                        </span>
                        {formData.storageCapacity && (
                          <span className="bg-white border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-md font-medium">
                            Storage: <strong>{formData.storageCapacity}</strong>
                          </span>
                        )}
                        {formData.color && (
                          <span className="bg-white border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-md font-medium">
                            Color: <strong>{formData.color}</strong>
                          </span>
                        )}
                        <span className="bg-white border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-md font-medium">
                          Condition: <strong>Grade {formData.conditionGrade}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-[var(--color-text)] mb-2">
                      <AlertTriangle className="w-4 h-4 inline mr-1" aria-hidden="true" /> Verification Requirements
                    </h3>
                    <ul className="text-sm text-[var(--color-text-muted)] space-y-1">
                      <li>• IMEI required for phones; serial optional. Tablets/smartwatches need IMEI or serial (laptops & AirPods may use serial only)</li>
                      <li>• At least 3 high-quality device images (various angles)</li>
                      <li>• At least 1 screen/display image (powered on)</li>
                      <li>• Optional: Screenshots of Settings showing device info</li>
                      <li>• All images will be timestamped and stored for dispute resolution</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label htmlFor="device-imei" className="block text-sm font-medium text-[var(--color-text)]">
                          IMEI <span className="text-red-500" aria-hidden="true">*</span>
                          <span className="sr-only">(required)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowImeiGuide(!showImeiGuide)}
                          className="text-xs text-[var(--color-green)] hover:underline inline-flex items-center gap-1 font-medium"
                        >
                          <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          Where do I find my IMEI?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="device-imei"
                          type="text"
                          value={formData.imei}
                          onChange={(e) => updateFormData('imei', e.target.value.replace(/[^\d]/g, '').slice(0, 15))}
                          placeholder="15-digit IMEI (numbers only)"
                          maxLength={15}
                          aria-describedby="device-imei-hint"
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
                            (() => {
                              const check = validateImeiChecksum(formData.imei);
                              if (check.status === 'valid') return 'border-[var(--color-green)] focus:ring-[var(--color-green)] pr-10';
                              if (check.status === 'invalid') return 'border-amber-500 focus:ring-amber-500 pr-10';
                              return 'border-[var(--color-border)] focus:ring-[var(--color-green)]';
                            })()
                          }`}
                        />
                        {(() => {
                          const check = validateImeiChecksum(formData.imei);
                          if (check.status === 'valid') {
                            return (
                              <div className="absolute right-3 top-2.5 text-[var(--color-green)]" title="Valid IMEI checksum">
                                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                              </div>
                            );
                          }
                          if (check.status === 'invalid') {
                            return (
                              <div className="absolute right-3 top-2.5 text-amber-500" title="Check-digit mismatch">
                                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Real-time validation feedback */}
                      <div id="device-imei-hint" className="mt-1.5 flex items-center justify-between text-xs">
                        {(() => {
                          const check = validateImeiChecksum(formData.imei);
                          if (check.status === 'valid') {
                            return <span className="text-[var(--color-green)] font-medium flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 inline" /> {check.message}</span>;
                          }
                          if (check.status === 'invalid') {
                            return <span className="text-amber-600 font-medium">{check.message}</span>;
                          }
                          if (check.status === 'incomplete') {
                            return <span className="text-[var(--color-text-muted)]">{check.message}</span>;
                          }
                          return <span className="text-[var(--color-text-muted)]">Dial *#06# on phone to find IMEI</span>;
                        })()}
                        <span className="text-[var(--color-text-muted)] ml-auto">{formData.imei.length}/15</span>
                      </div>

                      {/* IMEI Retrieval Help Popover/Drawer */}
                      {showImeiGuide && (
                        <div className="mt-3 p-4 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl relative text-xs text-[var(--color-text)]">
                          <button
                            type="button"
                            onClick={() => setShowImeiGuide(false)}
                            className="absolute top-2.5 right-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                            aria-label="Close IMEI guide"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <h4 className="font-bold text-sm mb-2 text-[var(--color-text)] flex items-center gap-1.5">
                            <Smartphone className="w-4 h-4 text-[var(--color-green)]" />
                            How to find your 15-digit IMEI:
                          </h4>
                          <div className="space-y-2 text-[var(--color-text-muted)]">
                            <div>
                              <strong className="text-[var(--color-text)]">Universal Dial Code:</strong> Open phone keypad and dial <code className="bg-white px-1.5 py-0.5 rounded border border-[var(--color-border)] font-mono text-[var(--color-green)] font-bold">*#06#</code>. The IMEI displays immediately.
                            </div>
                            <div>
                              <strong className="text-[var(--color-text)]">Apple iPhone:</strong> Go to <span className="font-medium text-[var(--color-text)]">Settings → General → About</span> and scroll down to IMEI.
                            </div>
                            <div>
                              <strong className="text-[var(--color-text)]">Android:</strong> Go to <span className="font-medium text-[var(--color-text)]">Settings → About phone → Status / IMEI</span>.
                            </div>
                            <div>
                              <strong className="text-[var(--color-text)]">Physical Device:</strong> Check the SIM tray or original retail box barcode label.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="device-serial" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                        Serial Number
                      </label>
                      <input
                        id="device-serial"
                        type="text"
                        value={formData.serialNumber}
                        onChange={(e) => updateFormData('serialNumber', e.target.value)}
                        placeholder="Device serial number (optional for phones)"
                        aria-describedby="device-serial-hint"
                        className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                      />
                      <p id="device-serial-hint" className="mt-1 text-xs text-[var(--color-text-muted)]">Found in Settings → About or on original box</p>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label htmlFor="device-images" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Device Images <span className="text-red-500" aria-hidden="true">*</span>
                  <span className="sr-only">(required, minimum 3)</span>
                </label>
                <input
                  id="device-images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileChange('deviceImages', e.target.files)}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                  aria-describedby="device-images-hint"
                />
                <p id="device-images-hint" className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Upload clear images from multiple angles (front, back, sides).{' '}
                  <span aria-live="polite">{formData.deviceImages.length} file(s) selected.</span>
                </p>
                {formData.deviceImages.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Selected device image previews">
                    {formData.deviceImages.map((file, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={deviceImageURLs[idx]}
                          alt={`Device image ${idx + 1}: ${file.name}`}
                          className="w-full h-24 object-cover rounded border border-[var(--color-border)]"
                        />
                        <div aria-hidden="true" className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate rounded-b">
                          {file.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="screen-images" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Screen/Display Images <span className="text-red-500" aria-hidden="true">*</span>
                  <span className="sr-only">(required, minimum 1)</span>
                </label>
                <input
                  id="screen-images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileChange('screenImages', e.target.files)}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                  aria-describedby="screen-images-hint"
                />
                <p id="screen-images-hint" className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Show the screen powered on.{' '}
                  <span aria-live="polite">{formData.screenImages.length} file(s) selected.</span>
                </p>
                {formData.screenImages.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Selected screen image previews">
                    {formData.screenImages.map((file, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={screenImageURLs[idx]}
                          alt={`Screen image ${idx + 1}: ${file.name}`}
                          className="w-full h-24 object-cover rounded border border-[var(--color-border)]"
                        />
                        <div aria-hidden="true" className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate rounded-b">
                          {file.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="settings-screenshot" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Settings Screenshot (Optional)
                </label>
                <input
                  id="settings-screenshot"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileChange('settingsScreenshot', e.target.files)}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                  aria-describedby="settings-screenshot-hint"
                />
                <p id="settings-screenshot-hint" className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Screenshot of Settings → About showing device info.{' '}
                  <span aria-live="polite">{formData.settingsScreenshot.length} file(s) selected.</span>
                </p>
                {formData.settingsScreenshot.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Selected settings screenshot previews">
                    {formData.settingsScreenshot.map((file, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={settingsImageURLs[idx]}
                          alt={`Settings screenshot ${idx + 1}: ${file.name}`}
                          className="w-full h-24 object-cover rounded border border-[var(--color-border)]"
                        />
                        <div aria-hidden="true" className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate rounded-b">
                          {file.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="px-6 py-3 border border-[var(--color-border)] rounded-md text-[var(--color-text)] hover:bg-[var(--color-surface-alt)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {currentStep < STEPS.length ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90"
            >
              Next Step
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-3 bg-[var(--color-accent)] text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSubmitting 
                ? (uploadingFiles ? 'Uploading Images...' : 'Creating Listing...') 
                : (formData.isBulkListing ? 'Publish Business Listing' : 'Submit for Verification')}
            </button>
          )}
        </div>

        <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">
          {formData.isBulkListing
            ? 'Bulk inventory will be published immediately under your verified business credentials.'
            : 'Your IMEI will be checked automatically. Flagged listings are reviewed by an admin.'}
        </p>
      </div>
    </div>
  );
}
