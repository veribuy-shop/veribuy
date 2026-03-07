'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

interface EvidenceItem {
  id: string;
  fileUrl: string;
  fileName: string;
  type: string;
  description?: string;
  uploadedAt: string;
}

interface EvidenceChecklist {
  id: string;
  type: string;
  description: string;
  required: boolean;
  fulfilled: boolean;
}

interface IdentifierValidation {
  id: string;
  imeiProvided: boolean;
  serialProvided: boolean;
  imei: string | null;
  serialNumber: string | null;
  imeiValid: boolean | null;
  serialValid: boolean | null;
  icloudLocked: boolean | null;
  reportedStolen: boolean | null;
  blacklisted: boolean | null;
  fmiOn: boolean | null;
  verifiedAt: string | null;
  rawApiResponse: Record<string, unknown> | null;
}

interface VerificationRequest {
  id: string;
  listingId: string;
  sellerId: string;
  status: string;
  conditionGrade: string | null;
  integrityFlags: string[];
  reviewNotes: string | null;
  evidenceChecklist: EvidenceChecklist[];
  identifierValidation: IdentifierValidation | null;
  createdAt: string;
}

interface Listing {
  id: string;
  title: string;
  brand: string;
  model: string;
  deviceType: string;
  price: number | string;
  currency: string;
  conditionGrade: string;
  description: string;
  imei?: string;
  serialNumber?: string;
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [verification, setVerification] = useState<VerificationRequest | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [selectedIntegrityFlags, setSelectedIntegrityFlags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [listingNotFound, setListingNotFound] = useState(false);
  const [verificationNotFound, setVerificationNotFound] = useState(false);

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    fetchData(id);
  }, [user, id]);

  const fetchData = async (listingId: string) => {
    setLoading(true);
    setListingNotFound(false);
    setVerificationNotFound(false);
    try {
      // Fetch listing details and verification request in parallel
      const [listingRes, verificationRes, evidenceRes] = await Promise.all([
        fetch(`/api/listings/${listingId}`, { credentials: 'include' }),
        fetch(`/api/trust-lens?listingId=${listingId}`, { credentials: 'include' }),
        fetch(`/api/evidence?listingId=${listingId}`, { credentials: 'include' }),
      ]);

      if (listingRes.status === 404) {
        setListingNotFound(true);
        return;
      }
      if (listingRes.ok) {
        const listingData = await listingRes.json();
        setListing(listingData);
      }

      if (verificationRes.status === 404 || verificationRes.status === 403) {
        setVerificationNotFound(true);
      } else if (verificationRes.ok) {
        const verificationData = await verificationRes.json();
        setVerification(verificationData);
        setReviewNotes(verificationData.reviewNotes || '');
        setSelectedIntegrityFlags(verificationData.integrityFlags || []);
      }

      if (evidenceRes.ok) {
        const evidenceData = await evidenceRes.json();
        if (evidenceData.items) {
          setEvidence(evidenceData.items);
          if (evidenceData.items.length > 0) {
            setSelectedImage(evidenceData.items[0].fileUrl);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load review data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!listing || !verification) return;
    
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/trust-lens?listingId=${listing.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PASSED',
          reviewNotes,
          integrityFlags: selectedIntegrityFlags.length > 0 ? selectedIntegrityFlags : ['CLEAN'],
        }),
      });

      if (response.ok) {
        router.push('/admin?tab=verification');
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.message || data.error || 'Failed to approve verification');
      }
    } catch (error) {
      console.error('Failed to approve:', error);
      setError('Failed to approve verification. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!listing || !verification) return;
    
    if (!reviewNotes.trim()) {
      setError('Please provide review notes explaining why this listing was rejected');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/trust-lens?listingId=${listing.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'FAILED',
          reviewNotes,
          integrityFlags: selectedIntegrityFlags,
        }),
      });

      if (response.ok) {
        router.push('/admin?tab=verification');
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.message || data.error || 'Failed to reject verification');
      }
    } catch (error) {
      console.error('Failed to reject:', error);
      setError('Failed to reject verification. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleIntegrityFlag = (flag: string) => {
    setSelectedIntegrityFlags(prev => 
      prev.includes(flag) 
        ? prev.filter(f => f !== flag)
        : [...prev, flag]
    );
  };

  if (user?.role !== 'ADMIN') {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center" role="status">
        <div className="text-center">
          <div className="inline-block motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]" aria-hidden="true"></div>
          <span className="sr-only">Loading...</span>
          <p className="mt-4 text-[var(--color-text-secondary)]">Loading verification data...</p>
        </div>
      </div>
    );
  }

  if (error && !listing && !verification) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-center max-w-md px-4" role="alert">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/admin?tab=verification" className="inline-block px-4 py-2 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90">
            Back to Verification Queue
          </Link>
        </div>
      </div>
    );
  }

  if (listingNotFound) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-center max-w-md px-4" role="alert">
          <div className="text-5xl mb-4" aria-hidden="true">404</div>
          <h1 className="text-xl font-semibold text-[var(--color-text)] mb-2">Listing not found</h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            The listing you&apos;re trying to review does not exist or has been removed.
          </p>
          <Link href="/admin?tab=verification" className="inline-block px-4 py-2 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90">
            Back to Verification Queue
          </Link>
        </div>
      </div>
    );
  }

  if (verificationNotFound) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-center max-w-md px-4" role="status">
          <div className="text-4xl mb-4" aria-hidden="true">⏳</div>
          <h1 className="text-xl font-semibold text-[var(--color-text)] mb-2">No verification request yet</h1>
          <p className="text-[var(--color-text-secondary)] mb-2">
            {listing ? (
              <>The listing <strong>{listing.title}</strong> has not submitted a verification request yet.</>
            ) : (
              'This listing has not submitted a verification request yet.'
            )}
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">
            Sellers must submit a Trust Lens verification request before an admin can review it.
          </p>
          <Link href="/admin?tab=verification" className="inline-block px-4 py-2 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90">
            Back to Verification Queue
          </Link>
        </div>
      </div>
    );
  }

  if (!listing || !verification) {
    return null;
  }

  const integrityFlags = ['CLEAN', 'IMEI_MISMATCH', 'ICLOUD_LOCKED', 'REPORTED_STOLEN', 'BLACKLISTED', 'SERIAL_MISMATCH'];

  return (
    <div className="min-h-screen bg-[var(--color-background)] py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/admin?tab=verification" className="text-[var(--color-primary)] hover:underline mb-2 inline-block">
              ← Back to Verification Queue
            </Link>
            <h1 className="text-3xl font-bold text-[var(--color-text)]">Review Listing</h1>
            <p className="text-[var(--color-text-secondary)]">{listing.title}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleReject}
              disabled={submitting}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Reject'}
            </button>
            <button
              onClick={handleApprove}
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Approve'}
            </button>
          </div>
        </div>

        {/* Inline error banner */}
        {error && (
          <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <span className="flex-1 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 text-lg leading-none">&times;</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Images */}
          <div>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Evidence Images</h2>
              
              {selectedImage && (
                <div className="mb-4">
                  <img
                    src={selectedImage}
                    alt="Selected evidence"
                    className="w-full h-96 object-contain bg-gray-100 rounded-lg"
                  />
                </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                {evidence.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedImage(item.fileUrl)}
                    aria-label={`View image: ${item.fileName}`}
                    aria-pressed={selectedImage === item.fileUrl}
                    className={`cursor-pointer border-2 rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
                      selectedImage === item.fileUrl ? 'border-[var(--color-primary)]' : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={item.fileUrl}
                      alt={item.fileName}
                      className="w-full h-20 object-cover"
                    />
                  </button>
                ))}
              </div>

              {evidence.length === 0 && (
                <p className="text-[var(--color-text-secondary)] text-center py-8">No evidence images uploaded</p>
              )}
            </div>

            {/* Evidence Checklist */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Evidence Checklist</h2>
              <div className="space-y-2">
                {verification.evidenceChecklist.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <span className="text-sm text-[var(--color-text)]">{item.description}</span>
                    <span className={`text-xs px-2 py-1 rounded ${item.fulfilled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {item.fulfilled ? 'Fulfilled' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Listing Details & Review Form */}
          <div className="space-y-6">
            {/* Listing Details */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Listing Details</h2>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-[var(--color-text-secondary)]">Device</span>
                  <p className="font-medium text-[var(--color-text)]">{listing.brand} {listing.model}</p>
                </div>
                <div>
                  <span className="text-sm text-[var(--color-text-secondary)]">Price</span>
                  <p className="font-medium text-[var(--color-text)]">{listing.currency} {typeof listing.price === 'string' ? parseFloat(listing.price).toLocaleString() : listing.price.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-sm text-[var(--color-text-secondary)]">Condition Grade</span>
                  <p className="font-medium text-[var(--color-text)]">Grade {listing.conditionGrade}</p>
                </div>
                {listing.imei && (
                  <div>
                    <span className="text-sm text-[var(--color-text-secondary)]">IMEI</span>
                    <p className="font-medium text-[var(--color-text)] font-mono">{listing.imei}</p>
                  </div>
                )}
                {listing.serialNumber && (
                  <div>
                    <span className="text-sm text-[var(--color-text-secondary)]">Serial Number</span>
                    <p className="font-medium text-[var(--color-text)] font-mono">{listing.serialNumber}</p>
                  </div>
                )}
                <div>
                  <span className="text-sm text-[var(--color-text-secondary)]">Description</span>
                  <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">{listing.description}</p>
                </div>
              </div>
            </div>

            {/* Identifier Validation / IMEI Check Results */}
            {verification.identifierValidation && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">IMEI Check Results</h2>

                {(() => {
                  const iv = verification.identifierValidation!;
                  const raw = iv.rawApiResponse as Record<string, any> | null;
                  const s3 = raw?.service3 as Record<string, any> | null;
                  const s4 = raw?.service4 as Record<string, any> | null;
                  const s5 = raw?.service5 as Record<string, any> | null;
                  const deviceInfo = s3?.object as Record<string, any> | null;

                  const statusBadge = (ok: boolean | null, trueLabel: string, falseLabel: string, trueIsGood = true) => {
                    if (ok === null) return <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">N/A</span>;
                    const isGood = trueIsGood ? ok : !ok;
                    return (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {ok ? trueLabel : falseLabel}
                      </span>
                    );
                  };

                  const checksRun = Array.isArray(raw?.checksRun) ? (raw!.checksRun as string[]) : null;

                  return (
                    <div className="space-y-4">
                      {/* Device identifiers */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[var(--color-text-secondary)] text-xs mb-0.5">IMEI</p>
                          <p className="font-mono font-medium">{iv.imei || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[var(--color-text-secondary)] text-xs mb-0.5">Serial Number</p>
                          <p className="font-mono font-medium">{iv.serialNumber || '—'}</p>
                        </div>
                      </div>

                      {/* Apple device info from service 3 */}
                      {deviceInfo && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Apple Device Info</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                            {deviceInfo.modelName && (
                              <div>
                                <span className="text-gray-500 text-xs">Model</span>
                                <p className="font-medium">{String(deviceInfo.modelName)}</p>
                              </div>
                            )}
                            {deviceInfo.color && (
                              <div>
                                <span className="text-gray-500 text-xs">Color</span>
                                <p className="font-medium">{String(deviceInfo.color)}</p>
                              </div>
                            )}
                            {deviceInfo.storage && (
                              <div>
                                <span className="text-gray-500 text-xs">Storage</span>
                                <p className="font-medium">{String(deviceInfo.storage)}</p>
                              </div>
                            )}
                            {deviceInfo.region && (
                              <div>
                                <span className="text-gray-500 text-xs">Region</span>
                                <p className="font-medium">{String(deviceInfo.region)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Check status flags */}
                      <div className="border rounded-lg divide-y text-sm">
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-[var(--color-text)]">IMEI Valid</span>
                          {statusBadge(iv.imeiValid, 'Valid', 'Invalid')}
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-[var(--color-text)]">iCloud / Activation Lock</span>
                          {statusBadge(iv.icloudLocked, 'Locked', 'Clean', false)}
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-[var(--color-text)]">Find My iPhone (FMI)</span>
                          {statusBadge(iv.fmiOn, 'On', 'Off', false)}
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-[var(--color-text)]">Blacklist Status (GSMA)</span>
                          {statusBadge(iv.blacklisted, 'Blacklisted', 'Clean', false)}
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-[var(--color-text)]">Reported Stolen</span>
                          {statusBadge(iv.reportedStolen, 'Reported', 'Clean', false)}
                        </div>
                      </div>

                      {/* API error notes if any */}
                      {raw?.errors && Array.isArray(raw.errors) && (raw.errors as string[]).length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                          <p className="font-medium mb-1">API Notes</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {(raw.errors as string[]).map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                        </div>
                      )}

                      {/* Checks that were actually run */}
                      {checksRun && checksRun.length > 0 && (
                        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs">
                          <p className="font-medium text-gray-600 mb-1.5">Checks performed</p>
                          <div className="flex flex-wrap gap-1.5">
                            {checksRun.map((check) => (
                              <span key={check} className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-700 font-mono">
                                {check.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {iv.verifiedAt && (
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          Checked: {new Date(iv.verifiedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Review Form */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">Review Assessment</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Integrity Flags
                </label>
                <div className="space-y-2">
                  {integrityFlags.map((flag) => (
                    <label key={flag} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedIntegrityFlags.includes(flag)}
                        onChange={() => toggleIntegrityFlag(flag)}
                        className="mr-2"
                      />
                      <span className="text-sm text-[var(--color-text)]">{flag.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Review Notes
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={6}
                  placeholder="Add notes about your review decision..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
