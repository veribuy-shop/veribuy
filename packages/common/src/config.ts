export function getInternalApiUrl(): string {
  const url =
    process.env.BACKEND_URL ||
    `http://localhost:${process.env.PORT || process.env.BACKEND_PORT || 3000}`;

  // Normalize a bare hostname (e.g. "api.veribuy.shop") so fetch() gets a
  // valid absolute URL. Prefer https for non-loopback hosts; keep http for
  // localhost/127.0.0.1 where TLS is not configured.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    return `https://${url}`;
  }

  return url;
}
