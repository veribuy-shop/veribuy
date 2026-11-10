'use client';

import { Landmark } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/** Shown to sellers who can list but have not yet added the bank details they are paid into. Never blocks listing. */
export function PayoutSetupReminder() {
  const [needed, setNeeded] = useState(false);

  useEffect(() => {
    let current = true;
    fetch('/api/payouts/account', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((account) => {
        if (current && account && !account.payoutsEnabled) setNeeded(true);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  if (!needed) return null;
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
      <p className="text-sm flex items-start gap-2">
        <Landmark className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          <strong>Add your bank details to get paid.</strong> You can list now; money from a sale waits safely until they are added.
        </span>
      </p>
      <Link
        href="/dashboard?tab=earnings"
        className="inline-flex items-center justify-center rounded-lg bg-amber-900 px-3 py-2 text-sm font-semibold text-white whitespace-nowrap hover:bg-amber-800"
      >
        Add bank details
      </Link>
    </div>
  );
}
