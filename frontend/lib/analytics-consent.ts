export type AnalyticsChoice = 'accepted' | 'rejected';

const STORAGE_KEY = 'veribuy-analytics-consent';
const REASK_AFTER_MS = 365 * 24 * 60 * 60 * 1000;

/** Fired by "Cookie settings" links to reopen the consent banner. */
export const OPEN_COOKIE_SETTINGS_EVENT = 'veribuy:open-cookie-settings';

/** The visitor's saved choice, or null if they haven't made one or it's over a year old. */
export function readAnalyticsChoice(now = Date.now()): AnalyticsChoice | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved?.choice !== 'accepted' && saved?.choice !== 'rejected') return null;
    if (typeof saved.at !== 'number' || now - saved.at > REASK_AFTER_MS) return null;
    return saved.choice;
  } catch {
    return null;
  }
}

export function saveAnalyticsChoice(choice: AnalyticsChoice, now = Date.now()): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, at: now }));
  } catch {
    // Without storage the banner simply asks again on the next visit.
  }
}
