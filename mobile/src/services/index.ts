import { friendlyApiError } from '@veribuy/common/errors';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { API_URL } from '../env';
import { api, refreshSession } from '../lib/api';
import { getAccessToken } from '../lib/tokens';
import { ApiError, Paginated, ShippingAddressDto } from '../types/api';
import {
  CreateOrderResult,
  EvidenceItem,
  Listing,
  Message,
  Notification,
  Order,
  ReferralSummary,
  TrustLensCheckSummary,
  TrustLensReport,
  User,
  UserProfile,
} from '../types/entities';

// Most list endpoints are paginated; a few older ones return a plain array.
type ListResponse<T> = Paginated<T> | T[];

export function rows<T>(res: ListResponse<T>): T[] {
  return Array.isArray(res) ? res : res?.data ?? [];
}

// ── Listings ──────────────────────────────────────────────────────────────
export interface ListingsQuery {
  page?: number;
  limit?: number;
  search?: string;
  deviceType?: string;
  brand?: string;
  status?: string;
  trustLensStatus?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}

export const listingDraftService = {
  get: () => api.get<{ data: Record<string, unknown>; step: number; updatedAt: string } | null>('/listings/draft'),
  save: (data: Record<string, unknown>, step: number) => api.put<unknown>('/listings/draft', { data, step }),
  clear: () => api.del<unknown>('/listings/draft'),
};

export const listingsService = {
  list: (query: ListingsQuery = {}) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    return api.get<Paginated<Listing>>(`/listings${qs ? `?${qs}` : ''}`);
  },
  bySeller: (sellerId: string) =>
    api.get<ListResponse<Listing>>(`/listings/seller/${sellerId}`).then(rows),
  get: (id: string) => api.get<Listing>(`/listings/${id}`),
  create: (data: Record<string, unknown>) => api.post<Listing>('/listings', data),
  placeBid: (id: string, maxBid: number) => api.post<Listing>(`/listings/${id}/bids`, { maxBid }),
  update: (id: string, data: Record<string, unknown>) => api.patch<Listing>(`/listings/${id}`, data),
  transitionStatus: (id: string, data: Record<string, unknown>) =>
    api.patch<Listing>(`/listings/${id}/status`, data),
  remove: (id: string) => api.del<unknown>(`/listings/${id}`),
};

// ── Auth (extra) ──────────────────────────────────────────────────────────
export const authService = {
  sendVerification: () => api.post<unknown>('/auth/send-verification-email'),
  verifyEmail: (token: string) => api.public.get<unknown>(`/auth/verify-email?token=${token}`),
  verifyCode: (token: string) => api.public.post<unknown>('/auth/verify', { token }),
  forgotPassword: (email: string) =>
    api.public.post<unknown>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.public.post<unknown>('/auth/reset-password', { token, password }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<unknown>('/auth/change-password', { currentPassword, newPassword }),
};

// ── Users / profile ───────────────────────────────────────────────────────
export const usersService = {
  closeAccount: (password: string) => api.post<{ message: string }>('/auth/me/delete', { password }),
  getProfile: (userId: string) => api.get<UserProfile>(`/users/${userId}/profile`),
  createProfile: (userId: string, data: Record<string, unknown>) =>
    api.post<UserProfile>(`/users/${userId}/profile`, data),
  updateProfile: (userId: string, data: Record<string, unknown>) =>
    api.put<UserProfile>(`/users/${userId}/profile`, data),
  validateReferralCode: (code: string) =>
    api.public.get<{ valid: boolean; referrerName?: string }>(
      `/users/referral-code/${encodeURIComponent(code)}/validate`,
    ),
  getReferrals: (userId: string) =>
    api.get<ReferralSummary>(`/users/${userId}/referrals`),
};

// ── Trust Lens ────────────────────────────────────────────────────────────
export const trustService = {
  getForListing: (listingId: string) => api.get<TrustLensReport>(`/trust-lens/${listingId}`),
  /** Public check results for buyers; null until an IMEI check has run. */
  publicSummary: (listingId: string) =>
    api.public
      .get<{ check: TrustLensCheckSummary | null } | null>(`/trust-lens/${listingId}/summary`)
      .then((res) => res?.check ?? null),
  submit: (data: Record<string, unknown>) => api.post<TrustLensReport>('/trust-lens', data),
  updateStatus: (listingId: string, data: Record<string, unknown>) =>
    api.patch<TrustLensReport>(`/trust-lens/${listingId}/status`, data),
};
export const trustLensService = trustService;

// ── Evidence ──────────────────────────────────────────────────────────────
export const evidenceService = {
  /** Public photos for a listing. The API returns the evidence pack; unwrap its items. */
  forListing: (listingId: string) =>
    api.public
      .get<{ items?: EvidenceItem[] } | EvidenceItem[]>(`/evidence/listing/${listingId}`)
      .then((res) => (Array.isArray(res) ? res : res?.items ?? [])),
  upload: (
    listingId: string,
    file: { uri: string; name: string; type: string },
    meta: { type: string; description?: string },
  ) => {
    const form = new FormData();
    // Expo's fetch only accepts real file objects, not React Native's { uri } parts.
    // File also reports the true type, so a PNG isn't mislabelled as a JPEG.
    form.append(
      'file',
      (Platform.OS === 'web' ? { uri: file.uri, name: file.name, type: file.type } : new File(file.uri)) as unknown as Blob,
    );
    form.append('listingId', listingId);
    form.append('type', meta.type);
    if (meta.description) form.append('description', meta.description);
    return api.form<EvidenceItem>('/evidence/upload', form);
  },
  remove: (itemId: string) => api.del<unknown>(`/evidence/items/${itemId}`),
};

// ── Transactions / orders ─────────────────────────────────────────────────
export interface CreateOrderInput {
  buyerId: string;
  sellerId: string;
  listingId: string;
  /** Display hint only — the server prices the order (listing, winning bid or accepted offer). */
  amount?: number;
  currency?: string;
  shippingService?: string;
  shippingAddress?: ShippingAddressDto;
  /** Pay at a seller-accepted offer price (validated server-side). */
  offerId?: string;
}

export const ordersService = {
  create: (input: CreateOrderInput) => api.post<CreateOrderResult>('/transactions/orders', input),
  confirmPayment: (orderId: string, paymentIntentId: string) =>
    api.post<Order>(`/transactions/orders/${orderId}/confirm-payment`, { paymentIntentId }),
  get: (orderId: string) => api.get<Order>(`/transactions/orders/${orderId}`),
  buyerOrders: (buyerId: string) =>
    api
      .get<ListResponse<Order>>(`/transactions/orders/buyer/${buyerId}`)
      .then(rows),
  sellerOrders: (sellerId: string) =>
    api
      .get<ListResponse<Order>>(`/transactions/orders/seller/${sellerId}`)
      .then(rows),
  rate: (orderId: string, data: { rating: number; comment?: string }) =>
    api.post<unknown>(`/transactions/orders/${orderId}/rate`, data),
  /** Null until the buyer has rated the order. */
  rating: (orderId: string) =>
    api.get<{ rating: number; comment?: string | null } | null>(`/transactions/orders/${orderId}/rating`),
  updateShipping: (orderId: string, data: Record<string, unknown>) =>
    api.patch<Order>(`/transactions/orders/${orderId}/shipping`, data),
  updateStatus: (orderId: string, data: Record<string, unknown>) =>
    api.patch<Order>(`/transactions/orders/${orderId}/status`, data),
  refund: (orderId: string) => api.post<Order>(`/transactions/orders/${orderId}/refund`, {}),
  getCollectionPoints: (postcode: string) =>
    api.public.get<{ locations: any[] }>(
      `/transactions/shipping/collection-points?postcode=${encodeURIComponent(postcode)}`,
    ),
  getDropoffLocations: (orderId: string, postcode?: string) =>
    api.get<{ locations: any[] }>(
      `/transactions/orders/${orderId}/dropoff-locations${postcode ? `?postcode=${encodeURIComponent(postcode)}` : ''}`,
    ),
  /** Downloads the label with the seller's login and returns the local file. */
  downloadShippingLabel: async (orderId: string) => {
    await refreshSession();
    const token = await getAccessToken();
    const res = await fetch(`${API_URL}/transactions/orders/${orderId}/shipping-label`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(res.status, friendlyApiError(body, 'We could not get your shipping label. Please try again.'), body);
    }
    const target = new File(Paths.cache, `royal-mail-label-${orderId.slice(0, 8)}.pdf`);
    if (target.exists) target.delete();
    target.write(new Uint8Array(await res.arrayBuffer()));
    return target;
  },
};

// ── Messaging ─────────────────────────────────────────────────────────────
export const messagesService = {
  send: (data: {
    recipientId: string;
    listingId?: string;
    subject?: string;
    content: string;
  }) => api.post<Message>('/notifications/messages', data),
  mine: (userId: string, pagination?: { page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (pagination?.page) params.set('page', String(pagination.page));
    if (pagination?.limit) params.set('limit', String(pagination.limit));
    const qs = params.toString();
    return api.get<Paginated<Message>>(
      `/notifications/messages/user/${userId}${qs ? `?${qs}` : ''}`,
    );
  },
  conversation: (userId: string, otherUserId: string, listingId?: string) => {
    // The server only returns conversations for the signed-in user and checks
    // that `userId` matches the token, so it must be sent explicitly.
    const params = new URLSearchParams({ userId, otherUserId });
    if (listingId) params.set('listingId', listingId);
    return api.get<Paginated<Message>>(
      `/notifications/messages/conversation?${params.toString()}`,
    );
  },
  forListing: (listingId: string) =>
    api.get<Paginated<Message>>(`/notifications/messages/listing/${listingId}`),
  markRead: (messageId: string) =>
    api.patch<Message>(`/notifications/messages/${messageId}/read`),
  unreadCount: (userId: string) =>
    api.get<{ count: number }>(`/notifications/messages/unread-count/${userId}`),
};

// ── Offers ────────────────────────────────────────────────────────────────
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'EXPIRED' | 'COMPLETED';

export interface Offer {
  id: string;
  listingId: string;
  amount: string | number;
  note: string | null;
  status: OfferStatus;
  expiresAt: string | null;
  createdAt: string;
  listing: { id: string; title: string; price: string | number; currency: string; status: string };
  buyer: { id: string; name: string };
  seller: { id: string; name: string };
}

export const offersService = {
  /** Binding price offer on a fixed-price listing; the seller accepts or declines. */
  make: (listingId: string, amount: number, note?: string) =>
    api.post<Offer>(`/offers/listing/${listingId}`, { amount, ...(note ? { note } : {}) }),
  mine: (role: 'buyer' | 'seller') => api.get<ListResponse<Offer>>(`/offers?role=${role}`).then(rows),
  respond: (offerId: string, action: 'ACCEPT' | 'DECLINE' | 'WITHDRAW') =>
    api.patch<Offer>(`/offers/${offerId}`, { action }),
};

// ── Notifications ────────────────────────────────────────────────────────
export const notificationsService = {
  list: () => api.get<ListResponse<Notification>>('/notifications').then(rows),
};

// ── Admin ─────────────────────────────────────────────────────────────────
export const adminService = {
  users: () => api.get<ListResponse<User>>('/auth/users?limit=100').then(rows),
  bootstrapAdmin: (data: { email: string; password: string; setupToken: string }) =>
    api.public.post<unknown>('/auth/admin/bootstrap', data),
};
