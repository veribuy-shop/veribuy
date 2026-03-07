'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in on mount by verifying session with backend
    const loadUser = async () => {
      try {
        // Call a verify endpoint that checks the HttpOnly cookie
        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          credentials: 'include', // Include cookies in request
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
        // 401 = no session / not logged in — expected, not an error
      } catch (error) {
        // Only log genuine network/parse failures, not auth state
        console.error('Failed to reach auth verify endpoint:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies in request
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    // Tokens are now in HttpOnly cookies, only store user data in memory
    setUser(data.user);

    // Redirect based on role
    if (data.user.role === 'ADMIN') {
      router.push('/admin');
    } else {
      router.push('/dashboard');
    }
  };

  const register = async (name: string, email: string, password: string) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies in request
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    // Tokens are now in HttpOnly cookies, only store user data in memory
    setUser(data.user);

    // Redirect to dashboard
    router.push('/dashboard');
  };

  const logout = async () => {
    try {
      // Call logout endpoint to clear HttpOnly cookies
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include', // Include cookies in request
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      router.push('/');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
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
