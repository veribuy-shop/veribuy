import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, refreshSession, setOnSessionExpired } from '../lib/api';
import {
  clearTokens,
  getUser,
  saveTokens,
  saveUser,
} from '../lib/tokens';
import { User } from '../types/entities';

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface RegisterResponse extends AuthResponse {
  autoVerified: boolean;
}

export interface RegisterResult {
  user: User;
  autoVerified: boolean;
}

interface AuthContextValue {
  loading: boolean;
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await getUser<User>();
      if (stored) {
        setUser(stored);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    setOnSessionExpired(() => {
      setUser(null);
    });
    return () => setOnSessionExpired(null);
  }, []);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      refreshSession();
    }, 12 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const persistAuth = useCallback(async (res: AuthResponse) => {
    await saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    await saveUser(res.user);
    setUser(res.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.public.post<AuthResponse>('/auth/login', { email, password });
      await persistAuth(res);
      return res.user;
    },
    [persistAuth],
  );

  const register = useCallback(
    async (name: string, email: string, password: string): Promise<RegisterResult> => {
      const res = await api.public.post<RegisterResponse>('/auth/register', {
        name,
        email,
        password,
      });

      const result: RegisterResult = { user: res.user, autoVerified: res.autoVerified };

      if (res.autoVerified) {
        // Dev mode: email already verified — log user in directly (mirrors web)
        await persistAuth(res);
      } else {
        // Production: persist tokens so the check-email resend (authenticated) works,
        // but do NOT set the session user — mirror web, which navigates to a public
        // /check-email page while staying logged out.
        await saveTokens({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
        });
      }

      return result;
    },
    [persistAuth],
  );

  const logout = useCallback(async () => {
    const { getRefreshToken } = await import('../lib/tokens');
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken });
      } catch {
        // ignore logout errors
      }
    }
    await clearTokens();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user) return null;
    return user;
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'ADMIN',
      login,
      register,
      logout,
      refreshUser,
    }),
    [loading, user, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
