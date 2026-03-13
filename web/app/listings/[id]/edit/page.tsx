'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { Camera, CircleX } from 'lucide-react';
import ConfirmModal from '@/components/confirm-modal';

type ConditionGrade = 'A' | 'B' | 'C';
type ListingStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING_VERIFICATION' | 'SOLD';
type EvidenceType = 'DEVICE_IMAGE' | 'SCREEN_IMAGE' | 'BODY_IMAGE' | 'SETTINGS_SCREENSHOT' | 'IMEI_SCREENSHOT' | 'PACKAGING_IMAGE' | 'ACCESSORIES_IMAGE' | 'OTHER';

interface EvidenceItem {
  id: string;
  fileUrl: string;
  fileName: string;
  type: EvidenceType;
  uploadedAt: string;
}

interface EditFormData {
  title: string;
  description: string;
  price: string;
  currency: string;
  conditionGrade: ConditionGrade;
  status: ListingStatus;
  color: string;
  storageCapacity: string;
}

const CURRENCIES = [
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
  { value: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { value: 'KES', label: 'KES — Kenyan Shilling' },
  { value: 'ZAR', label: 'ZAR — South African Rand' },
];

const CONDITION_GRADES: { value: ConditionGrade; label: string; description: string }[] = [
  { value: 'A', label: 'Grade A — Excellent', description: 'Like new with minimal signs of use. Fully functional with no cosmetic damage.' },
  { value: 'B', label: 'Grade B — Good', description: 'Normal wear with minor scratches or marks. Fully functional.' },
  { value: 'C', label: 'Grade C — Fair', description: 'Visible wear, scratches, or dents. Fully functional but shows use.' },
];

const EDITABLE_STATUSES: { value: ListingStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active — Visible to buyers' },
  { value: 'INACTIVE', label: 'Inactive — Hidden from buyers' },
];

const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  DEVICE_IMAGE: 'Device Image',
  SCREEN_IMAGE: 'Screen Image',
  BODY_IMAGE: 'Body Image',
  SETTINGS_SCREENSHOT: 'Settings Screenshot',
  IMEI_SCREENSHOT: 'IMEI Screenshot',
  PACKAGING_IMAGE: 'Packaging Image',
  ACCESSORIES_IMAGE: 'Accessories Image',
  OTHER: 'Other',
};

const UPLOAD_TYPES: { value: EvidenceType; label: string }[] = [
  { value: 'DEVICE_IMAGE', label: 'Device Image' },
  { value: 'SCREEN_IMAGE', label: 'Screen Image' },
  { value: 'BODY_IMAGE', label: 'Body Image' },
  { value: 'SETTINGS_SCREENSHOT', label: 'Settings Screenshot' },
  { value: 'IMEI_SCREENSHOT', label: 'IMEI Screenshot' },
  { value: 'PACKAGING_IMAGE', label: 'Packaging' },
  { value: 'ACCESSORIES_IMAGE', label: 'Accessories' },
  { value: 'OTHER', label: 'Other' },
];

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [listingTitle, setListingTitle] = useState('');

  // Evidence / images state
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<EvidenceItem | null>(null);
  const [uploadType, setUploadType] = useState<EvidenceType>('DEVICE_IMAGE');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  const [formData, setFormData] = useState<EditFormData>({
    title: '',
    description: '',
    price: '',
    currency: 'GBP',
    conditionGrade: 'B',
    status: 'ACTIVE',
    color: '',
    storageCapacity: '',
  });

  useEffect(() => {
    if (!user) return;
    fetchListing();
    fetchEvidence();
  }, [id, user?.id]); // PERF-08: depend on user?.id (primitive) not user object to avoid unnecessary re-runs

  const fetchListing = async () => {
    setLoading(true);
    setLoadError('');

    try {
      const response = await fetch(`/api/listings/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        setLoadError(response.status === 404 ? 'Listing not found.' : 'Failed to load listing. Please try again.');
        return;
      }

      const data = await response.json();

      // SEC-08: This check is UX-only — it gives non-owners an early redirect rather
      // than rendering a broken form. The actual ownership enforcement MUST happen
      // server-side: the PATCH /api/listings/:id handler must verify that the
      // authenticated user's JWT sub matches the listing's sellerId before allowing
      // any update. Do NOT rely on this client check as a security boundary.
      if (data.sellerId !== user?.id) {
        router.replace('/dashboard');
        return;
      }

      setListingTitle(data.title);
      setFormData({
        title: data.title ?? '',
        description: data.description ?? '',
        price: data.price != null ? String(data.price) : '',
        currency: data.currency ?? 'GBP',
        conditionGrade: data.conditionGrade ?? 'B',
        status: (['ACTIVE', 'INACTIVE'].includes(data.status) ? data.status : 'INACTIVE') as ListingStatus,
        color: data.color ?? '',
        storageCapacity: data.storageCapacity ?? '',
      });
    } catch (err) {
      console.error('Error loading listing:', err);
      setLoadError('An error occurred while loading the listing.');
    } finally {
      setLoading(false);
    }
  };

  const fetchEvidence = async () => {
    try {
      const response = await fetch(`/api/evidence?listingId=${id}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setEvidenceItems(data.items ?? []);
      }
    } catch (err) {
      console.error('Error loading evidence:', err);
    }
  };

  const handleDeleteImage = async () => {
    if (!confirmDeleteItem) return;
    const itemId = confirmDeleteItem.id;

    setDeletingItemId(itemId);
    setConfirmDeleteItem(null);
    try {
      const response = await fetch(`/api/evidence/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        setUploadError(data.error || 'Failed to delete image. Please try again.');
        return;
      }

      setEvidenceItems(prev => prev.filter(item => item.id !== itemId));
    } catch (err) {
      console.error('Error deleting image:', err);
      setUploadError('An error occurred while deleting the image.');
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Only image files are allowed.');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image must be smaller than 10MB.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const formPayload = new FormData();
      formPayload.append('file', file);
      formPayload.append('listingId', id);
      formPayload.append('type', uploadType);

      const response = await fetch('/api/evidence', {
        method: 'POST',
        credentials: 'include',
        body: formPayload,
      });

      const data = await response.json();

      if (!response.ok) {
        setUploadError(data.message || data.error || 'Failed to upload image. Please try again.');
        return;
      }

      // Add new item to the list
      setEvidenceItems(prev => [...prev, data]);
      setUploadSuccess(`${EVIDENCE_TYPE_LABELS[uploadType]} uploaded successfully.`);

      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Clear success message after 3s
      setTimeout(() => setUploadSuccess(''), 3000);
    } catch (err) {
      console.error('Error uploading image:', err);
      setUploadError('An error occurred while uploading. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (saveError) setSaveError('');
  };

  const validate = (): string | null => {
    if (!formData.title.trim() || formData.title.trim().length < 5) {
      return 'Title must be at least 5 characters.';
    }
    if (!formData.description.trim() || formData.description.trim().length < 20) {
      return 'Description must be at least 20 characters.';
    }
    const priceNum = parseFloat(formData.price);
    if (!formData.price || isNaN(priceNum) || priceNum <= 0) {
      return 'Price must be a positive number.';
    }
    if (!formData.currency) {
      return 'Please select a currency.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      const payload: Record<string, unknown> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        currency: formData.currency,
        conditionGrade: formData.conditionGrade,
        status: formData.status,
        color: formData.color.trim() || null,
        storageCapacity: formData.storageCapacity.trim() || null,
      };

      const response = await fetch(`/api/listings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setSaveError(data.error || 'Failed to save changes. Please try again.');
        return;
      }

      router.push(`/listings/${id}`);
    } catch (err) {
      console.error('Error saving listing:', err);
      setSaveError('An error occurred while saving. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center">
        <div className="text-center" role="status">
          <div className="inline-block motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-green)]" aria-hidden="true"></div>
          <span className="sr-only">Loading...</span>
          <p className="mt-4 text-[var(--color-text-muted)]" aria-hidden="true">Loading listing...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-[var(--color-border)] p-8 text-center">
          <CircleX className="w-12 h-12 text-[var(--color-danger)] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-4">Cannot Edit Listing</h1>
          <p className="text-[var(--color-text-muted)] mb-6">{loadError}</p>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] py-8">
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        {/* Breadcrumb */}
        <div className="text-sm text-[var(--color-text-muted)]">
          <Link href="/dashboard" className="hover:text-[var(--color-green)]">Dashboard</Link>
          {' > '}
          <Link href={`/listings/${id}`} className="hover:text-[var(--color-green)]">
            {listingTitle || 'Listing'}
          </Link>
          {' > '}
          <span className="text-[var(--color-text)]">Edit</span>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Section 1: Listing details form                                     */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-8">
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">Edit Listing</h1>
          <p className="text-[var(--color-text-muted)] mb-8 text-sm">
            Update your listing details below. Device identifiers (IMEI/Serial) and Trust Lens
            verification status cannot be changed after submission.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                Listing Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                maxLength={120}
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-md focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                placeholder="e.g. Apple iPhone 14 Pro 256GB — Excellent Condition"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{formData.title.length}/120 characters</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                required
                value={formData.description}
                onChange={handleChange}
                rows={5}
                maxLength={2000}
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-md focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent resize-y"
                placeholder="Describe the device's condition, included accessories, and any relevant details for the buyer..."
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{formData.description.length}/2000 characters</p>
            </div>

            {/* Price & Currency */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Price <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="price"
                  required
                  min="0.01"
                  step="0.01"
                  value={formData.price}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-md focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Currency <span className="text-red-500">*</span>
                </label>
                <select
                  name="currency"
                  required
                  value={formData.currency}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-md focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent bg-white"
                >
                  {CURRENCIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Condition Grade */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-2">
                Condition Grade <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {CONDITION_GRADES.map(grade => (
                  <label
                    key={grade.value}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      formData.conditionGrade === grade.value
                        ? 'border-[var(--color-green)] bg-[var(--color-green)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="conditionGrade"
                      value={grade.value}
                      checked={formData.conditionGrade === grade.value}
                      onChange={handleChange}
                      className="mt-0.5 accent-[var(--color-primary)]"
                    />
                    <div>
                      <p className="font-medium text-sm text-[var(--color-text)]">{grade.label}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{grade.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                Listing Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-md focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent bg-white"
              >
                {EDITABLE_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Listings in PENDING_VERIFICATION or SOLD status cannot be made active here.
              </p>
            </div>

            {/* Color & Storage */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Color <span className="text-[var(--color-text-muted)] font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  maxLength={50}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-md focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                  placeholder="e.g. Space Black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Storage Capacity <span className="text-[var(--color-text-muted)] font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  name="storageCapacity"
                  value={formData.storageCapacity}
                  onChange={handleChange}
                  maxLength={20}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-md focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                  placeholder="e.g. 256GB"
                />
              </div>
            </div>

            {saveError && (
              <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg p-4 text-sm text-[var(--color-danger)]">
                {saveError}
              </div>
            )}

            <div className="flex gap-4 pt-2">
              <button
                type="submit"
                disabled={saving}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
                  saving
                    ? 'bg-[var(--color-text-muted)] cursor-not-allowed'
                    : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]'
                }`}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <Link
                href={`/listings/${id}`}
                className="flex-1 px-6 py-3 rounded-lg font-semibold text-center border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Section 2: Image management                                         */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-8">
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-1">Photos &amp; Evidence</h2>
          <p className="text-[var(--color-text-muted)] text-sm mb-6">
            Manage your listing photos. Images are grouped by type. Adding clear photos helps buyers
            trust your listing.
          </p>

          {/* Existing images */}
          {evidenceItems.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-[var(--color-border)] rounded-lg mb-6">
              <Camera className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-2" />
              <p className="text-[var(--color-text-muted)] text-sm">No images uploaded yet</p>
            </div>
          ) : (
            <div className="mb-6 space-y-4">
              {/* Group by type */}
              {(Object.keys(EVIDENCE_TYPE_LABELS) as EvidenceType[]).map(type => {
                const items = evidenceItems.filter(item => item.type === type);
                if (items.length === 0) return null;
                return (
                  <div key={type}>
                    <h3 className="text-sm font-semibold text-[var(--color-text-muted)] mb-2">
                      {EVIDENCE_TYPE_LABELS[type]} ({items.length})
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {items.map(item => (
                        <div key={item.id} className="relative group">
                          <div className="aspect-square rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                            <img
                              src={item.fileUrl}
                              alt={item.fileName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {/* Delete overlay */}
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteItem(item)}
                            disabled={deletingItemId === item.id}
                            title="Delete image"
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 hover:bg-red-600"
                          >
                            {deletingItemId === item.id ? '…' : '×'}
                          </button>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)] truncate">{item.fileName}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Upload new image */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] mb-3">Upload a new image</h3>

            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Image type</label>
                <select
                  value={uploadType}
                  onChange={e => setUploadType(e.target.value as EvidenceType)}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent bg-white"
                >
                  {UPLOAD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <label
              className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                uploading
                  ? 'border-[var(--color-border)] bg-[var(--color-surface-alt)] cursor-not-allowed'
                  : 'border-[var(--color-green)] hover:bg-[var(--color-green)]/5'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={handleFileChange}
              />
              {uploading ? (
                <div className="text-center">
                  <div role="status" className="inline-flex flex-col items-center">
                    <div className="inline-block motion-safe:animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-green)] mb-2" aria-hidden="true"></div>
                    <span className="sr-only">Loading...</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">Uploading...</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-2xl mb-1">+</div>
                  <p className="text-sm text-[var(--color-green)] font-medium">Click to select image</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">JPG, PNG, WebP — max 10MB</p>
                </div>
              )}
            </label>

            {uploadError && (
              <div role="alert" className="mt-3 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg p-3 text-sm text-[var(--color-danger)]">
                {uploadError}
              </div>
            )}

            {uploadSuccess && (
              <div role="status" aria-live="polite" className="mt-3 bg-[var(--color-green)]/10 border border-[var(--color-green)]/30 rounded-lg p-3 text-sm text-[var(--color-green)]">
                {uploadSuccess}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Image Confirmation Modal */}
      <ConfirmModal
        isOpen={!!confirmDeleteItem}
        onClose={() => setConfirmDeleteItem(null)}
        onConfirm={handleDeleteImage}
        title="Delete Image"
        description="Are you sure you want to delete this image? This cannot be undone."
        confirmLabel="Delete Image"
        loadingLabel="Deleting..."
        variant="danger"
      >
        {confirmDeleteItem && (
          <>
            <p className="text-sm font-medium text-[var(--color-text)]">{confirmDeleteItem.fileName}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {EVIDENCE_TYPE_LABELS[confirmDeleteItem.type]}
            </p>
          </>
        )}
      </ConfirmModal>
    </div>
  );
}
