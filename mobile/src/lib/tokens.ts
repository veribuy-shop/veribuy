import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'veribuy_access_token';
const REFRESH_TOKEN_KEY = 'veribuy_refresh_token';
const USER_KEY = 'veribuy_user';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const isWeb = Platform.OS === 'web';
const memoryStore: Record<string, string> = {};

async function storageGet(key: string): Promise<string | null> {
  if (isWeb) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return memoryStore[key] || null;
      }
    }
    return memoryStore[key] || null;
  }
  return SecureStore.getItemAsync(key);
}

async function storageSet(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        memoryStore[key] = value;
      }
    } else {
      memoryStore[key] = value;
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function storageDelete(key: string): Promise<void> {
  if (isWeb) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        delete memoryStore[key];
      }
    } else {
      delete memoryStore[key];
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getAccessToken(): Promise<string | null> {
  return storageGet(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return storageGet(REFRESH_TOKEN_KEY);
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await storageSet(ACCESS_TOKEN_KEY, tokens.accessToken);
  await storageSet(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export async function clearTokens(): Promise<void> {
  await storageDelete(ACCESS_TOKEN_KEY);
  await storageDelete(REFRESH_TOKEN_KEY);
  await storageDelete(USER_KEY);
}

export async function saveUser<T>(user: T): Promise<void> {
  await storageSet(USER_KEY, JSON.stringify(user));
}

export async function getUser<T>(): Promise<T | null> {
  const raw = await storageGet(USER_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
}
