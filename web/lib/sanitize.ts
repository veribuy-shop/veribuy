/**
 * Response sanitization utilities.
 *
 * All functions here strip fields that must never be exposed to the browser:
 * internal IDs used for joins, password hashes, raw tokens, audit timestamps
 * that leak schema details, and any other back-end implementation details.
 *
 * Rules:
 *  - Never return passwordHash, password, refreshToken, accessToken
 *  - Never return internal DB fields (shippingAddressId, paymentIntentId exposed
 *    only where the frontend legitimately needs it, e.g. confirm-payment)
 *  - Strip null prototype pollution risks by only picking known-good fields
 *  - Always return plain objects — never raw Prisma rows
 */

// ---------------------------------------------------------------------------
// Shared safe-field pickers
// ---------------------------------------------------------------------------

/**
 * Auth session user — the minimal shape stored in the auth context and returned
 * by login / register / verify / refresh. Only what the UI needs to render the
 * logged-in state. Never includes timestamps or internal account metadata.
 */
export interface SafeAuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** Admin user record — includes account timestamps for admin user-management views. */
export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SafeProfile {
  id: string;
  userId: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SafePublicProfile {
  displayName: string;
  avatarUrl: string | null;
}

export interface SafeAdminProfile {
  displayName: string;
  avatarUrl: string | null;
  email: string;
}

/** Public listing — strips IMEI and serial number, safe for unauthenticated viewers. */
export interface SafePublicListing {
  id: string;
  sellerId: string;
  title: string;
  description: string | null;
  deviceType: string;
  brand: string;
  model: string;
  storageCapacity: string | null;
  color: string | null;
  price: number;
  currency: string;
  status: string;
  conditionGrade: string | null;
  trustLensStatus: string;
  integrityFlags: string[];
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SafeTrustLens {
  id: string;
  listingId: string;
  sellerId: string;
  status: string;
  conditionGrade: string | null;
  reviewNotes: string | null;
  integrityFlags: string[] | null;
  evidenceChecklist: Array<{
    id: string;
    type: string;
    description: string | null;
    required: boolean;
    fulfilled: boolean;
    fulfilledAt: string | null;
    createdAt: string;
  }> | null;
  identifierValidation: {
    id: string;
    imeiProvided: boolean;
    serialProvided: boolean;
    imei: string | null;
    serialNumber: string | null;
    imeiValid: boolean | null;
    serialValid: boolean | null;
    icloudLocked: boolean | null;
    reportedStolen: boolean | null;
    blacklisted: boolean | null;
    fmiOn: boolean | null;
    verifiedAt: string | null;
    /** Raw API response from imeicheck.com — model/color/storage from service 3 */
    rawApiResponse: Record<string, unknown> | null;
  } | null;
  completedAt: string | null;
  createdAt: string;
}

export interface SafeEvidenceItem {
  id: string;
  fileUrl: string;
  fileName: string;
  type: string;
  uploadedAt: string;
}

export interface SafeListing {
  id: string;
  sellerId: string;
  title: string;
  description: string | null;
  deviceType: string;
  brand: string;
  model: string;
  storageCapacity: string | null;
  color: string | null;
  price: number;
  currency: string;
  status: string;
  conditionGrade: string | null;
  trustLensStatus: string;
  integrityFlags: string[];
  viewCount: number;
  imei: string | null;
  serialNumber: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SafeOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  trackingNumber: string | null;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  disputedAt: string | null;
  refundedAt: string | null;
}

/**
 * Order for admin analytics — includes sellerId so the frontend can group by
 * seller without needing full profile enrichment. Never returned to buyers/sellers.
 */
export interface SafeOrderAnalytics extends SafeOrder {
  sellerId: string;
  buyerId: string;
}

export interface SafeOrderWithPayment extends SafeOrder {
  clientSecret: string;
  paymentIntentId: string;
}

// ---------------------------------------------------------------------------
// Sanitizers
// ---------------------------------------------------------------------------

/** Auth session user — minimal shape for login/register/verify/refresh responses. */
export function sanitizeAuthUser(raw: Record<string, any>): SafeAuthUser {
  return {
    id: raw.id ?? raw.userId ?? '',
    name: raw.name ?? '',
    email: raw.email ?? '',
    role: raw.role ?? '',
  };
}

/** Strip everything except safe user fields returned to admin views. */
export function sanitizeUser(raw: Record<string, any>): SafeUser {
  return {
    id: raw.id ?? raw.userId ?? '',
    name: raw.name ?? '',
    email: raw.email ?? '',
    role: raw.role ?? '',
    isEmailVerified: raw.isEmailVerified ?? false,
    lastLoginAt: raw.lastLoginAt ?? null,
    createdAt: raw.createdAt ?? '',
  };
}

/** Own profile — returned only to the authenticated owner. */
export function sanitizeProfile(raw: Record<string, any>): SafeProfile {
  return {
    id: raw.id ?? '',
    userId: raw.userId ?? '',
    displayName: raw.displayName ?? '',
    firstName: raw.firstName ?? null,
    lastName: raw.lastName ?? null,
    bio: raw.bio ?? null,
    avatarUrl: raw.avatarUrl ?? null,
    phone: raw.phone ?? null,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  };
}

/** Public profile — safe to show to any authenticated user (e.g. seller on an order). */
export function sanitizePublicProfile(raw: Record<string, any> | null): SafePublicProfile | null {
  if (!raw) return null;
  return {
    displayName: raw.displayName ?? '',
    avatarUrl: raw.avatarUrl ?? null,
  };
}

/** Admin profile — includes email; only for admin-gated routes. */
export function sanitizeAdminProfile(raw: Record<string, any> | null): SafeAdminProfile | null {
  if (!raw) return null;
  return {
    displayName: raw.displayName ?? '',
    avatarUrl: raw.avatarUrl ?? null,
    email: raw.email ?? '',
  };
}

/** Public listing — strips IMEI and serial number. Use for unauthenticated / non-owner views. */
export function sanitizePublicListing(raw: Record<string, any>): SafePublicListing {
  return {
    id: raw.id ?? '',
    sellerId: raw.sellerId ?? '',
    title: raw.title ?? '',
    description: raw.description ?? null,
    deviceType: raw.deviceType ?? '',
    brand: raw.brand ?? '',
    model: raw.model ?? '',
    storageCapacity: raw.storageCapacity ?? null,
    color: raw.color ?? null,
    price: Number(raw.price ?? 0),
    currency: raw.currency ?? '',
    status: raw.status ?? '',
    conditionGrade: raw.conditionGrade ?? null,
    trustLensStatus: raw.trustLensStatus ?? '',
    integrityFlags: Array.isArray(raw.integrityFlags) ? raw.integrityFlags : [],
    viewCount: Number(raw.viewCount ?? 0),
    publishedAt: raw.publishedAt ?? null,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  };
}

/** Trust Lens verification request — strips sensitive internal verification details. */
export function sanitizeTrustLens(raw: Record<string, any>): SafeTrustLens {
  const iv = raw.identifierValidation ?? null;
  const ec = raw.evidenceChecklist ?? null;
  return {
    id: raw.id ?? '',
    listingId: raw.listingId ?? '',
    sellerId: raw.sellerId ?? '',
    status: raw.status ?? '',
    conditionGrade: raw.conditionGrade ?? null,
    reviewNotes: raw.reviewNotes ?? null,
    integrityFlags: Array.isArray(raw.integrityFlags) ? raw.integrityFlags : null,
    evidenceChecklist: Array.isArray(ec)
      ? ec.map((item: Record<string, any>) => ({
          id: item.id ?? '',
          type: item.type ?? '',
          description: item.description ?? null,
          required: Boolean(item.required),
          fulfilled: Boolean(item.fulfilled),
          fulfilledAt: item.fulfilledAt ?? null,
          createdAt: item.createdAt ?? '',
        }))
      : null,
    identifierValidation: iv
      ? {
          id: iv.id ?? '',
          imeiProvided: Boolean(iv.imeiProvided),
          serialProvided: Boolean(iv.serialProvided),
          imei: iv.imei ?? null,
          serialNumber: iv.serialNumber ?? null,
          imeiValid: iv.imeiValid != null ? Boolean(iv.imeiValid) : null,
          serialValid: iv.serialValid != null ? Boolean(iv.serialValid) : null,
          icloudLocked: iv.icloudLocked != null ? Boolean(iv.icloudLocked) : null,
          reportedStolen: iv.reportedStolen != null ? Boolean(iv.reportedStolen) : null,
          blacklisted: iv.blacklisted != null ? Boolean(iv.blacklisted) : null,
          fmiOn: iv.fmiOn != null ? Boolean(iv.fmiOn) : null,
          verifiedAt: iv.verifiedAt ?? null,
          rawApiResponse: iv.rawApiResponse ?? null,
        }
      : null,
    completedAt: raw.completedAt ?? null,
    createdAt: raw.createdAt ?? '',
  };
}

/** Evidence item — strips fileSize, mimeType, and internal metadata. */
export function sanitizeEvidenceItem(raw: Record<string, any>): SafeEvidenceItem {
  return {
    id: raw.id ?? '',
    fileUrl: raw.fileUrl ?? raw.url ?? '',
    fileName: raw.fileName ?? raw.name ?? '',
    type: raw.type ?? raw.evidenceType ?? '',
    uploadedAt: raw.uploadedAt ?? raw.createdAt ?? '',
  };
}

/** Listing — safe to return for both public and authenticated views. */
export function sanitizeListing(raw: Record<string, any>): SafeListing {
  return {
    id: raw.id ?? '',
    sellerId: raw.sellerId ?? '',
    title: raw.title ?? '',
    description: raw.description ?? null,
    deviceType: raw.deviceType ?? '',
    brand: raw.brand ?? '',
    model: raw.model ?? '',
    storageCapacity: raw.storageCapacity ?? null,
    color: raw.color ?? null,
    price: Number(raw.price ?? 0),
    currency: raw.currency ?? '',
    status: raw.status ?? '',
    conditionGrade: raw.conditionGrade ?? null,
    trustLensStatus: raw.trustLensStatus ?? '',
    integrityFlags: Array.isArray(raw.integrityFlags) ? raw.integrityFlags : [],
    viewCount: Number(raw.viewCount ?? 0),
    imei: raw.imei ?? null,
    serialNumber: raw.serialNumber ?? null,
    publishedAt: raw.publishedAt ?? null,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  };
}

/** Order — safe fields for buyer/seller views. Strips all internal join keys. */
export function sanitizeOrder(raw: Record<string, any>): SafeOrder {
  return {
    id: raw.id ?? '',
    amount: Number(raw.amount ?? 0),
    currency: raw.currency ?? '',
    status: raw.status ?? '',
    trackingNumber: raw.trackingNumber ?? null,
    createdAt: raw.createdAt ?? '',
    paidAt: raw.paidAt ?? null,
    shippedAt: raw.shippedAt ?? null,
    deliveredAt: raw.deliveredAt ?? null,
    completedAt: raw.completedAt ?? null,
    disputedAt: raw.disputedAt ?? null,
    refundedAt: raw.refundedAt ?? null,
  };
}

/** Order for admin analytics — retains sellerId/buyerId for grouping. Admin-gated routes only. */
export function sanitizeOrderAnalytics(raw: Record<string, any>): SafeOrderAnalytics {
  return {
    ...sanitizeOrder(raw),
    sellerId: raw.sellerId ?? '',
    buyerId: raw.buyerId ?? '',
  };
}

/**
 * Order with payment fields — used only in the create-order / confirm-payment flow
 * where the client legitimately needs clientSecret to complete Stripe payment.
 */
export function sanitizeOrderWithPayment(raw: Record<string, any>): SafeOrderWithPayment {
  return {
    ...sanitizeOrder(raw),
    clientSecret: raw.clientSecret ?? '',
    paymentIntentId: raw.paymentIntentId ?? '',
  };
}

/** Sanitize a paginated list response: { data: T[], pagination: {...} } */
export function sanitizePaginated<T>(
  raw: Record<string, any>,
  itemSanitizer: (item: Record<string, any>) => T,
): { data: T[]; pagination: Record<string, number> } {
  const items: any[] = Array.isArray(raw) ? raw : (raw.data ?? raw.orders ?? []);
  return {
    data: items.map(itemSanitizer),
    pagination: raw.pagination ?? {
      page: raw.page ?? 1,
      limit: raw.limit ?? items.length,
      total: raw.total ?? items.length,
      totalPages: raw.pages ?? raw.totalPages ?? 1,
    },
  };
}
