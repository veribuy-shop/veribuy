/**
 * Social sign-in requires a provider-issued ID token (Google Identity Services /
 * Sign in with Apple) that the backend verifies. Until those SDKs are wired in,
 * the buttons stay hidden — set NEXT_PUBLIC_SOCIAL_SIGN_IN_ENABLED=true once they are.
 */
export const SOCIAL_SIGN_IN_ENABLED = process.env.NEXT_PUBLIC_SOCIAL_SIGN_IN_ENABLED === 'true';
