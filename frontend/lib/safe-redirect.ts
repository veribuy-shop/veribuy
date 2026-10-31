/**
 * Only allow same-origin, path-relative redirect targets. Rejects absolute
 * URLs (`https://evil.com`), protocol-relative URLs (`//evil.com`) and
 * backslash tricks (`/\evil.com`) that browsers treat as external.
 */
export function safeRedirectPath(target: string | null | undefined, fallback = '/dashboard'): string {
  if (!target || typeof target !== 'string') return fallback;
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback;
  // Reject control characters (e.g. newlines/tabs browsers strip from URLs).
  if ([...target].some((ch) => ch.charCodeAt(0) < 0x20)) return fallback;
  return target;
}
