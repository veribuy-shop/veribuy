export function getInternalApiUrl(): string {
  return (
    process.env.BACKEND_URL ||
    `http://localhost:${process.env.PORT || process.env.BACKEND_PORT || 3000}`
  );
}
