'use client';

import { useEffect, useState } from 'react';

/** Fired after messages are marked read so unread badges can refresh. */
export const MESSAGES_READ_EVENT = 'vb:messages-read';

const POLL_MS = 60_000;

/**
 * Unread in-app message count for the signed-in user. Refreshes on an
 * interval, when the tab regains focus and when the inbox marks messages read.
 */
export function useUnreadMessages(userId: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      fetch('/api/messages/unread-count', { credentials: 'include', cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data) setCount(Number(data.count) || 0);
        })
        .catch(() => {
          // A missing badge is better than a broken header.
        });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    refresh();
    const timer = setInterval(refresh, POLL_MS);
    window.addEventListener(MESSAGES_READ_EVENT, refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(MESSAGES_READ_EVENT, refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  return count;
}
