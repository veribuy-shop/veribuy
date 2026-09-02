'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldX,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Minus,
  Lock,
  ArrowRight,
  Smartphone,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type CheckResult = 'CLEAN' | 'FLAGGED' | 'LOCKED' | 'NOT_APPLICABLE' | 'NOT_RUN';
type TrustLensStatus = 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'REQUIRES_REVIEW';

interface VerificationSummary {
  listingId: string;
  status: string;
  conditionGrade: string | null;
  integrityFlags: string[];
  imeiCheckPerformed: boolean;
  isAppleDevice: boolean;
  liveStatus: TrustLensStatus | null;
  checks: {
    gsmaBlacklist: CheckResult;
    icloudStatus: CheckResult;
    stolenReport: CheckResult;
  } | null;
  deviceAttributes: Array<{ label: string; value: string }>;
  verifiedAt: string | null;
  completedAt: string | null;
}

const CHECK_CONFIG: Record<
  CheckResult,
  { icon: typeof CheckCircle2; label: string; className: string; bgClassName: string }
> = {
  CLEAN: { icon: CheckCircle2, label: 'Passed', className: 'text-emerald-600', bgClassName: 'bg-emerald-50 border-emerald-200' },
  FLAGGED: { icon: XCircle, label: 'Flagged', className: 'text-red-600', bgClassName: 'bg-red-50 border-red-200' },
  LOCKED: { icon: Lock, label: 'Locked', className: 'text-red-600', bgClassName: 'bg-red-50 border-red-200' },
  NOT_APPLICABLE: { icon: Minus, label: 'N/A', className: 'text-[var(--color-text-muted)]', bgClassName: 'bg-gray-50 border-gray-200' },
  NOT_RUN: { icon: Minus, label: 'Not checked', className: 'text-[var(--color-text-muted)]', bgClassName: 'bg-gray-50 border-gray-200' },
};

const STATUS_CONFIG: Record<
  TrustLensStatus,
  { icon: typeof ShieldCheck; title: string; description: string; className: string; bgClassName: string; textClassName: string }
> = {
  PASSED: {
    icon: ShieldCheck,
    title: 'Verification Passed',
    description: 'Your device passed all automated checks and is now live on the marketplace.',
    className: 'bg-emerald-600',
    bgClassName: 'bg-emerald-50 border-emerald-200',
    textClassName: 'text-emerald-700',
  },
  REQUIRES_REVIEW: {
    icon: AlertTriangle,
    title: 'Pending Human Review',
    description: 'One or more checks need closer inspection by our team. Your listing is queued for admin review.',
    className: 'bg-orange-600',
    bgClassName: 'bg-orange-50 border-orange-200',
    textClassName: 'text-orange-700',
  },
  FAILED: {
    icon: ShieldX,
    title: 'Verification Failed',
    description: 'Your device did not pass verification and cannot be listed for sale.',
    className: 'bg-red-500',
    bgClassName: 'bg-red-50 border-red-200',
    textClassName: 'text-red-700',
  },
  IN_PROGRESS: {
    icon: Clock,
    title: 'Running Device Check',
    description: 'We are checking your device against carrier blacklists and brand databases. This usually takes under a minute.',
    className: 'bg-yellow-600',
    bgClassName: 'bg-yellow-50 border-yellow-200',
    textClassName: 'text-yellow-700',
  },
  PENDING: {
    icon: Clock,
    title: 'Starting Verification',
    description: 'Your check is being queued. This usually takes a few seconds.',
    className: 'bg-gray-500',
    bgClassName: 'bg-gray-50 border-gray-200',
    textClassName: 'text-gray-600',
  },
};

function isTerminal(s: TrustLensStatus): boolean {
  return s === 'PASSED' || s === 'REQUIRES_REVIEW' || s === 'FAILED';
}

function VerificationReportContent({ id }: { id: string }) {
  const router = useRouter();
  const [summary, setSummary] = useState<VerificationSummary | null>(null);
  const [error, setError] = useState('');
  const [enoughInfo, setEnoughInfo] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let polling = true;

    const load = async () => {
      const res = await fetch(`/api/listings/${id}/verification`, { signal });
      if (!res.ok) throw new Error(res.status === 404 ? 'Listing not found' : 'Failed to load check');
      const data: VerificationSummary = await res.json();
      setSummary(data);
      const live: TrustLensStatus = data.liveStatus ?? (data.status as TrustLensStatus) ?? 'PENDING';
      const done = isTerminal(live) || !data.imeiCheckPerformed;
      if (done) {
        // Give the terminal state a moment to render before stopping.
        setEnoughInfo(true);
        polling = false;
      }
      return done;
    };

    const run = async () => {
      try {
        await load();
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Failed to load verification');
        polling = false;
        return;
      }
      // Adaptive backoff while the check runs; stop the instant it completes.
      const MAX_POLL_MS = 60_000;
      const startedAt = Date.now();
      while (polling && Date.now() - startedAt < MAX_POLL_MS) {
        const elapsed = Date.now() - startedAt;
        const interval = elapsed < 5000 ? 800 : elapsed < 15000 ? 1200 : 2000;
        await new Promise((r) => setTimeout(r, interval));
        if (!polling || signal.aborted) return;
        try {
          const done = await load();
          if (done) return;
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          break;
        }
      }
    };

    run();
    return () => {
      controller.abort();
      polling = false;
    };
  }, [id]);

  const live: TrustLensStatus | 'PENDING' =
    summary?.liveStatus ?? (summary?.status as TrustLensStatus) ?? 'PENDING';
  const Status = STATUS_CONFIG[live];
  const StatusIcon = Status.icon;
  const running = !isTerminal(live);
  const unstarted = !summary?.imeiCheckPerformed && !running;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-[var(--color-surface)] py-10">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] mb-2">
            Device Verification
          </h1>
          <p className="text-[var(--color-text-muted)]">
            {running
              ? 'We are running your IMEI check now'
              : 'Your Trust Lens verification report'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden mb-6">
          {/* Status band */}
          <div className={cn('px-6 py-6 border-b', Status.bgClassName)}>
            <div className="flex items-center gap-4">
              <div className={cn('w-14 h-14 rounded-full flex items-center justify-center shrink-0', Status.className)}>
                {running ? (
                  <Loader2 className="w-7 h-7 text-white motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                  <StatusIcon className="w-7 h-7 text-white" aria-hidden="true" />
                )}
              </div>
              <div>
                <h2 className={cn('text-lg font-bold', Status.textClassName)}>{Status.title}</h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{Status.description}</p>
              </div>
            </div>
          </div>

          {/* Pre-check notice */}
          {unstarted && (
            <div className="px-6 py-4 bg-[var(--color-warning)]/10 border-b border-[var(--color-warning)]/30 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
              <p className="text-xs text-[var(--color-text)]">
                The automated check could not be started. Your listing was created, but it will remain
                unavailable for purchase until it can be verified.
              </p>
            </div>
          )}

          {/* Checks */}
          <div className="px-6 py-6 space-y-4">
            {summary?.imeiCheckPerformed && summary?.checks ? (
              <div className="space-y-3">
                {[
                  { label: 'GSMA Blacklist', help: 'Checked against global carrier blacklist databases', result: summary.checks.gsmaBlacklist },
                  { label: 'Stolen Device Report', help: 'Cross-referenced with stolen device registries', result: summary.checks.stolenReport },
                  ...(summary.isAppleDevice
                    ? [{ label: 'iCloud / Find My', help: 'Checked iCloud lock and Find My status', result: summary.checks.icloudStatus }]
                    : []),
                ].map((check) => {
                  const cfg = CHECK_CONFIG[check.result];
                  const CheckIcon = cfg.icon;
                  return (
                    <div key={check.label} className="flex items-center gap-3 p-4 rounded-xl border border-[var(--color-border)] bg-white">
                      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', cfg.bgClassName)}>
                        <CheckIcon className={cn('w-5 h-5', cfg.className)} aria-hidden="true" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[var(--color-text)]">{check.label}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{check.help}</p>
                      </div>
                      <span className={cn('text-sm font-bold', cfg.className)}>{cfg.label}</span>
                    </div>
                  );
                })}
                {(summary.deviceAttributes?.length ?? 0) > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {summary.deviceAttributes!.map((attr) => (
                      <div key={attr.label} className="flex items-start gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0">
                          <Smartphone className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-[var(--color-text-muted)]">{attr.label}</p>
                          <p className="text-sm font-semibold text-[var(--color-text)] truncate" title={attr.value}>{attr.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : running ? (
              <div className="text-center py-8" role="status">
                <div
                  aria-hidden="true"
                  className="inline-block motion-safe:animate-spin rounded-full h-10 w-10 border-2 border-[var(--color-border)] border-t-[var(--color-accent)]"
                />
                <p aria-hidden="true" className="mt-4 text-sm text-[var(--color-text-muted)]">
                  Checking your device…
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <Minus className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" aria-hidden="true" />
                <p className="text-sm text-[var(--color-text-muted)]">No check results available yet.</p>
              </div>
            )}

            {error && (
              <div className="text-center text-sm text-[var(--color-danger)]">{error}</div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => router.push(`/listings/${id}`)}
            className="flex items-center justify-center gap-2 flex-1 px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            View Listing <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <Link
            href="/dashboard"
            className="flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
          This is your Verification Report. Buyers can view a summary of these checks on your listing.
        </p>
      </div>
    </div>
  );
}

export default async function VerificationReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VerificationReportContent id={id} />;
}
