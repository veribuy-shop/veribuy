'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import {
  fetchMarketplaceConfig,
  isMarketplaceConfigKnown,
  setMarketplaceConfig,
  type MarketplaceConfig,
} from '@/lib/marketplace-config';

/**
 * Gives display helpers the backend's marketplace rules before anything renders.
 * If the page was cached with older rules, or without them, the fresh ones from
 * the browser replace them and the page redraws.
 */
export function MarketplaceConfigProvider({ config, children }: { config: MarketplaceConfig | null; children: ReactNode }) {
  const [current, setCurrent] = useState(config);
  if (current !== null) setMarketplaceConfig(current);

  useEffect(() => {
    fetchMarketplaceConfig().then((value) => {
      if (isMarketplaceConfigKnown()) setCurrent(value);
    });
  }, []);

  return <Fragment key={current ? JSON.stringify(current) : 'unknown'}>{children}</Fragment>;
}
