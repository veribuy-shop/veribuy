import { API_URL } from '../env';
import { ApiError } from '../types/api';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokens';

let refreshing: Promise<void> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(cb: (() => void) | null): void {
  onSessionExpired = cb;
}

async function refreshTokens(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token');
  }

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    await clearTokens();
    throw new Error('Refresh failed');
  }

  const data = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
  };

  await saveTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
}

async function doRefresh(): Promise<void> {
  if (!refreshing) {
    refreshing = refreshTokens().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/**
 * Proactively refresh the access token. Safe to call on an interval; no-ops
 * when a refresh is already in flight. Returns true on success.
 */
export async function refreshSession(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;
  try {
    await doRefresh();
    return true;
  } catch {
    return false;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /**
   * Set true when the body is already FormData (do not JSON.stringify).
   */
  formData?: boolean;
  /**
   * Set true to skip the Authorization header entirely (e.g. login/register).
   */
  public?: boolean;
  retried?: boolean;
}

async function rawRequest<T>(
  path: string,
  opts: RequestOptions,
  token: string | null,
): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers || {}) };

  if (!opts.formData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || 'GET',
    headers,
    body:
      opts.formData && opts.body
        ? (opts.body as BodyInit)
        : opts.body
          ? JSON.stringify(opts.body)
          : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      Array.isArray(data?.message) ? data.message.join(', ') : data?.message || res.statusText,
      data,
    );
  }

  return data as T;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (opts.public) {
    return rawRequest<T>(path, opts, null);
  }

  const token = await getAccessToken();

  try {
    return await rawRequest<T>(path, opts, token);
  } catch (err) {
    // Only attempt refresh on a 401 that we haven't already retried.
    if (err instanceof ApiError && err.status === 401 && !opts.retried) {
      try {
        await doRefresh();
        const newToken = await getAccessToken();
        return await rawRequest<T>(path, { ...opts, retried: true }, newToken);
      } catch {
        await clearTokens();
        onSessionExpired?.();
        throw err;
      }
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: 'GET', headers }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  form: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData, formData: true }),
  public: {
    get: <T>(path: string, headers?: Record<string, string>) =>
      request<T>(path, { method: 'GET', headers, public: true }),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, { method: 'POST', body, public: true }),
  },
};
