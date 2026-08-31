import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'veribuy_access_token';
const REFRESH_TOKEN_KEY = 'veribuy_refresh_token';
const USER_KEY = 'veribuy_user';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function saveUser<T>(user: T): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getUser<T>(): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
}
