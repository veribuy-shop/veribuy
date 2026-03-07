'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import ContactSellerModal from '@/components/ContactSellerModal';
import { formatPrice } from '@/lib/currency';

type DeviceType = 'SMARTPHONE' | 'TABLET' | 'SMARTWATCH';
type ConditionGrade = 'A' | 'B' | 'C';
type TrustLensStatus = 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'REQUIRES_REVIEW';
type IntegrityFlag = 'CLEAN' | 'IMEI_MISMATCH' | 'ICLOUD_LOCKED' | 'REPORTED_STOLEN' | 'BLACKLISTED' | 'SERIAL_MISMATCH';
type EvidenceType = 'DEVICE_IMAGE' | 'SCREEN_IMAGE' | 'BODY_IMAGE' | 'SETTINGS_SCREENSHOT' | 'IMEI_SCREENSHOT' | 'PACKAGING_IMAGE' | 'ACCESSORIES_IMAGE' | 'OTHER';

interface Listing {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  deviceType: DeviceType;
  brand: string;
  model: string;
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

type CheckResult = 'CLEAN' | 'FLAGGED' | 'LOCKED' | 'NOT_APPLICABLE' | 'NOT_RUN';

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

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [verificationSummary, setVerificationSummary] = useState<VerificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showContactModal, setShowContactModal] = useState(false);

  useEffect(() => {
    fetchListing();
    fetchEvidence();
    fetchVerificationSummary();
  }, [id]);

  const fetchListing = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/listings/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Listing not found');
        }
        throw new Error('Failed to fetch listing');
      }

      const data = await response.json();
      setListing(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load listing');
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
        const data: EvidenceResponse = await response.json();
        const items = data.items ?? [];
        setEvidenceItems(items);
        
        // Set first device image as selected by default
        const deviceImages = items.filter((item: EvidenceItem) => item.type === 'DEVICE_IMAGE');
        if (deviceImages.length > 0) {
          setSelectedImage(deviceImages[0].fileUrl);
        }
      }
    } catch (err) {
      console.error('Error fetching evidence:', err);
      // Don't set error here - evidence is optional
    }
  };

  const fetchVerificationSummary = async () => {
    try {
      const response = await fetch(`/api/listings/${id}/verification`);
      if (response.ok) {
        const data = await response.json();
        setVerificationSummary(data);
      }
    } catch (err) {
      console.error('Error fetching verification summary:', err);
    }
  };

  const getTrustBadge = (status: TrustLensStatus) => {
    const badges = {
      PASSED: { text: 'Trust Lens Verified', color: 'bg-green-500', description: 'This listing has been verified by our Trust Lens system' },
      IN_PROGRESS: { text: 'Under Review', color: 'bg-yellow-600', description: 'Verification in progress' },
      REQUIRES_REVIEW: { text: 'Requires Review', color: 'bg-orange-600', description: 'Additional information needed' },
      PENDING: { text: 'Pending Verification', color: 'bg-gray-500', description: 'Awaiting Trust Lens review' },
      FAILED: { text: 'Verification Failed', color: 'bg-red-500', description: 'This listing did not pass verification' },
    };

    return badges[status];
  };

  const getConditionDescription = (grade?: ConditionGrade) => {
    const descriptions = {
      A: { title: 'Excellent Condition', description: 'Like new with minimal signs of use. Fully functional with no cosmetic damage.' },
      B: { title: 'Good Condition', description: 'Normal wear with minor scratches or marks. Fully functional.' },
      C: { title: 'Fair Condition', description: 'Visible wear, scratches, or dents. Fully functional but shows use.' },
    };

    return grade ? descriptions[grade] : null;
  };

  const getIntegrityFlagDetails = (flags: IntegrityFlag[]) => {
    const flagDetails: Record<IntegrityFlag, { text: string; color: string }> = {
      CLEAN: { text: 'No Issues Detected', color: 'text-green-600' },
      IMEI_MISMATCH: { text: 'IMEI Mismatch Detected', color: 'text-red-600' },
      ICLOUD_LOCKED: { text: 'iCloud Locked', color: 'text-red-600' },
      REPORTED_STOLEN: { text: 'Reported Stolen', color: 'text-red-600' },
      BLACKLISTED: { text: 'Blacklisted Device', color: 'text-red-600' },
      SERIAL_MISMATCH: { text: 'Serial Number Mismatch', color: 'text-red-600' },
    };

    return flags.map(flag => flagDetails[flag]);
  };

  /** Render a single check row in the verification proof table. */
  const renderCheckRow = (label: string, result: CheckResult, helpText: string) => {
    const config: Record<CheckResult, { icon: string; text: string; color: string; bg: string }> = {
      CLEAN:          { icon: '✓', text: 'Clean',          color: 'text-green-700', bg: 'bg-green-50' },
      FLAGGED:        { icon: '✗', text: 'Flagged',        color: 'text-red-700',   bg: 'bg-red-50'   },
      LOCKED:         { icon: '✗', text: 'Locked',         color: 'text-red-700',   bg: 'bg-red-50'   },
      NOT_APPLICABLE: { icon: '—', text: 'Not applicable', color: 'text-gray-400',  bg: 'bg-gray-50'  },
      NOT_RUN:        { icon: '—', text: 'Not checked',    color: 'text-gray-400',  bg: 'bg-gray-50'  },
    };
    const c = config[result];
    return (
      <div key={label} className={`flex items-center justify-between px-3 py-2 rounded-md ${c.bg}`}>
        <div>
          <span className="text-sm font-medium text-gray-800">{label}</span>
          <p className="text-xs text-gray-500 mt-0.5">{helpText}</p>
        </div>
        <span className={`flex items-center gap-1 text-sm font-semibold ${c.color}`}>
          <span aria-hidden="true">{c.icon}</span>
          {c.text}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div role="status" className="text-center">
          <div aria-hidden="true" className="inline-block motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
          <span className="sr-only">Loading listing...</span>
          <p aria-hidden="true" className="mt-4 text-gray-600">Loading listing...</p>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-4">
        <div role="alert" className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div aria-hidden="true" className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-4">Listing Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'This listing does not exist or has been removed.'}</p>
          <Link
            href="/browse"
            className="inline-block px-6 py-3 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90"
          >
            Browse All Listings
          </Link>
        </div>
      </div>
    );
  }

  const trustBadge = getTrustBadge(listing.trustLensStatus);
  const conditionInfo = getConditionDescription(listing.conditionGrade);
  const integrityDetails = getIntegrityFlagDetails(listing.integrityFlags);
  const isSeller = user?.id === listing.sellerId;

  // Group evidence by type
  const deviceImages = evidenceItems.filter((item: EvidenceItem) => item.type === 'DEVICE_IMAGE');
  const screenImages = evidenceItems.filter((item: EvidenceItem) => item.type === 'SCREEN_IMAGE');
  const bodyImages = evidenceItems.filter((item: EvidenceItem) => item.type === 'BODY_IMAGE');
  const settingsScreenshots = evidenceItems.filter((item: EvidenceItem) => item.type === 'SETTINGS_SCREENSHOT');
  const allImages = [...deviceImages, ...screenImages, ...bodyImages, ...settingsScreenshots];
  
  const hasImages = allImages.length > 0;

  return (
    <div className="min-h-screen bg-[var(--color-background)] py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-1 text-sm text-gray-600">
            <li><Link href="/" className="hover:text-[var(--color-primary)]">Home</Link></li>
            <li aria-hidden="true" className="select-none">{' > '}</li>
            <li><Link href="/browse" className="hover:text-[var(--color-primary)]">Browse</Link></li>
            <li aria-hidden="true" className="select-none">{' > '}</li>
            <li aria-current="page" className="text-[var(--color-text)]">{listing.title}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Images */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {hasImages ? (
                <>
                  {/* Main Image Display */}
                  <div className="bg-gray-100 aspect-square flex items-center justify-center relative">
                    <img
                      src={selectedImage || allImages[0].fileUrl}
                      alt={listing.title}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  
                  {/* Thumbnail Gallery */}
                  <div className="p-4 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {allImages.map((image) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => setSelectedImage(image.fileUrl)}
                        aria-label={`View ${image.fileName}`}
                        aria-pressed={selectedImage === image.fileUrl}
                        className={`bg-gray-100 aspect-square rounded cursor-pointer overflow-hidden border-2 ${
                          selectedImage === image.fileUrl
                            ? 'border-[var(--color-primary)]'
                            : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={image.fileUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Placeholder when no images */}
                  <div className="bg-gray-100 aspect-square flex items-center justify-center">
                    <div className="text-center">
                      <div aria-hidden="true" className="text-8xl mb-4">📱</div>
                      <p className="text-gray-500">No images available</p>
                      <p className="text-xs text-gray-400 mt-2">Evidence images pending upload</p>
                    </div>
                  </div>
                  
                  <div className="p-4 grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="bg-gray-100 aspect-square rounded"></div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Description */}
            <div className="mt-6 bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Description</h2>
              <p className="text-gray-700 whitespace-pre-line">{listing.description}</p>
            </div>

            {/* Trust Lens Verification Details */}
            <div className="mt-6 bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Trust Lens Verification</h2>
              
              <div className={`${trustBadge.color} text-white px-4 py-3 rounded-lg mb-4`}>
                <div className="font-semibold text-lg mb-1">
                  {listing.trustLensStatus === 'PASSED' && <span aria-hidden="true">✓ </span>}
                  {listing.trustLensStatus === 'FAILED' && <span aria-hidden="true">✗ </span>}
                  {listing.trustLensStatus === 'REQUIRES_REVIEW' && <span aria-hidden="true">⚠ </span>}
                  {trustBadge.text}
                </div>
                <div className="text-sm opacity-90">{trustBadge.description}</div>
              </div>

              {listing.conditionGrade && conditionInfo && (
                <div className="mb-4">
                  <h3 className="font-semibold text-[var(--color-text)] mb-2">Condition Grade: {listing.conditionGrade}</h3>
                  <p className="text-sm text-gray-700">
                    <strong>{conditionInfo.title}</strong> — {conditionInfo.description}
                  </p>
                </div>
              )}

              {/* Integrity flags summary */}
              <div className="mb-4">
                <h3 className="font-semibold text-[var(--color-text)] mb-2">Device Integrity</h3>
                <ul className="space-y-1.5">
                  {listing.integrityFlags.length === 0 ? (
                    <li className="text-sm text-gray-500 italic">Integrity check pending</li>
                  ) : (
                    integrityDetails.map((detail, index) => (
                      <li key={index} className={`text-sm ${detail.color}`}>
                        {detail.text}
                      </li>
                    ))
                  )}
                </ul>
              </div>

              {/* IMEI check proof panel */}
              {verificationSummary?.imeiCheckPerformed && verificationSummary.checks && (
                <div className="border border-gray-200 rounded-lg p-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span aria-hidden="true" className="text-lg">🔍</span>
                    <h3 className="font-semibold text-[var(--color-text)]">Automated IMEI Verification</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Independent checks were run against global carrier and device databases at the time of listing.
                    {verificationSummary.isAppleDevice
                      ? ' Apple-specific checks (iCloud/FMI) were included.'
                      : ' GSMA global blacklist check was performed.'}
                  </p>
                  <div className="space-y-2">
                    {renderCheckRow(
                      'GSMA Global Blacklist',
                      verificationSummary.checks.gsmaBlacklist,
                      'Checks if this IMEI is blocked by any carrier worldwide',
                    )}
                    {renderCheckRow(
                      'Stolen Device Report',
                      verificationSummary.checks.stolenReport,
                      'Cross-references global stolen device databases',
                    )}
                    {verificationSummary.isAppleDevice && renderCheckRow(
                      'iCloud / Find My Status',
                      verificationSummary.checks.icloudStatus,
                      'Checks if iCloud lock or Find My iPhone is active',
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    Powered by GSMA and Apple carrier databases via imeicheck.com
                  </p>
                </div>
              )}

              {/* Device identifiers (partially masked) */}
              {(listing.imei || listing.serialNumber) && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-semibold text-[var(--color-text)] mb-2">Device Identifiers</h3>
                  {listing.imei && (
                    <p className="text-sm text-gray-600">
                      <strong>IMEI:</strong> {listing.imei.substring(0, 8)}&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022; <span className="text-green-600 text-xs">(verified)</span>
                    </p>
                  )}
                  {listing.serialNumber && (
                    <p className="text-sm text-gray-600 mt-1">
                      <strong>Serial:</strong> {listing.serialNumber.substring(0, 4)}&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022; <span className="text-green-600 text-xs">(verified)</span>
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Full identifiers are partially hidden for security. Verified by Trust Lens.
                  </p>
                  
                  {/* Settings Screenshots */}
                  {settingsScreenshots.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Verification Evidence:</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {settingsScreenshots.map((screenshot) => (
                          <button
                            key={screenshot.id}
                            type="button"
                            onClick={() => setSelectedImage(screenshot.fileUrl)}
                            aria-label={`View settings screenshot: ${screenshot.fileName}`}
                            aria-pressed={selectedImage === screenshot.fileUrl}
                            className="border rounded overflow-hidden hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          >
                            <img
                              src={screenshot.fileUrl}
                              alt=""
                              className="w-full h-32 object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Purchase Info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h1 className="text-2xl font-bold text-[var(--color-text)] mb-4">{listing.title}</h1>
              
              <div className="mb-4">
                <div className="text-3xl font-bold text-[var(--color-primary)] mb-2">
                  {formatPrice(listing.price, listing.currency)}
                </div>
                {listing.conditionGrade && (
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                    Grade {listing.conditionGrade}
                  </span>
                )}
              </div>

              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Device Type:</span>
                  <span className="font-medium text-[var(--color-text)]">{listing.deviceType.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Brand:</span>
                  <span className="font-medium text-[var(--color-text)]">{listing.brand}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Model:</span>
                  <span className="font-medium text-[var(--color-text)]">{listing.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium text-green-600">{listing.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Views:</span>
                  <span className="font-medium text-[var(--color-text)]">{listing.viewCount}</span>
                </div>
              </div>

              {isSeller ? (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                    <strong>This is your listing</strong>
                  </div>
                  <Link
                    href={`/listings/${listing.id}/edit`}
                    className="block w-full px-6 py-3 bg-[var(--color-primary)] text-white rounded-md text-center hover:opacity-90 font-semibold"
                  >
                    Edit Listing
                  </Link>
                  <Link
                    href="/dashboard"
                    className="block w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-md text-center hover:bg-gray-200"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {listing.trustLensStatus === 'PASSED' ? (
                    <>
                      <button
                        onClick={() => router.push(`/checkout?listingId=${listing.id}`)}
                        className="w-full px-6 py-3 bg-[var(--color-accent)] text-white rounded-md hover:opacity-90 font-semibold"
                      >
                        Buy Now
                      </button>
                      <button
                        onClick={() => setShowContactModal(true)}
                        className="w-full px-6 py-3 border border-[var(--color-primary)] text-[var(--color-primary)] rounded-md hover:bg-blue-50"
                      >
                        Contact Seller
                      </button>
                    </>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        <strong>Verification Pending</strong>
                        <br />
                        This listing is awaiting Trust Lens verification and cannot be purchased yet.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="font-semibold text-[var(--color-text)] mb-3">Buyer Protection</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-green-500">✓</span>
                    <span>Escrow payment protection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-green-500">✓</span>
                    <span>Trust Lens device verification</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-green-500">✓</span>
                    <span>Dispute resolution support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-green-500">✓</span>
                    <span>Evidence pack for authenticity</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
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
