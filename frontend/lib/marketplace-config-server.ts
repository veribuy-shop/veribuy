import { getBackendUrl } from '@/lib/backend-url';
import { parseMarketplaceConfig, setMarketplaceConfig, type MarketplaceConfig } from '@/lib/marketplace-config';

/**
 * Reads the marketplace rules from the backend on the server, for server
 * components and route handlers. Returns null if the backend can't be reached.
 */
export async function loadMarketplaceConfig(): Promise<MarketplaceConfig | null> {
  try {
    const res = await fetch(`${getBackendUrl()}/transactions/config/marketplace`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const config = parseMarketplaceConfig(await res.json());
    if (config) setMarketplaceConfig(config);
    return config;
  } catch {
    return null;
  }
}
