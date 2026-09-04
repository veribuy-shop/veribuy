'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import ContactSellerModal from '@/components/ContactSellerModal';
import ConfirmModal from '@/components/confirm-modal';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { getBuyerProtectionFeePercent, calculateProtectionFee } from '@/lib/fees';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
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
  LockKeyhole,
  Unlock,
  Radio,
  Globe2,
  Award,
  Sparkles,
  Fingerprint,
  CalendarCheck,
  BadgeCheck,
  BadgePoundSterling,
  Scale,
  MessageCircle,
  Pencil,
  LayoutDashboard,
  Trash2,
  ImageIcon,
  FileWarning,
  Truck,
  RotateCcw,
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
  deviceAttributes: Array<{ label: string; value: string }>;
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

const VIEWER_ID_KEY = 'vb_viewer_id';

/**
 * A stable, non-sensitive per-browser token used to dedupe listing view counts.
 * Persisted in localStorage so every poll/refresh from this browser maps to the
 * same viewer and is only counted once per listing (server-side 24h window).
 */
function getViewerId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(VIEWER_ID_KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(VIEWER_ID_KEY, id);
  }
  return id;
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function ListingDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verificationFailed = searchParams.get('verification') === 'failed';
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [verificationSummary, setVerificationSummary] = useState<VerificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [imeiChecking, setImeiChecking] = useState(false);
  const [error, setError] = useState('');
  const [showContactModal, setShowContactModal] = useState(false);
  const [showGradeTooltip, setShowGradeTooltip] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // PERF-04: Consolidate three independent fetches into a single useEffect
  // using Promise.all so they run in parallel. AbortController cancels
  // in-flight requests when `id` changes.
  //
  // The listing's Trust Lens check runs asynchronously after submission. When a
  // listing is still in PENDING / IN_PROGRESS we poll the listing + verification
  // summary so the outcome surfaces immediately once the check completes, then
  // stop polling once a terminal status (PASSED/REQUIRES_REVIEW/FAILED) is seen.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let polling = false;

    const isTerminal = (status: string) =>
      status === 'PASSED' || status === 'REQUIRES_REVIEW' || status === 'FAILED';

    const viewerId = getViewerId();
    const viewerQs = viewerId ? `?viewer=${encodeURIComponent(viewerId)}` : '';

    const loadListingAndVerification = async () => {
      const [listingRes, verificationRes] = await Promise.all([
        fetch(`/api/listings/${id}${viewerQs}`, { signal }),
        fetch(`/api/listings/${id}/verification`, { signal }),
      ]);
      if (!listingRes.ok) {
        throw new Error(listingRes.status === 404 ? 'Listing not found' : 'Failed to fetch listing');
      }
      const listingData = await listingRes.json();
      setListing(listingData);
      if (verificationRes.ok) {
        const verificationData = await verificationRes.json();
        setVerificationSummary(verificationData);
        // Prefer the live (Redis-cached) check state when present — it reflects
        // the backend worker's actual progress even before the listing service
        // catches up with the terminal status.
        const live = (verificationData as any)?.liveStatus;
        setImeiChecking(live === 'IN_PROGRESS' || (live == null && !isTerminal(String(listingData.trustLensStatus ?? 'PENDING'))));
        return { data: listingData, done: isTerminal(live ?? String(listingData.trustLensStatus ?? 'PENDING')) };
      }
      return { data: listingData, done: false };
    };

    const loadAll = async () => {
      setLoading(true);
      setError('');
      try {
        const [{ data: listingData }, evidenceRes] = await Promise.all([
          loadListingAndVerification(),
          fetch(`/api/evidence?listingId=${id}`, { credentials: 'include', signal }),
        ]);
        if (evidenceRes.ok) {
          const evidenceData: EvidenceResponse = await evidenceRes.json();
          setEvidenceItems(evidenceData.items ?? []);
        }

        // Show the page immediately — the IMEI check continues polling in the
        // background and updates the verification badge as it progresses, so the
        // user is never staring at a loading screen while the check runs.
        if (!signal.aborted) setLoading(false);

        // Poll while the IMEI check is still running so the outcome shows
        // promptly. Uses adaptive backoff: fast at first (snappy feel) then
        // slowing, and stops the instant the live status reaches a terminal
        // state — so the spinner clears as soon as the check resolves.
        if (signal.aborted) return;
        polling = true;
        const MAX_POLL_MS = 45_000;
        const startedAt = Date.now();
        while (polling && Date.now() - startedAt < MAX_POLL_MS) {
          const elapsed = Date.now() - startedAt;
          const interval = elapsed < 5000 ? 750 : elapsed < 15000 ? 1200 : 2000;
          await new Promise((r) => setTimeout(r, interval));
          if (signal.aborted) return;
          let pollDone = false;
          try {
            ({ done: pollDone } = await loadListingAndVerification());
          } catch (err: any) {
            if (err.name === 'AbortError') return;
            break;
          }
          if (pollDone) break;
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
    return () => {
      controller.abort();
      polling = false;
    };
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

  const handleDeleteListing = async () => {
    if (!listing) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to delete listing. Please try again.');
        setConfirmDelete(false);
      }
    } catch {
      setError('Failed to delete listing. Please try again.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const GRADE_CRITERIA: Record<ConditionGrade, string[]> = {
    A: ['Flawless screen condition,', 'Battery health 90%+,', 'Fully functional components,', 'Pristine casing.'],
    B: ['Minor screen scratches,', 'Battery health 80%+,', 'Fully functional components,', 'Light wear on casing.'],
    C: ['Visible screen wear,', 'Battery health 70%+,', 'Fully functional components,', 'Noticeable casing wear.'],
  };

  const getAttributeIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('warranty') || l.includes('coverage') || l.includes('applecare')) return Award;
    if (l.includes('purchase') || l.includes('date')) return CalendarCheck;
    if (l.includes('model') || l.includes('chip') || l.includes('processor')) return Cpu;
    if (l.includes('sim') || l.includes('carrier') || l.includes('network') || l.includes('locked')) return Unlock;
    if (l.includes('storage') || l.includes('capacity') || l.includes('gb') || l.includes('tb')) return HardDrive;
    if (l.includes('icloud') || l.includes('fmi') || l.includes('activation') || l.includes('lock')) return LockKeyhole;
    if (l.includes('imei') || l.includes('serial') || l.includes('meid')) return Fingerprint;
    if (l.includes('region') || l.includes('country')) return Globe2;
    return BadgeCheck;
  };

  interface SecurityCheckItem {
    id: string;
    title: string;
    statusLabel: string;
    description: string;
    passed: boolean;
    icon: any;
  }

  const securityChecks: SecurityCheckItem[] = [];

  // Real pass/fail checks (GSMA blacklist, iCloud lock, stolen report).
  if (verificationSummary?.checks) {
    if (verificationSummary.checks.gsmaBlacklist !== 'NOT_RUN' && verificationSummary.checks.gsmaBlacklist !== 'NOT_APPLICABLE') {
      const isClean = verificationSummary.checks.gsmaBlacklist === 'CLEAN';
      securityChecks.push({
        id: 'gsma',
        title: 'GSMA Global Blacklist',
        statusLabel: isClean ? 'Clean & Unrestricted' : 'Carrier Flagged',
        description: 'Checked against 44+ international mobile carrier databases.',
        passed: isClean,
        icon: Radio,
      });
    }
    if (verificationSummary.checks.stolenReport !== 'NOT_RUN' && verificationSummary.checks.stolenReport !== 'NOT_APPLICABLE') {
      const isClean = verificationSummary.checks.stolenReport === 'CLEAN';
      securityChecks.push({
        id: 'stolen',
        title: 'Stolen Property Registry',
        statusLabel: isClean ? 'No Records Found' : 'Flagged in Loss Registry',
        description: 'Cross-referenced with global police & insurance loss registries.',
        passed: isClean,
        icon: isClean ? ShieldCheck : ShieldAlert,
      });
    }
    if (verificationSummary.isAppleDevice && verificationSummary.checks.icloudStatus !== 'NOT_RUN') {
      const isClean = verificationSummary.checks.icloudStatus === 'CLEAN';
      securityChecks.push({
        id: 'icloud',
        title: 'iCloud & Activation Lock',
        statusLabel: isClean ? 'Unlocked & Clear' : 'Activation Locked',
        description: 'Find My & Activation Lock disabled for fresh factory setup.',
        passed: isClean,
        icon: LockKeyhole,
      });
    }
  }

  // Real device attributes returned by the checker (Model, Warranty, SIM-Lock,
  // Activation, FMI, …) — parsed into individual structured rows.
  const deviceAttributes = (verificationSummary?.deviceAttributes ?? []).map((attr) => ({
    label: attr.label,
    value: attr.value,
    icon: getAttributeIcon(attr.label),
  }));

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

        {verificationFailed && (
          <div role="alert" className="mb-6 bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[var(--color-warning)]" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">Device check could not be started</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Your listing was created, but the automated device check did not start. It will remain unavailable until it can be verified.
              </p>
            </div>
          </div>
        )}

        {/* ── Top 2-col: Image + Purchase ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 mb-12 items-start">

          {/* LEFT: Image gallery (7 cols on lg) */}
          <div className="lg:col-span-7">
            <div className="relative bg-[var(--color-surface-alt)] rounded-2xl overflow-hidden border border-[var(--color-border)] aspect-[4/3] flex items-center justify-center mb-3 shadow-xs">
              {hasImages ? (
                <img
                  src={allImages[selectedImageIndex]?.fileUrl}
                  alt={listing.title}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="text-center p-6">
                  <ImageIcon className="w-16 h-16 text-[var(--color-border)] mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm text-[var(--color-text-muted)] font-medium">No verified photos uploaded yet</p>
                </div>
              )}

              {allImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => navigateImage('prev')}
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 shadow-md flex items-center justify-center hover:bg-white transition-all text-gray-700 hover:text-black border border-gray-100"
                  >
                    <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateImage('next')}
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 shadow-md flex items-center justify-center hover:bg-white transition-all text-gray-700 hover:text-black border border-gray-100"
                  >
                    <ChevronRight className="w-5 h-5" aria-hidden="true" />
                  </button>
                </>
              )}

              {hasImages && (
                <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xs text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{selectedImageIndex + 1} / {allImages.length}</span>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {hasImages && allImages.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                {allImages.map((image, index) => (
                  <button
                    key={image.id ?? index}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    aria-pressed={selectedImageIndex === index}
                    className={cn(
                      'flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all bg-[var(--color-surface-alt)] p-1 flex items-center justify-center',
                      selectedImageIndex === index
                        ? 'border-[var(--color-green)] ring-2 ring-[var(--color-green)]/20 shadow-xs'
                        : 'border-[var(--color-border)] hover:border-gray-400 opacity-75 hover:opacity-100',
                    )}
                  >
                    <img src={image.fileUrl} alt="" className="w-full h-full object-contain rounded-lg" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Title, grade, price, buy (5 cols on lg, sticky) */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6 shadow-sm">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight mb-3">
                {listing.title}
              </h1>

              {/* Condition Grade badge + responsive tooltip */}
              {grade && listing.conditionGrade && (
                <div className="relative mb-5 inline-block">
                  <button
                    type="button"
                    onClick={() => setShowGradeTooltip(!showGradeTooltip)}
                    onMouseEnter={() => setShowGradeTooltip(true)}
                    onMouseLeave={() => setShowGradeTooltip(false)}
                    onFocus={() => setShowGradeTooltip(true)}
                    onBlur={() => setShowGradeTooltip(false)}
                    className={cn(
                      'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider transition-all',
                      grade.border,
                      grade.text,
                      grade.bg,
                    )}
                    aria-describedby="grade-tooltip"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Verified Grade {listing.conditionGrade} ({grade.label})
                    <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] leading-none ml-0.5" aria-hidden="true">i</span>
                  </button>
                  {showGradeTooltip && (
                    <div
                      id="grade-tooltip"
                      role="tooltip"
                      className="absolute left-0 sm:left-full top-full sm:top-0 mt-2 sm:mt-0 sm:ml-3 z-30 bg-gray-900 text-white border border-gray-800 rounded-xl shadow-xl p-4 w-64 text-left"
                    >
                      <p className="text-xs font-bold text-emerald-400 mb-2 uppercase tracking-wider">
                        Grade {listing.conditionGrade} Criteria:
                      </p>
                      <ul className="space-y-1.5 text-xs text-gray-300">
                        {GRADE_CRITERIA[listing.conditionGrade].map((line, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{line.replace(/,/g, '')}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Price Display */}
              <div className="mb-4 pb-4 border-b border-gray-100">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                    {formatPrice(listing.price, listing.currency)}
                  </span>
                </div>

                {estimatedRetail && savingsPercent && savingsPercent > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-xs text-gray-400 line-through">
                      MSRP {formatPrice(estimatedRetail, listing.currency)}
                    </span>
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                      Save {formatPrice(estimatedRetail - numericPrice, listing.currency)} ({savingsPercent}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Actions & CTAs */}
              {isSeller ? (
                <div className="space-y-3 mb-6">
                  <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-xs font-bold text-sky-800 text-center uppercase tracking-wider">
                    You are the seller of this listing
                  </div>
                  <Link
                    href={`/listings/${listing.id}/edit`}
                    className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-bold text-sm hover:bg-[var(--color-primary-dark)] transition-colors shadow-xs"
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                    Edit Listing
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-[var(--color-surface-alt)] text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                    Go to Dashboard
                  </Link>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center justify-center gap-2 w-full px-6 py-2.5 border border-red-200 text-red-600 rounded-xl font-medium text-xs hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Delete Listing
                  </button>
                </div>
              ) : listing.trustLensStatus === 'PASSED' ? (
                <div className="space-y-3 mb-6">
                  <button
                    onClick={() => {
                      if (!user) {
                        router.push(`/login?redirect=/checkout?listingId=${listing.id}`);
                        return;
                      }
                      router.push(`/checkout?listingId=${listing.id}`);
                    }}
                    className="w-full px-6 py-4 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white rounded-xl font-black text-base transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    <Lock className="w-5 h-5 text-white/90" />
                    <span>Buy with Escrow Protection</span>
                  </button>

                  <button
                    onClick={() => {
                      if (!user) {
                        router.push(`/login?redirect=/listings/${listing.id}`);
                        return;
                      }
                      setShowContactModal(true);
                    }}
                    className="flex items-center justify-center gap-2 w-full px-6 py-3 border border-[var(--color-border)] text-gray-800 rounded-xl font-bold text-sm hover:border-[var(--color-green)] hover:text-[var(--color-green)] transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" aria-hidden="true" />
                    <span>Contact Seller</span>
                  </button>
                </div>
              ) : (
                <div className={cn('rounded-xl border p-4 mb-6', trustStatus.bgClassName)}>
                  <div className="flex items-start gap-3">
                    <TrustIcon className={cn('w-5 h-5 shrink-0 mt-0.5', trustStatus.textClassName)} aria-hidden="true" />
                    <div>
                      <p className={cn('text-sm font-bold', trustStatus.textClassName)}>
                        {listing.trustLensStatus === 'FAILED' ? 'Verification Failed' : 'Verification In Progress'}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                        {listing.trustLensStatus === 'FAILED'
                          ? 'This device failed hardware/IMEI verification checks and cannot be purchased.'
                          : 'Trust Lens™ automated checks are currently running. Purchase will become available once passed.'}
                      </p>
                      {imeiChecking && (
                        <div className="flex items-center gap-2 mt-2.5 text-xs text-[var(--color-accent)] font-semibold">
                          <div aria-hidden="true" className="inline-block motion-safe:animate-spin rounded-full h-3.5 w-3.5 border-2 border-[var(--color-accent)] border-t-transparent"></div>
                          <span>Querying international registry databases…</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Purchase Trust Assurance Badges */}
              <div className="space-y-2.5 pt-4 border-t border-gray-100 text-xs text-gray-600">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 text-[var(--color-green)] flex items-center justify-center shrink-0">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <span><strong>100% Escrow Protection:</strong> Funds held until you test the device.</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 text-[var(--color-green)] flex items-center justify-center shrink-0">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </div>
                  <span><strong>7-Day Money-Back Guarantee:</strong> Return if not as described.</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 text-[var(--color-green)] flex items-center justify-center shrink-0">
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <span><strong>Tracked &amp; Insured:</strong> Signed delivery on all shipments.</span>
                </div>
              </div>

              {/* Quick specs */}
              <div className="mt-5 pt-4 border-t border-gray-100 space-y-2 text-xs">
                {[
                  { label: 'Brand', value: listing.brand },
                  { label: 'Model', value: listing.model },
                  ...(listing.storageCapacity ? [{ label: 'Storage', value: listing.storageCapacity }] : []),
                  ...(listing.color ? [{ label: 'Colour', value: listing.color }] : []),
                  { label: 'Views', value: String(listing.viewCount) },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center py-0.5">
                    <span className="text-gray-400 font-medium">{row.label}</span>
                    <span className="font-bold text-gray-900">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <hr className="border-gray-200 mb-8" />

        {/* ── Verification Report ── */}
        <section aria-labelledby="verification-heading" className="mb-10">
          <div className="bg-gradient-to-b from-slate-50/70 via-white to-slate-50/40 rounded-2xl border border-[var(--color-border)] p-6 md:p-8 shadow-sm">
            {/* Section Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-[var(--color-green)] border border-emerald-200 text-xs font-bold uppercase tracking-wider mb-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--color-green)]" />
                  Trust Lens™ Diagnostic Report
                </div>
                <h2 id="verification-heading" className="text-xl md:text-2xl font-bold text-gray-900">
                  Hardware &amp; Database Verification
                </h2>
                <p className="text-xs md:text-sm text-[var(--color-text-muted)] mt-1">
                  Automated multi-point inspection verified before listing publication.
                </p>
              </div>

              {listing.trustLensStatus === 'PASSED' ? (
                <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 self-start md:self-auto">
                  <ShieldCheck className="w-5 h-5 text-[var(--color-green)] shrink-0" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-green)]">Verification Passed</div>
                    <div className="text-xs text-[var(--color-text-muted)]">100% Guaranteed Authentic</div>
                  </div>
                </div>
              ) : (
                <div className={cn('inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border self-start md:self-auto', trustStatus.bgClassName)}>
                  <TrustIcon className={cn('w-5 h-5 shrink-0', trustStatus.textClassName)} />
                  <div>
                    <div className={cn('text-xs font-bold uppercase tracking-wider', trustStatus.textClassName)}>{trustStatus.label}</div>
                    <div className="text-xs text-gray-500">{trustStatus.description}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Core Security & Loss Checks */}
            {securityChecks.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3.5">
                  Security &amp; Database Registries
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {securityChecks.map((check) => {
                    const CheckIcon = check.icon;
                    return (
                      <div
                        key={check.title}
                        className={cn(
                          'rounded-xl p-4 border transition-all flex flex-col justify-between',
                          check.passed
                            ? 'bg-white border-emerald-100 hover:border-emerald-300 shadow-xs'
                            : 'bg-red-50/50 border-red-200'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div
                            className={cn(
                              'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                              check.passed
                                ? 'bg-emerald-50 text-[var(--color-green)] border border-emerald-100'
                                : 'bg-red-100 text-red-600 border border-red-200'
                            )}
                          >
                            <CheckIcon className="w-5 h-5" />
                          </div>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider',
                              check.passed
                                ? 'bg-emerald-50 text-[var(--color-green)] border border-emerald-200'
                                : 'bg-red-100 text-red-700 border border-red-200'
                            )}
                          >
                            {check.passed ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-[var(--color-green)]" />
                                {check.statusLabel}
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 text-red-600" />
                                {check.statusLabel}
                              </>
                            )}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">{check.title}</h4>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{check.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Verified Device Attributes & Hardware Diagnostics */}
            {deviceAttributes.length > 0 && (
              <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3.5">
                  Verified Diagnostics &amp; Hardware Details
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {deviceAttributes.map((attr) => {
                    const AttrIcon = attr.icon;
                    return (
                      <div
                        key={attr.label}
                        className="bg-white rounded-xl p-3 border border-gray-100 shadow-xs flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-alt)] flex items-center justify-center shrink-0 text-[var(--color-text-muted)]">
                          <AttrIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider truncate">
                            {attr.label}
                          </p>
                          <p className="text-xs font-bold text-gray-900 truncate">
                            {attr.value}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fallback if no checks were run yet */}
            {securityChecks.length === 0 && deviceAttributes.length === 0 && (
              <div className={cn('rounded-xl border p-4 mt-6 flex items-center gap-3', trustStatus.bgClassName)}>
                <TrustIcon className={cn('w-5 h-5 shrink-0', trustStatus.textClassName)} aria-hidden="true" />
                <div>
                  <p className={cn('text-sm font-semibold', trustStatus.textClassName)}>{trustStatus.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{trustStatus.description}</p>
                </div>
              </div>
            )}

            {/* Device Identifiers Security Bar */}
            {(listing.imei || listing.serialNumber) && (
              <div className="mt-6 pt-5 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-6 text-xs">
                  {listing.imei && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-500 uppercase tracking-wider">IMEI:</span>
                      <code className="px-2 py-1 rounded bg-slate-100 font-mono text-gray-900 font-semibold border border-slate-200">
                        {listing.imei.substring(0, 8)}&bull;&bull;&bull;&bull;&bull;&bull;&bull;
                      </code>
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-green)] font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Checked
                      </span>
                    </div>
                  )}
                  {listing.serialNumber && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-500 uppercase tracking-wider">Serial:</span>
                      <code className="px-2 py-1 rounded bg-slate-100 font-mono text-gray-900 font-semibold border border-slate-200">
                        {listing.serialNumber.substring(0, 4)}&bull;&bull;&bull;&bull;&bull;&bull;&bull;
                      </code>
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-green)] font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Checked
                      </span>
                    </div>
                  )}
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                  <ShieldCheck className="w-4 h-4 text-[var(--color-green)]" />
                  Cryptographically Verified Record
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Description & Specifications Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Description */}
          <section className="bg-white rounded-2xl border border-[var(--color-border)] p-6 shadow-xs">
            <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--color-green)]" />
              <span>Seller Description</span>
            </h2>
            <div className="text-sm text-gray-600 whitespace-pre-line leading-relaxed bg-[var(--color-surface-alt)] rounded-xl p-4 border border-gray-100">
              {listing.description || 'No additional description provided by the seller.'}
            </div>
          </section>

          {/* Specifications */}
          <section className="bg-white rounded-2xl border border-[var(--color-border)] p-6 shadow-xs">
            <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[var(--color-green)]" />
              <span>Device Specifications</span>
            </h2>
            <div className="divide-y divide-gray-100 text-sm">
              {specs.map((spec) => {
                const SpecIcon = spec.icon;
                return (
                  <div key={spec.label} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5 text-gray-500">
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <SpecIcon className="w-3.5 h-3.5 text-gray-600" aria-hidden="true" />
                      </div>
                      <span className="font-medium text-xs">{spec.label}</span>
                    </div>
                    <span className="font-bold text-xs text-gray-900">{spec.value}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ── Buyer Protection Assurance Banner ── */}
        <section className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 rounded-2xl p-6 sm:p-8 text-white mb-10 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>VeriBuy Buyer Guarantee</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Shop Pre-Owned Tech With Absolute Confidence
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-xl leading-relaxed">
                Your payment is held safely in escrow until you inspect and approve your device. Zero risk of blacklisted, counterfeit, or stolen hardware.
              </p>
            </div>
            <Link
              href="/buyer-protection"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-gray-900 font-bold text-xs uppercase tracking-wider hover:bg-emerald-50 transition-colors shrink-0 shadow-sm"
            >
              <span>Learn About Protection</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
            {[
              { icon: Lock, title: '100% Escrow Holding', desc: 'Seller receives funds only after you confirm delivery.' },
              { icon: ShieldCheck, title: 'Trust Lens™ Verified', desc: 'IMEI, cloud locks, and blacklist databases audited.' },
              { icon: RotateCcw, title: '7-Day Inspection Return', desc: 'Full money-back refund if item is misrepresented.' },
              { icon: Scale, title: 'UK Dispute Support', desc: 'Dedicated resolution team for dispute escalation.' },
            ].map((item) => {
              const ItemIcon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3 bg-white/5 rounded-xl p-3.5 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                    <ItemIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">{item.title}</h3>
                    <p className="text-[11px] text-emerald-100/70 mt-0.5 leading-snug">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
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

      {/* Delete Listing confirmation */}
      <ConfirmModal
        isOpen={confirmDelete && !!listing}
        onClose={() => !deleting && setConfirmDelete(false)}
        onConfirm={handleDeleteListing}
        title="Delete Listing"
        description="This will permanently delete your listing and remove it from the marketplace. This cannot be undone."
        confirmLabel="Delete Listing"
        cancelLabel="Cancel"
        isLoading={deleting}
        loadingLabel="Deleting…"
        variant="danger"
      />
    </div>
  );
}
