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

export interface SocialAuthResponse extends AuthResponse {
  isNewUser?: boolean;
  requiresEmailVerification?: boolean;
  requiresProfileCompletion?: boolean;
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
  socialLogin: (
    provider: 'GOOGLE' | 'APPLE',
    payload?: {
      email?: string;
      name?: string;
      token?: string;
      referralCode?: string;
      action?: 'login' | 'register';
    },
  ) => Promise<SocialAuthResponse>;
  register: (
    name: string,
    email: string,
    password: string,
    referralCode?: string,
  ) => Promise<RegisterResult>;
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

  const socialLogin = useCallback(
    async (
      provider: 'GOOGLE' | 'APPLE',
      payload?: {
        email?: string;
        name?: string;
        token?: string;
        referralCode?: string;
        action?: 'login' | 'register';
      },
    ): Promise<SocialAuthResponse> => {
      if (!payload?.email) {
        throw new Error(`Please provide your ${provider === 'GOOGLE' ? 'Google' : 'Apple'} email address.`);
      }

      const email = payload.email.toLowerCase().trim();
      const defaultName =
        payload?.name || (provider === 'GOOGLE' ? 'Google Verified User' : 'Apple Verified User');

      const res = await api.public.post<SocialAuthResponse>('/auth/social', {
        provider,
        email,
        name: defaultName,
        token: payload?.token,
        referralCode: payload?.referralCode,
        action: payload?.action,
      });

      if (res.requiresEmailVerification || !res.user.isEmailVerified) {
        await saveTokens({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
        });
      } else {
        await persistAuth(res);
      }

      return res;
    },
    [persistAuth],
  );

  const register = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      referralCode?: string,
    ): Promise<RegisterResult> => {
      const payload: Record<string, unknown> = {
        name,
        email,
        password,
      };
      if (referralCode?.trim()) {
        payload.referralCode = referralCode.trim().toUpperCase();
      }

      const res = await api.public.post<RegisterResponse>('/auth/register', payload);

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
      socialLogin,
      register,
      logout,
      refreshUser,
    }),
    [loading, user, login, socialLogin, register, logout, refreshUser],
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
