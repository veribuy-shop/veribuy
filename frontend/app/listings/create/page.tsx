'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { Lightbulb, AlertTriangle } from 'lucide-react';

type DeviceType = 'SMARTPHONE' | 'TABLET' | 'SMARTWATCH';
type ConditionGrade = 'A' | 'B' | 'C';

interface ListingFormData {
  // Step 1: Device Details
  deviceType: DeviceType;
  brand: string;
  model: string;
  title: string;
  description: string;
  
  // Step 2: Condition
  conditionGrade: ConditionGrade;
  cosmeticCondition: string;
  functionalIssues: string;
  accessories: string[];
  
  // Step 3: Pricing
  price: string;
  currency: string;
  
  // Step 4: Device Identifiers & Evidence
  imei: string;
  serialNumber: string;
  deviceImages: File[];
  screenImages: File[];
  bodyImages: File[];
  settingsScreenshot: File[];
}

const STEPS = [
  { id: 1, name: 'Device Details', description: 'Basic device information' },
  { id: 2, name: 'Condition', description: 'Device condition assessment' },
  { id: 3, name: 'Pricing', description: 'Set your price' },
  { id: 4, name: 'Verification', description: 'IMEI/Serial & Evidence' },
];

const DEVICE_TYPES: { value: DeviceType; label: string }[] = [
  { value: 'SMARTPHONE', label: 'Smartphone' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'SMARTWATCH', label: 'Smartwatch' },
];

const POPULAR_BRANDS: Record<DeviceType, string[]> = {
  SMARTPHONE: ['Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi', 'Motorola', 'Other'],
  TABLET: ['Apple', 'Samsung', 'Microsoft', 'Lenovo', 'Amazon', 'Other'],
  SMARTWATCH: ['Apple', 'Samsung', 'Garmin', 'Fitbit', 'Other'],
};

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
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});

  const [formData, setFormData] = useState<ListingFormData>({
    deviceType: 'SMARTPHONE',
    brand: '',
    model: '',
    title: '',
    description: '',
    conditionGrade: 'B',
    cosmeticCondition: '',
    functionalIssues: '',
    accessories: [],
    price: '',
    currency: 'GBP',
    imei: '',
    serialNumber: '',
    deviceImages: [],
    screenImages: [],
    bodyImages: [],
    settingsScreenshot: [],
  });

  // PERF-06: useObjectURLs must be called after formData is declared so the
  // initial empty arrays are accessible on first render.
  const deviceImageURLs    = useObjectURLs(formData.deviceImages);
  const screenImageURLs    = useObjectURLs(formData.screenImages);
  const bodyImageURLs      = useObjectURLs(formData.bodyImages);
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
    }
    
    if (step === 2) {
      if (!formData.conditionGrade || !formData.cosmeticCondition) {
        setError('Please select condition grade and describe cosmetic condition');
        return false;
      }
    }
    
    if (step === 3) {
      const price = parseFloat(formData.price);
      if (!formData.price || isNaN(price) || price <= 0) {
        setError('Please enter a valid price');
        return false;
      }
    }
    
    if (step === 4) {
      // Require IMEI or serial for all supported device types
      if (!formData.imei && !formData.serialNumber) {
        setError('IMEI or Serial Number is required for verification');
        return false;
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
      const listingData = {
        deviceType: formData.deviceType,
        brand: formData.brand,
        model: formData.model,
        title: formData.title,
        description: `${formData.description}\n\nCosmetic Condition: ${formData.cosmeticCondition}\nFunctional Issues: ${formData.functionalIssues || 'None reported'}\nIncluded Accessories: ${formData.accessories.join(', ') || 'None'}`,
        price: parseFloat(formData.price),
        currency: formData.currency,
        conditionGrade: formData.conditionGrade,
        imei: formData.imei || undefined,
        serialNumber: formData.serialNumber || undefined,
      };

      const response = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
        ...formData.bodyImages.map(f => ({ file: f, type: 'BODY_IMAGE' })),
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
            return fetch('/api/evidence', {
              method: 'POST',
              credentials: 'include',
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
      
      // Step 3: Create verification request in Trust Lens
      try {
        if (!user?.id) {
          console.error('User ID unavailable when creating verification request — skipping');
        } else {
          const verificationData = {
            listingId: listing.id,
            sellerId: user.id,
            conditionGrade: formData.conditionGrade,
            imeiProvided: !!formData.imei,
            serialProvided: !!formData.serialNumber,
            imei: formData.imei || undefined,
            serialNumber: formData.serialNumber || undefined,
            brand: formData.brand || undefined,
          };

          const verificationResponse = await fetch('/api/trust-lens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(verificationData),
          });

          if (!verificationResponse.ok) {
            console.error('Failed to create verification request');
          }
        }
      } catch (verificationError) {
        console.error('Verification request error:', verificationError);
        // Don't block the flow if verification fails
      }
      
      // Redirect to the listing detail page
      router.push(`/listings/${listing.id}`);
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
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Device Details</h2>
              
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
                  {DEVICE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
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
                  {POPULAR_BRANDS[formData.deviceType].map(brand => (
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
            </div>
          )}

          {/* Step 2: Condition */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Device Condition</h2>
              
              <fieldset>
                <legend className="block text-sm font-medium text-[var(--color-text)] mb-3">
                  Condition Grade <span className="text-red-500" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </legend>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    type="button"
                    aria-pressed={formData.conditionGrade === 'A'}
                    onClick={() => updateFormData('conditionGrade', 'A')}
                    className={`p-4 border-2 rounded-lg text-left transition ${
                      formData.conditionGrade === 'A'
                        ? 'border-[var(--color-green)] bg-[var(--color-green)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]/30'
                    }`}
                  >
                    <div className="font-semibold text-lg mb-1">Grade A - Excellent</div>
                    <div className="text-sm text-[var(--color-text-muted)]">Like new, minimal signs of use, fully functional</div>
                  </button>
                  <button
                    type="button"
                    aria-pressed={formData.conditionGrade === 'B'}
                    onClick={() => updateFormData('conditionGrade', 'B')}
                    className={`p-4 border-2 rounded-lg text-left transition ${
                      formData.conditionGrade === 'B'
                        ? 'border-[var(--color-green)] bg-[var(--color-green)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]/30'
                    }`}
                  >
                    <div className="font-semibold text-lg mb-1">Grade B - Good</div>
                    <div className="text-sm text-[var(--color-text-muted)]">Normal wear, minor scratches, fully functional</div>
                  </button>
                  <button
                    type="button"
                    aria-pressed={formData.conditionGrade === 'C'}
                    onClick={() => updateFormData('conditionGrade', 'C')}
                    className={`p-4 border-2 rounded-lg text-left transition ${
                      formData.conditionGrade === 'C'
                        ? 'border-[var(--color-green)] bg-[var(--color-green)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]/30'
                    }`}
                  >
                    <div className="font-semibold text-lg mb-1">Grade C - Fair</div>
                    <div className="text-sm text-[var(--color-text-muted)]">Visible wear, scratches/dents, fully functional</div>
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

          {/* Step 3: Pricing */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Pricing</h2>
              
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
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
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

          {/* Step 4: Verification & Evidence */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">Trust Lens Verification</h2>
              <p className="text-sm text-[var(--color-text-muted)] mb-6">
                Provide device identifiers and evidence images for verification. This helps build buyer trust and reduces disputes.
              </p>

              <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-[var(--color-text)] mb-2">
                  <AlertTriangle className="w-4 h-4 inline mr-1" aria-hidden="true" /> Verification Requirements
                </h3>
                <ul className="text-sm text-[var(--color-text-muted)] space-y-1">
                  <li>• IMEI or Serial Number (required for all devices)</li>
                  <li>• At least 3 high-quality device images (various angles)</li>
                  <li>• At least 1 screen/display image (powered on)</li>
                  <li>• Optional: Screenshots of Settings showing device info</li>
                  <li>• All images will be timestamped and stored for dispute resolution</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="device-imei" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                    IMEI <span className="text-red-500" aria-hidden="true">*</span>
                    <span className="sr-only">(required)</span>
                  </label>
                  <input
                    id="device-imei"
                    type="text"
                    value={formData.imei}
                    onChange={(e) => updateFormData('imei', e.target.value)}
                    placeholder="15 digits"
                    maxLength={15}
                    aria-describedby="device-imei-hint"
                    className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                  />
                  <p id="device-imei-hint" className="mt-1 text-xs text-[var(--color-text-muted)]">Dial *#06# on the device to find IMEI</p>
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
                    placeholder="Device serial number"
                    aria-describedby="device-serial-hint"
                    className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                  />
                  <p id="device-serial-hint" className="mt-1 text-xs text-[var(--color-text-muted)]">Found in Settings → About</p>
                </div>
              </div>

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
                <label htmlFor="body-images" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Body/Cosmetic Condition Images
                </label>
                <input
                  id="body-images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileChange('bodyImages', e.target.files)}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                  aria-describedby="body-images-hint"
                />
                <p id="body-images-hint" className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Show any scratches, dents, or wear.{' '}
                  <span aria-live="polite">{formData.bodyImages.length} file(s) selected.</span>
                </p>
                {formData.bodyImages.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Selected body image previews">
                    {formData.bodyImages.map((file, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={bodyImageURLs[idx]}
                          alt={`Body image ${idx + 1}: ${file.name}`}
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
              className="px-6 py-3 bg-[var(--color-accent)] text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting 
                ? (uploadingFiles ? 'Uploading Images...' : 'Creating Listing...') 
                : 'Submit for Verification'}
            </button>
          )}
        </div>

        <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">
          Your IMEI will be checked automatically. Flagged listings are reviewed by an admin
        </p>
      </div>
    </div>
  );
}
