'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import {
  AnalyticsChoice,
  OPEN_COOKIE_SETTINGS_EVENT,
  readAnalyticsChoice,
  saveAnalyticsChoice,
} from '@/lib/analytics-consent';

const GA_ID = 'G-SQ22TQ686Z';

/** Stops Google Analytics straight away and removes the cookies it set on this site. */
function stopAnalytics() {
  (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = true;
  const hostParts = window.location.hostname.split('.');
  const domains = ['', ...hostParts.map((_, index) => `; domain=.${hostParts.slice(index).join('.')}`)];
  for (const entry of document.cookie.split(';')) {
    const name = entry.split('=')[0].trim();
    if (name === '_ga' || name.startsWith('_ga_')) {
      for (const domain of domains) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
      }
    }
  }
}

/** Google Analytics loads only after the visitor accepts it here. */
export function AnalyticsConsent() {
  const [choice, setChoice] = useState<AnalyticsChoice | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);

  useEffect(() => {
    const saved = readAnalyticsChoice();
    setChoice(saved);
    setBannerOpen(saved === null);

    const open = () => setBannerOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
  }, []);

  const choose = (next: AnalyticsChoice) => {
    saveAnalyticsChoice(next);
    setChoice(next);
    setBannerOpen(false);
    if (next === 'rejected') {
      stopAnalytics();
    } else {
      (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = false;
    }
  };

  return (
    <>
      {choice === 'accepted' && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}

      {bannerOpen && (
        <div
          role="region"
          aria-label="Cookie choices"
          className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[var(--color-border)] shadow-lg"
        >
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
            <p className="flex-1 text-sm text-[var(--color-text-muted)] leading-relaxed">
              We use essential cookies to keep VeriBuy working. With your permission we&apos;d also use Google
              Analytics to see how the site is used.{' '}
              <Link href="/cookies" className="text-[var(--color-green)] font-semibold hover:underline">
                Cookie Policy
              </Link>
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => choose('rejected')}
                className="flex-1 md:flex-none min-h-11 px-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary)] text-white text-sm font-semibold"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => choose('accepted')}
                className="flex-1 md:flex-none min-h-11 px-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary)] text-white text-sm font-semibold"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Lets visitors change their mind at any time. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
      className={className}
    >
      Cookie settings
    </button>
  );
}
