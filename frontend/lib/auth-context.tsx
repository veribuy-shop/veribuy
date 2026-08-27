'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'BUYER' | 'SELLER' | 'ADMIN';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, redirectTo?: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
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
        return false;
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

  // ── Load user on mount ───────────────────────────────────────────────
  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          credentials: 'include',
        });

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
      router.push(redirectTo);
    } else if (data.user.role === 'ADMIN') {
      router.push('/admin');
    } else {
      router.push('/dashboard');
    }
  };

  const register = async (name: string, email: string, password: string) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    if (data.autoVerified) {
      // Dev mode: email already verified — log user in directly
      setUser(data.user);
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
    <AuthContext.Provider value={{ user, loading, login, register, logout, authFetch }}>
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
