import { friendlyApiError } from '@veribuy/common/errors';

import { API_URL } from '../env';
import { ApiError } from '../types/api';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokens';

let refreshing: Promise<void> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(cb: (() => void) | null): void {
  onSessionExpired = cb;
}

/** The server rejected the session. Anything else is transient and keeps it. */
class SessionEndedError extends Error {}

async function refreshTokens(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new SessionEndedError('No refresh token');
  }

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (res.status === 401) {
    await clearTokens();
    throw new SessionEndedError('Refresh rejected');
  }
  if (!res.ok) {
    throw new Error(`Refresh failed (${res.status})`);
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

function fallbackMessage(status: number): string {
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status === 401) return 'Please sign in and try again.';
  if (status === 403) return 'You don’t have permission to do that.';
  if (status === 404) return 'We could not find that.';
  return 'Something went wrong on our side. Please try again.';
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

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method || 'GET',
      headers,
      body:
        opts.formData && opts.body
          ? (opts.body as BodyInit)
          : opts.body
            ? JSON.stringify(opts.body)
            : undefined,
    });
  } catch {
    throw new ApiError(0, 'We could not reach VeriBuy. Check your connection and try again.');
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    // A rejected login says nothing useful in the server's words. Sign-in itself
    // is public, so its "wrong password" message still comes through.
    const message =
      res.status === 401 && !opts.public ? fallbackMessage(401) : friendlyApiError(data, fallbackMessage(res.status));
    throw new ApiError(res.status, message, data);
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
      // Only the server rejecting the refresh ends the session. A dropped
      // connection or a failed retry surfaces as an error and stays signed in.
      try {
        await doRefresh();
      } catch (refreshErr) {
        if (refreshErr instanceof SessionEndedError) {
          onSessionExpired?.();
        }
        throw err;
      }
      const newToken = await getAccessToken();
      return rawRequest<T>(path, { ...opts, retried: true }, newToken);
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
