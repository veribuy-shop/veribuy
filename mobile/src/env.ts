const DEFAULT_API_URL = 'https://api.veribuy.shop';

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') || DEFAULT_API_URL;

export const APP_SCHEME = 'veribuy';
