'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { safeRedirectPath } from '@/lib/safe-redirect';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'BUYER' | 'SELLER' | 'ADMIN';
  accountType?: 'INDIVIDUAL' | 'BUSINESS';
  companyName?: string | null;
  referralCode?: string | null;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  profileCompleted?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country?: string;
  accountType?: 'INDIVIDUAL' | 'BUSINESS';
  companyName?: string;
  companyNumber?: string;
  vatNumber?: string;
  referralCode?: string;
  acceptedTerms: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, redirectTo?: string) => Promise<void>;
  socialLogin: (
    provider: 'GOOGLE' | 'APPLE',
    payload?: {
      email?: string;
      name?: string;
      idToken?: string;
      referralCode?: string;
      action?: 'login' | 'register';
    },
    redirectTo?: string,
  ) => Promise<{ requiresEmailVerification?: boolean; requiresProfileCompletion?: boolean; user?: User }>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  /** Fetch wrapper that auto-retries once on 401 after refreshing the token. */
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** How often to proactively refresh the access token (12 min of the 15-min TTL). */
const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  // Guard against concurrent refresh calls
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

  /**
   * Call /api/auth/refresh to get a new access token cookie.
   * Returns true if refresh succeeded, false otherwise.
   * De-duplicates concurrent calls so only one network request fires.
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    // If a refresh is already in-flight, piggyback on it
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const promise = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) setUser(data.user);
          return true;
        }
        // 409: another tab refreshed first; the browser already has new cookies.
        return res.status === 409;
      } catch {
        return false;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, []);

  /**
   * Fetch wrapper that ensures `credentials: 'include'` and retries once on
   * 401 after attempting a token refresh.
   */
  const authFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const opts: RequestInit = { ...init, credentials: 'include' };

    const res = await fetch(input, opts);

    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) {
        // Retry the original request with the new cookie
        return fetch(input, opts);
      }
      // Refresh failed — session is dead, clear user state
      setUser(null);
    }

    return res;
  }, [refreshSession]);

  // ── Transparent session refresh for every same-origin API call ──────
  // Many pages call `/api/*` with plain fetch. When the 15-minute access token
  // has expired (sleeping laptop, slow 3DS, long form), refresh once and retry
  // instead of surfacing "Invalid or expired token" to the user.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const originalFetch = window.fetch.bind(window);

    const isRetryableApiCall = (input: RequestInfo | URL): boolean => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      let url: URL;
      try {
        url = new URL(raw, window.location.origin);
      } catch {
        return false;
      }
      return (
        url.origin === window.location.origin &&
        url.pathname.startsWith('/api/') &&
        !url.pathname.startsWith('/api/auth/') &&
        // A Request object's body can only be read once — can't be replayed.
        !(input instanceof Request && input.body !== null)
      );
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await originalFetch(input, init);
      if (res.status !== 401 || !isRetryableApiCall(input)) return res;
      const refreshed = await refreshSession();
      return refreshed ? originalFetch(input, init) : res;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [refreshSession]);

  // ── Load user on mount ───────────────────────────────────────────────
  useEffect(() => {
    const loadUser = async () => {
      try {
        let response = await fetch('/api/auth/verify', {
          method: 'GET',
          credentials: 'include',
        });
        if (response.status === 409) {
          // Another tab/request refreshed the session at the same moment; its
          // new cookies are already set — just ask again.
          response = await fetch('/api/auth/verify', { method: 'GET', credentials: 'include' });
        }

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else if (response.status === 401) {
          // Access token may have expired — try refreshing
          const refreshed = await refreshSession();
          if (!refreshed) {
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Failed to reach auth verify endpoint:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [refreshSession]);

  // ── Proactive token refresh interval ─────────────────────────────────
  useEffect(() => {
    // Only run the interval when the user is logged in
    if (!user) return;

    const interval = setInterval(() => {
      refreshSession();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user, refreshSession]);

  const login = async (email: string, password: string, redirectTo?: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    setUser(data.user);

    if (redirectTo) {
      router.push(safeRedirectPath(redirectTo));
    } else if (data.user.role === 'ADMIN') {
      router.push('/admin');
    } else {
      router.push('/dashboard');
    }
  };

  const socialLogin = async (
    provider: 'GOOGLE' | 'APPLE',
    payload?: {
      email?: string;
      name?: string;
      idToken?: string;
      referralCode?: string;
      action?: 'login' | 'register';
    },
    redirectTo?: string,
  ) => {
    // The backend authenticates social sign-in only from a provider-signed ID token.
    if (!payload?.idToken) {
      throw new Error(`${provider === 'GOOGLE' ? 'Google' : 'Apple'} sign-in is not available right now.`);
    }

    const response = await fetch('/api/auth/social', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        provider,
        idToken: payload.idToken,
        name: payload?.name?.trim() || undefined,
        referralCode: payload?.referralCode,
        action: payload?.action,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `${provider} authentication failed`);
    }

    if (data.requiresEmailVerification || !data.user.isEmailVerified) {
      router.push('/check-email');
      return { requiresEmailVerification: true, user: data.user };
    }

    setUser(data.user);

    if (data.requiresProfileCompletion) {
      router.push('/profile?setup=required');
      return { requiresProfileCompletion: true, user: data.user };
    }

    if (redirectTo) {
      router.push(safeRedirectPath(redirectTo));
    } else if (data.user.role === 'ADMIN') {
      router.push('/admin');
    } else {
      router.push('/dashboard');
    }

    return { user: data.user };
  };

  const register = async (data: RegisterData) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const resData = await response.json();

    if (!response.ok) {
      throw new Error(resData.message || resData.error || 'Registration failed');
    }

    if (resData.autoVerified) {
      // Dev mode: email already verified — log user in directly
      setUser(resData.user);
      router.push('/dashboard');
    } else {
      // Production: email not yet verified — redirect to check-email page
      router.push('/check-email');
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      router.push('/');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, socialLogin, register, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
