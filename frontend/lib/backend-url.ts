export function getBackendUrl(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.AUTH_SERVICE_URL ||
    process.env.USER_SERVICE_URL ||
    process.env.LISTING_SERVICE_URL ||
    process.env.TRUST_LENS_SERVICE_URL ||
    process.env.EVIDENCE_SERVICE_URL ||
    process.env.TRANSACTION_SERVICE_URL ||
    process.env.NOTIFICATION_SERVICE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'https://api.veribuy.shop'
  );
}
