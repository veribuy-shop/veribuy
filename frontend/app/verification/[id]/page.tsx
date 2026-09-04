'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
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
  Share2,
  Check,
  Cpu,
  Layers,
  Sparkles,
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
  CLEAN: {
    icon: CheckCircle2,
    label: 'Clean & Verified',
    className: 'text-emerald-400',
    bgClassName: 'bg-emerald-500/10 border-emerald-500/30',
  },
  FLAGGED: {
    icon: XCircle,
    label: 'Flagged / Blacklisted',
    className: 'text-red-400',
    bgClassName: 'bg-red-500/10 border-red-500/30',
  },
  LOCKED: {
    icon: Lock,
    label: 'Activation Locked',
    className: 'text-red-400',
    bgClassName: 'bg-red-500/10 border-red-500/30',
  },
  NOT_APPLICABLE: {
    icon: Minus,
    label: 'Not Applicable',
    className: 'text-neutral-400',
    bgClassName: 'bg-neutral-800 border-neutral-700',
  },
  NOT_RUN: {
    icon: Minus,
    label: 'Not Checked',
    className: 'text-neutral-400',
    bgClassName: 'bg-neutral-800 border-neutral-700',
  },
};

const STATUS_CONFIG: Record<
  TrustLensStatus,
  {
    icon: typeof ShieldCheck;
    title: string;
    description: string;
    badgeClass: string;
    borderClass: string;
    textClass: string;
  }
> = {
  PASSED: {
    icon: ShieldCheck,
    title: 'Trust Lens™ Certified',
    description: 'This device passed all automated GSMA blacklist, activation lock, and serial integrity checks.',
    badgeClass: 'bg-emerald-500 text-neutral-950',
    borderClass: 'border-emerald-500/30 bg-emerald-950/20',
    textClass: 'text-emerald-400',
  },
  REQUIRES_REVIEW: {
    icon: AlertTriangle,
    title: 'Pending Manual Review',
    description: 'Automated telemetry flagged minor inconsistencies. Our verification team is inspecting the evidence.',
    badgeClass: 'bg-amber-500 text-neutral-950',
    borderClass: 'border-amber-500/30 bg-amber-950/20',
    textClass: 'text-amber-400',
  },
  FAILED: {
    icon: ShieldX,
    title: 'Verification Failed',
    description: 'This hardware was flagged on global blacklist registries and is prohibited from being sold on VeriBuy.',
    badgeClass: 'bg-red-500 text-white',
    borderClass: 'border-red-500/30 bg-red-950/20',
    textClass: 'text-red-400',
  },
  IN_PROGRESS: {
    icon: Clock,
    title: 'Executing Diagnostics',
    description: 'Querying GSMA database, Apple GSX, and carrier registries in real time.',
    badgeClass: 'bg-blue-500 text-neutral-950',
    borderClass: 'border-blue-500/30 bg-blue-950/20',
    textClass: 'text-blue-400',
  },
  PENDING: {
    icon: Clock,
    title: 'Queued for Verification',
    description: 'Diagnostic job has been registered and is waiting for execution.',
    badgeClass: 'bg-neutral-500 text-neutral-950',
    borderClass: 'border-neutral-700 bg-neutral-900',
    textClass: 'text-neutral-400',
  },
};

function isTerminal(s: TrustLensStatus): boolean {
  return s === 'PASSED' || s === 'REQUIRES_REVIEW' || s === 'FAILED';
}

function VerificationReportContent({ id }: { id: string }) {
  const router = useRouter();
  const [summary, setSummary] = useState<VerificationSummary | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

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

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const live: TrustLensStatus | 'PENDING' =
    summary?.liveStatus ?? (summary?.status as TrustLensStatus) ?? 'PENDING';
  const Status = STATUS_CONFIG[live];
  const StatusIcon = Status.icon;
  const running = !isTerminal(live);
  const unstarted = !summary?.imeiCheckPerformed && !running;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 py-10 md:py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Certificate Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Trust Lens™ Diagnostic Certificate
          </div>
          <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight">
            Hardware Verification Report
          </h1>
          <p className="text-neutral-400 text-sm md:text-base mt-2">
            Cryptographically sealed diagnostic audit powered by VeriBuy
          </p>
        </div>

        {/* Certificate Card */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl mb-8 backdrop-blur-sm">
          {/* Status Banner */}
          <div className={cn('p-6 md:p-8 border-b', Status.borderClass)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg',
                    Status.badgeClass
                  )}
                >
                  {running ? (
                    <Loader2 className="w-7 h-7 motion-safe:animate-spin" aria-hidden="true" />
                  ) : (
                    <StatusIcon className="w-7 h-7 stroke-[2.5]" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <h2 className={cn('text-lg md:text-xl font-bold tracking-tight', Status.textClass)}>
                    {Status.title}
                  </h2>
                  <p className="text-xs md:text-sm text-neutral-300 mt-1 max-w-md">
                    {Status.description}
                  </p>
                </div>
              </div>

              {/* Polling / Live indicator */}
              {running && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono self-start sm:self-auto">
                  <span className="w-2 h-2 rounded-full bg-blue-400 motion-safe:animate-ping" />
                  Live Polling GSMA API
                </div>
              )}
            </div>
          </div>

          {/* Pre-check notice */}
          {unstarted && (
            <div className="px-6 py-4 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-amber-200">
                Automated carrier verification has not run yet. This device remains in escrow pending completion.
              </p>
            </div>
          )}

          {/* Registry Checks List */}
          <div className="p-6 md:p-8 space-y-6">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Carrier & Database Registry Audits
              </h3>

              {summary?.imeiCheckPerformed && summary?.checks ? (
                <div className="space-y-3">
                  {[
                    {
                      label: 'GSMA Global Blacklist',
                      desc: 'Cross-referenced against global lost & stolen carrier registers across 44 countries',
                      result: summary.checks.gsmaBlacklist,
                    },
                    {
                      label: 'Police & Insurance Stolen Register',
                      desc: 'Checked against national police crime registries and insurance claims',
                      result: summary.checks.stolenReport,
                    },
                    ...(summary.isAppleDevice
                      ? [
                          {
                            label: 'Apple iCloud & Activation Lock',
                            desc: 'GSX check confirms Find My iPhone is fully disabled and ready for fresh setup',
                            result: summary.checks.icloudStatus,
                          },
                        ]
                      : []),
                  ].map((check) => {
                    const cfg = CHECK_CONFIG[check.result];
                    const CheckIcon = cfg.icon;
                    return (
                      <div
                        key={check.label}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 hover:border-neutral-700 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 sm:mt-0',
                              cfg.bgClassName
                            )}
                          >
                            <CheckIcon className={cn('w-4 h-4', cfg.className)} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{check.label}</p>
                            <p className="text-xs text-neutral-400 mt-0.5">{check.desc}</p>
                          </div>
                        </div>

                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border self-start sm:self-auto shrink-0',
                            cfg.bgClassName,
                            cfg.className
                          )}
                        >
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : running ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-emerald-400 motion-safe:animate-spin mx-auto mb-3" />
                  <p className="text-sm text-neutral-300 font-medium">Scanning GSMA & Carrier Registries...</p>
                  <p className="text-xs text-neutral-500 mt-1">This audit completes automatically in 15-30 seconds</p>
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-400 text-sm">
                  <Minus className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                  No check telemetry available.
                </div>
              )}
            </div>

            {/* Extracted Device Attributes */}
            {summary?.deviceAttributes && summary.deviceAttributes.length > 0 && (
              <div className="pt-4 border-t border-neutral-800">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" /> Extracted Hardware Specs
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {summary.deviceAttributes.map((attr) => (
                    <div
                      key={attr.label}
                      className="p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-400 shrink-0">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] uppercase tracking-wider text-neutral-500 block">
                          {attr.label}
                        </span>
                        <span className="text-xs font-bold text-white truncate block">
                          {attr.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error banner if any */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs text-center">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => router.push(`/listings/${id}`)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-950 transition-colors"
          >
            View Verified Listing <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 font-semibold text-sm rounded-xl transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" /> Certificate Link Copied
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" /> Share Certificate
              </>
            )}
          </button>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white font-medium text-sm rounded-xl transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
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
