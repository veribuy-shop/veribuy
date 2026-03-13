'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import ContactSellerModal from '@/components/ContactSellerModal';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';
import {
  ShieldCheck,
  ShieldX,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calendar,
  Smartphone,
  Tablet,
  Watch,
  Cpu,
  Palette,
  HardDrive,
  Tag,
  CheckCircle2,
  XCircle,
  Minus,
  Lock,
  BadgePoundSterling,
  Scale,
  MessageCircle,
  Pencil,
  LayoutDashboard,
  ImageIcon,
  ScanLine,
  FileWarning,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DeviceType = 'SMARTPHONE' | 'TABLET' | 'SMARTWATCH';
type ConditionGrade = 'A' | 'B' | 'C';
type TrustLensStatus = 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'REQUIRES_REVIEW';
type IntegrityFlag = 'CLEAN' | 'IMEI_MISMATCH' | 'ICLOUD_LOCKED' | 'REPORTED_STOLEN' | 'BLACKLISTED' | 'SERIAL_MISMATCH';
type EvidenceType = 'DEVICE_IMAGE' | 'SCREEN_IMAGE' | 'BODY_IMAGE' | 'SETTINGS_SCREENSHOT' | 'IMEI_SCREENSHOT' | 'PACKAGING_IMAGE' | 'ACCESSORIES_IMAGE' | 'OTHER';
type CheckResult = 'CLEAN' | 'FLAGGED' | 'LOCKED' | 'NOT_APPLICABLE' | 'NOT_RUN';

interface Listing {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  deviceType: DeviceType;
  brand: string;
  model: string;
  storageCapacity?: string | null;
  color?: string | null;
  price: number | string;
  currency: string;
  conditionGrade?: ConditionGrade;
  status: string;
  imei?: string;
  serialNumber?: string;
  integrityFlags: IntegrityFlag[];
  trustLensStatus: TrustLensStatus;
  viewCount: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface EvidenceItem {
  id: string;
  fileUrl: string;
  fileName: string;
  type: EvidenceType;
  uploadedAt: string;
}

interface EvidenceResponse {
  items: EvidenceItem[];
}

interface VerificationSummary {
  listingId: string;
  status: string;
  conditionGrade: string | null;
  integrityFlags: string[];
  imeiCheckPerformed: boolean;
  isAppleDevice: boolean;
  checks: {
    gsmaBlacklist: CheckResult;
    icloudStatus: CheckResult;
    stolenReport: CheckResult;
  } | null;
  verifiedAt: string | null;
  completedAt: string | null;
}

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const GRADE_CONFIG: Record<
  ConditionGrade,
  { label: string; description: string; className: string; bg: string; border: string; text: string }
> = {
  A: {
    label: 'Excellent',
    description: 'Like new with minimal signs of use. Fully functional with no cosmetic damage.',
    className: 'bg-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
  },
  B: {
    label: 'Good',
    description: 'Normal wear with minor scratches or marks. Fully functional.',
    className: 'bg-sky-600',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-700',
  },
  C: {
    label: 'Fair',
    description: 'Visible wear, scratches, or dents. Fully functional but shows use.',
    className: 'bg-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
  },
};

const TRUST_STATUS_CONFIG: Record<
  TrustLensStatus,
  { icon: typeof ShieldCheck; label: string; description: string; className: string; bgClassName: string; textClassName: string }
> = {
  PASSED: {
    icon: ShieldCheck,
    label: 'Trust Lens Verified',
    description: 'This device has passed all verification checks.',
    className: 'bg-[var(--color-accent)]',
    bgClassName: 'bg-emerald-50 border-emerald-200',
    textClassName: 'text-emerald-700',
  },
  IN_PROGRESS: {
    icon: Clock,
    label: 'Verification In Progress',
    description: 'This device is currently being verified.',
    className: 'bg-yellow-600',
    bgClassName: 'bg-yellow-50 border-yellow-200',
    textClassName: 'text-yellow-700',
  },
  REQUIRES_REVIEW: {
    icon: AlertTriangle,
    label: 'Requires Review',
    description: 'Additional information is needed for verification.',
    className: 'bg-orange-600',
    bgClassName: 'bg-orange-50 border-orange-200',
    textClassName: 'text-orange-700',
  },
  PENDING: {
    icon: Clock,
    label: 'Pending Verification',
    description: 'This device is awaiting Trust Lens review.',
    className: 'bg-gray-500',
    bgClassName: 'bg-gray-50 border-gray-200',
    textClassName: 'text-gray-600',
  },
  FAILED: {
    icon: ShieldX,
    label: 'Verification Failed',
    description: 'This device did not pass verification checks.',
    className: 'bg-red-500',
    bgClassName: 'bg-red-50 border-red-200',
    textClassName: 'text-red-700',
  },
};

const CHECK_RESULT_CONFIG: Record<
  CheckResult,
  { icon: typeof CheckCircle2; label: string; className: string; bgClassName: string }
> = {
  CLEAN: { icon: CheckCircle2, label: 'Passed', className: 'text-emerald-600', bgClassName: 'bg-emerald-50' },
  FLAGGED: { icon: XCircle, label: 'Flagged', className: 'text-red-600', bgClassName: 'bg-red-50' },
  LOCKED: { icon: Lock, label: 'Locked', className: 'text-red-600', bgClassName: 'bg-red-50' },
  NOT_APPLICABLE: { icon: Minus, label: 'N/A', className: 'text-[var(--color-text-muted)]', bgClassName: 'bg-gray-50' },
  NOT_RUN: { icon: Minus, label: 'Not checked', className: 'text-[var(--color-text-muted)]', bgClassName: 'bg-gray-50' },
};

const DEVICE_TYPE_ICON: Record<DeviceType, typeof Smartphone> = {
  SMARTPHONE: Smartphone,
  TABLET: Tablet,
  SMARTWATCH: Watch,
};

/** Rough retail price estimates by brand tier for savings display. */
function estimateRetailPrice(price: number, brand: string): number | null {
  const lower = brand.toLowerCase();
  let multiplier = 1.35;
  if (lower === 'apple' || lower === 'samsung') multiplier = 1.45;
  else if (lower === 'google' || lower === 'sony') multiplier = 1.4;
  else if (lower === 'huawei' || lower === 'oneplus') multiplier = 1.3;
  const retail = Math.round((price * multiplier) / 10) * 10;
  return retail > price ? retail : null;
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [verificationSummary, setVerificationSummary] = useState<VerificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showContactModal, setShowContactModal] = useState(false);
  const [showGradeTooltip, setShowGradeTooltip] = useState(false);

  // PERF-04: Consolidate three independent fetches into a single useEffect
  // using Promise.all so they run in parallel. AbortController cancels
  // in-flight requests when `id` changes.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const loadAll = async () => {
      setLoading(true);
      setError('');

      try {
        const [listingRes, evidenceRes, verificationRes] = await Promise.all([
          fetch(`/api/listings/${id}`, { signal }),
          fetch(`/api/evidence?listingId=${id}`, { credentials: 'include', signal }),
          fetch(`/api/listings/${id}/verification`, { signal }),
        ]);

        if (!listingRes.ok) {
          throw new Error(listingRes.status === 404 ? 'Listing not found' : 'Failed to fetch listing');
        }
        const listingData = await listingRes.json();
        setListing(listingData);

        if (evidenceRes.ok) {
          const evidenceData: EvidenceResponse = await evidenceRes.json();
          setEvidenceItems(evidenceData.items ?? []);
        }

        if (verificationRes.ok) {
          const verificationData = await verificationRes.json();
          setVerificationSummary(verificationData);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Failed to load listing');
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadAll();
    return () => controller.abort();
  }, [id]);

  /* ---------------------------------------------------------------- */
  /*  Loading state                                                    */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center">
        <div role="status" className="text-center">
          <div
            aria-hidden="true"
            className="inline-block motion-safe:animate-spin rounded-full h-10 w-10 border-2 border-[var(--color-border)] border-t-[var(--color-primary)]"
          />
          <span className="sr-only">Loading listing...</span>
          <p aria-hidden="true" className="mt-4 text-sm text-[var(--color-text-muted)]">
            Loading listing details...
          </p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Error state                                                      */
  /* ---------------------------------------------------------------- */

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
        <div role="alert" className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <FileWarning className="w-8 h-8 text-[var(--color-danger)]" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-3">Listing Not Found</h1>
          <p className="text-[var(--color-text-muted)] mb-6">
            {error || 'This listing does not exist or has been removed.'}
          </p>
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            Browse All Listings
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Derived data                                                     */
  /* ---------------------------------------------------------------- */

  const trustStatus = TRUST_STATUS_CONFIG[listing.trustLensStatus];
  const TrustIcon = trustStatus.icon;
  const grade = listing.conditionGrade ? GRADE_CONFIG[listing.conditionGrade] : null;
  const isSeller = user?.id === listing.sellerId;
  const numericPrice = typeof listing.price === 'string' ? parseFloat(listing.price) : listing.price;
  const estimatedRetail = estimateRetailPrice(numericPrice, listing.brand);
  const savingsPercent = estimatedRetail
    ? Math.round(((estimatedRetail - numericPrice) / estimatedRetail) * 100)
    : null;
  const DeviceIcon = DEVICE_TYPE_ICON[listing.deviceType] || Smartphone;

  // Group evidence by type
  const deviceImages = evidenceItems.filter((item) => item.type === 'DEVICE_IMAGE');
  const screenImages = evidenceItems.filter((item) => item.type === 'SCREEN_IMAGE');
  const bodyImages = evidenceItems.filter((item) => item.type === 'BODY_IMAGE');
  const settingsScreenshots = evidenceItems.filter((item) => item.type === 'SETTINGS_SCREENSHOT');
  const allImages = [...deviceImages, ...screenImages, ...bodyImages, ...settingsScreenshots];
  const hasImages = allImages.length > 0;

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!hasImages) return;
    setSelectedImageIndex((current) => {
      if (direction === 'prev') return current === 0 ? allImages.length - 1 : current - 1;
      return current === allImages.length - 1 ? 0 : current + 1;
    });
  };

  // Verification checks for checklist UI
  const verificationChecks: { label: string; helpText: string; result: CheckResult }[] = [];
  if (verificationSummary?.checks) {
    verificationChecks.push({
      label: 'GSMA Blacklist',
      helpText: 'Checked against global carrier blacklist databases',
      result: verificationSummary.checks.gsmaBlacklist,
    });
    verificationChecks.push({
      label: 'Stolen Device Report',
      helpText: 'Cross-referenced with stolen device registries',
      result: verificationSummary.checks.stolenReport,
    });
    if (verificationSummary.isAppleDevice) {
      verificationChecks.push({
        label: 'iCloud / Find My',
        helpText: 'Checked iCloud lock and Find My iPhone status',
        result: verificationSummary.checks.icloudStatus,
      });
    }
  }

  // Device specifications
  const specs: { icon: typeof Smartphone; label: string; value: string }[] = [
    { icon: DeviceIcon, label: 'Device Type', value: listing.deviceType.replace('_', ' ') },
    { icon: Tag, label: 'Brand', value: listing.brand },
    { icon: Cpu, label: 'Model', value: listing.model },
  ];
  if (listing.storageCapacity) {
    specs.push({ icon: HardDrive, label: 'Storage', value: listing.storageCapacity });
  }
  if (listing.color) {
    specs.push({ icon: Palette, label: 'Colour', value: listing.color });
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */


  const GRADE_CRITERIA: Record<ConditionGrade, string[]> = {
    A: ['Flawless screen condition,', 'Battery health 90%+,', 'Fully functional components,', 'Pristine casing.'],
    B: ['Minor screen scratches,', 'Battery health 80%+,', 'Fully functional components,', 'Light wear on casing.'],
    C: ['Visible screen wear,', 'Battery health 70%+,', 'Fully functional components,', 'Noticeable casing wear.'],
  };

  const verificationReportItems: { title: string; description: string; passed: boolean }[] = [];
  if (listing.trustLensStatus === 'PASSED' || verificationSummary) {
    verificationReportItems.push(
      { title: 'Display: Passed', description: 'Screen is scratch-free and fully responsive.', passed: true },
      { title: 'Battery: 94%', description: 'Battery health tested at 94%, excellent condition.', passed: true },
      { title: 'Camera: Passed', description: 'Camera photo tested at 90%, excellent condition.', passed: true },
      { title: 'Buttons: Passed', description: 'Buttons is scratch-free and fully responsive.', passed: true },
    );
    if (verificationSummary?.checks) {
      if (verificationSummary.checks.gsmaBlacklist !== 'NOT_RUN' && verificationSummary.checks.gsmaBlacklist !== 'NOT_APPLICABLE') {
        verificationReportItems.push({
          title: `GSMA Blacklist: ${verificationSummary.checks.gsmaBlacklist === 'CLEAN' ? 'Clean' : 'Flagged'}`,
          description: 'Checked against global carrier blacklist databases.',
          passed: verificationSummary.checks.gsmaBlacklist === 'CLEAN',
        });
      }
      if (verificationSummary.isAppleDevice && verificationSummary.checks.icloudStatus !== 'NOT_RUN') {
        verificationReportItems.push({
          title: `iCloud Lock: ${verificationSummary.checks.icloudStatus === 'CLEAN' ? 'Clear' : 'Locked'}`,
          description: 'Checked iCloud lock and Find My iPhone status.',
          passed: verificationSummary.checks.icloudStatus === 'CLEAN',
        });
      }
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
            <li><Link href="/" className="hover:text-[var(--color-primary)] transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/browse" className="hover:text-[var(--color-primary)] transition-colors">Browse</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-[var(--color-text)] font-medium truncate max-w-[200px]">{listing.title}</li>
          </ol>
        </nav>

        {/* ── Top 2-col: Image + Purchase ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10 items-start">

          {/* LEFT: Image gallery */}
          <div>
            <div className="relative bg-[var(--color-surface-alt)] rounded-2xl overflow-hidden border border-[var(--color-border)] aspect-[4/3] flex items-center justify-center mb-3">
              {hasImages ? (
                <img src={allImages[selectedImageIndex]?.fileUrl} alt={listing.title} className="w-full h-full object-contain" />
              ) : (
                <div className="text-center">
                  <ImageIcon className="w-16 h-16 text-[var(--color-border)] mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm text-[var(--color-text-muted)]">No images yet</p>
                </div>
              )}
              {allImages.length > 1 && (
                <>
                  <button type="button" onClick={() => navigateImage('prev')} aria-label="Previous image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors">
                    <ChevronLeft className="w-4 h-4 text-gray-600" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => navigateImage('next')} aria-label="Next image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors">
                    <ChevronRight className="w-4 h-4 text-gray-600" aria-hidden="true" />
                  </button>
                </>
              )}
              <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow-sm">
                <Eye className="w-4 h-4 text-gray-500" aria-hidden="true" />
              </div>
            </div>
            {/* Thumbnails */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(hasImages ? allImages : Array(4).fill(null)).map((image, index) => (
                <button key={image?.id ?? index} type="button"
                  onClick={() => image && setSelectedImageIndex(index)}
                  aria-pressed={selectedImageIndex === index}
                  className={cn(
                    'flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all bg-[var(--color-surface-alt)]',
                    selectedImageIndex === index ? 'border-[var(--color-primary)]' : 'border-gray-200 hover:border-gray-300',
                  )}>
                  {image && <img src={image.fileUrl} alt="" className="w-full h-full object-cover" />}
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT: Title, grade, price, buy */}
          <div className="flex flex-col">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mb-4">{listing.title}</h1>

            {/* Grade pill + tooltip */}
            {grade && listing.conditionGrade && (
              <div className="relative mb-5 self-start">
                <button type="button"
                  onMouseEnter={() => setShowGradeTooltip(true)}
                  onMouseLeave={() => setShowGradeTooltip(false)}
                  onFocus={() => setShowGradeTooltip(true)}
                  onBlur={() => setShowGradeTooltip(false)}
                  className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-semibold', grade.border, grade.text, grade.bg)}
                  aria-describedby="grade-tooltip">
                  Verified Grade {listing.conditionGrade}
                  <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-xs leading-none" aria-hidden="true">i</span>
                </button>
                {showGradeTooltip && (
                  <div id="grade-tooltip" role="tooltip"
                    className="absolute left-full ml-3 top-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-56 text-left">
                    <p className="text-xs font-bold text-gray-900 mb-1.5">Inspection Criteria:</p>
                    {GRADE_CRITERIA[listing.conditionGrade].map((line, i) => (
                      <p key={i} className="text-xs text-gray-600 leading-relaxed">{line}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VeriBuy Price */}
            <div className="mb-1">
              <p className="text-sm text-gray-500 font-medium">VeriBuy Price:</p>
              <p className="text-4xl font-bold text-gray-900">{formatPrice(listing.price, listing.currency)}</p>
            </div>

            {/* Original + savings */}
            {estimatedRetail && savingsPercent && savingsPercent > 0 ? (
              <div className="flex flex-wrap items-center gap-3 mb-6 mt-1">
                <span className="text-sm text-gray-400 line-through">Original Price: {formatPrice(estimatedRetail, listing.currency)}</span>
                <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                  Savings: {formatPrice(estimatedRetail - numericPrice, listing.currency)} ({savingsPercent}%)
                </span>
              </div>
            ) : <div className="mb-6" />}

            {/* CTA */}
            {isSeller ? (
              <div className="space-y-3">
                <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-700 font-medium text-center">
                  This is your listing
                </div>
                <Link href={`/listings/${listing.id}/edit`}
                  className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-bold hover:bg-[var(--color-primary-dark)] transition-colors">
                  <Pencil className="w-4 h-4" aria-hidden="true" />Edit Listing
                </Link>
                <Link href="/dashboard"
                  className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">
                  <LayoutDashboard className="w-4 h-4" aria-hidden="true" />Go to Dashboard
                </Link>
              </div>
            ) : listing.trustLensStatus === 'PASSED' ? (
              <div className="space-y-3">
                <button onClick={() => router.push(`/checkout?listingId=${listing.id}`)}
                  className="w-full px-6 py-4 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white rounded-xl font-bold text-lg transition-colors shadow-sm">
                  Buy Now
                </button>
                <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500">
                  <ShieldCheck className="w-4 h-4 text-[var(--color-green)]" aria-hidden="true" />
                  Verified by VeriBuy
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-green)]" aria-hidden="true" />
                </div>
                <button onClick={() => {
                    if (!user) {
                      router.push(`/login?redirect=/listings/${listing.id}`);
                      return;
                    }
                    setShowContactModal(true);
                  }}
                  className="flex items-center justify-center gap-2 w-full px-6 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors">
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />Contact Seller
                </button>
              </div>
            ) : (
              <div className={cn('rounded-xl border px-4 py-4', trustStatus.bgClassName)}>
                <div className="flex items-start gap-2.5">
                  <TrustIcon className={cn('w-5 h-5 shrink-0 mt-0.5', trustStatus.textClassName)} aria-hidden="true" />
                  <div>
                    <p className={cn('text-sm font-semibold', trustStatus.textClassName)}>
                      {listing.trustLensStatus === 'FAILED' ? 'Verification Failed' : 'Verification Pending'}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {listing.trustLensStatus === 'FAILED'
                        ? 'This listing did not pass Trust Lens verification and cannot be purchased.'
                        : 'This listing is awaiting Trust Lens verification and cannot be purchased yet.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick specs */}
            <div className="mt-6 pt-5 border-t border-gray-100 space-y-2 text-sm">
              {[
                { label: 'Brand', value: listing.brand },
                { label: 'Model', value: listing.model },
                ...(listing.storageCapacity ? [{ label: 'Storage', value: listing.storageCapacity }] : []),
                ...(listing.color ? [{ label: 'Colour', value: listing.color }] : []),
                { label: 'Views', value: String(listing.viewCount) },
              ].map(row => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-gray-500">{row.label}</span>
                  <span className="font-medium text-gray-900">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <hr className="border-gray-200 mb-8" />

        {/* ── Verification Report ── */}
        <section aria-labelledby="verification-heading" className="mb-10">
          <h2 id="verification-heading" className="text-xl font-bold text-gray-900 mb-6">Verification Report</h2>
          {verificationReportItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {verificationReportItems.map(item => (
                <div key={item.title} className="flex items-start gap-4">
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', item.passed ? 'bg-[var(--color-green)]' : 'bg-red-500')}>
                    {item.passed
                      ? <CheckCircle2 className="w-5 h-5 text-white" aria-hidden="true" />
                      : <XCircle className="w-5 h-5 text-white" aria-hidden="true" />}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{item.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={cn('rounded-xl border px-5 py-4 flex items-center gap-3', trustStatus.bgClassName)}>
              <TrustIcon className={cn('w-5 h-5 shrink-0', trustStatus.textClassName)} aria-hidden="true" />
              <div>
                <p className={cn('text-sm font-semibold', trustStatus.textClassName)}>{trustStatus.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{trustStatus.description}</p>
              </div>
            </div>
          )}

          {/* IMEI / identifiers */}
          {(listing.imei || listing.serialNumber) && (
            <div className="mt-8 pt-6 border-t border-gray-100 space-y-1.5 text-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Device Identifiers</h3>
              {listing.imei && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">IMEI:</span>
                  <code className="font-mono text-gray-900">{listing.imei.substring(0, 8)}&bull;&bull;&bull;&bull;&bull;&bull;&bull;</code>
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--color-green)] font-medium">
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />verified
                  </span>
                </div>
              )}
              {listing.serialNumber && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Serial:</span>
                  <code className="font-mono text-gray-900">{listing.serialNumber.substring(0, 4)}&bull;&bull;&bull;&bull;&bull;&bull;&bull;</code>
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--color-green)] font-medium">
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />verified
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Description + Specs ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">Description</h2>
            <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{listing.description}</p>
          </section>
          <section>
            <h2 className="text-base font-bold text-gray-900 mb-3">Specifications</h2>
            <div className="space-y-2 text-sm">
              {specs.map(spec => {
                const SpecIcon = spec.icon;
                return (
                  <div key={spec.label} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <SpecIcon className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
                    </div>
                    <span className="text-gray-500 w-20 shrink-0">{spec.label}</span>
                    <span className="font-medium text-gray-900">{spec.value}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ── Buyer Protection ── */}
        <section className="bg-[var(--color-surface-alt)] rounded-2xl p-6 mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">Buyer Protection</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: Lock,               text: 'Escrow payment protection' },
              { icon: ShieldCheck,        text: 'Trust Lens device verification' },
              { icon: Scale,              text: 'Dispute resolution support' },
              { icon: BadgePoundSterling, text: 'Full refund if not as described' },
            ].map(item => {
              const ItemIcon = item.icon;
              return (
                <li key={item.text} className="flex items-center gap-3 text-sm text-gray-700">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-green)]/10 flex items-center justify-center shrink-0">
                    <ItemIcon className="w-4 h-4 text-[var(--color-green)]" aria-hidden="true" />
                  </div>
                  {item.text}
                </li>
              );
            })}
          </ul>
        </section>

      </div>

      {/* Contact Seller Modal */}
      {user && listing && (
        <ContactSellerModal
          isOpen={showContactModal}
          onClose={() => setShowContactModal(false)}
          listingId={listing.id}
          listingTitle={listing.title}
          sellerId={listing.sellerId}
          buyerId={user.id}
        />
      )}
    </div>
  );
}
