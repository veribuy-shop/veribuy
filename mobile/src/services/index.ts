import { api } from '../lib/api';
import { Paginated, ShippingAddressDto } from '../types/api';
import {
  CreateOrderResult,
  EvidenceItem,
  Listing,
  Message,
  Notification,
  Order,
  TrustLensReport,
  User,
  UserProfile,
} from '../types/entities';

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

export const listingsService = {
  list: (query: ListingsQuery = {}) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    return api.get<Paginated<Listing>>(`/listings${qs ? `?${qs}` : ''}`);
  },
  bySeller: (sellerId: string) => api.get<Listing[]>(`/listings/seller/${sellerId}`),
  get: (id: string) => api.get<Listing>(`/listings/${id}`),
  create: (data: Record<string, unknown>) => api.post<Listing>('/listings', data),
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
  getProfile: (userId: string) => api.get<UserProfile>(`/users/${userId}/profile`),
  createProfile: (userId: string, data: Record<string, unknown>) =>
    api.post<UserProfile>(`/users/${userId}/profile`, data),
  updateProfile: (userId: string, data: Record<string, unknown>) =>
    api.put<UserProfile>(`/users/${userId}/profile`, data),
};

// ── Trust Lens ────────────────────────────────────────────────────────────
export const trustService = {
  getForListing: (listingId: string) => api.get<TrustLensReport>(`/trust-lens/${listingId}`),
  submit: (data: Record<string, unknown>) => api.post<TrustLensReport>('/trust-lens', data),
  updateStatus: (listingId: string, data: Record<string, unknown>) =>
    api.patch<TrustLensReport>(`/trust-lens/${listingId}/status`, data),
};

// ── Evidence ──────────────────────────────────────────────────────────────
export const evidenceService = {
  forListing: (listingId: string) => api.get<EvidenceItem[]>(`/evidence/listing/${listingId}`),
  upload: (
    listingId: string,
    file: { uri: string; name: string; type: string },
    meta: { type: string; description?: string },
  ) => {
    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
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
  amount: number;
  shippingAddress: ShippingAddressDto;
}

export const ordersService = {
  create: (input: CreateOrderInput) => api.post<CreateOrderResult>('/transactions/orders', input),
  confirmPayment: (orderId: string) =>
    api.post<Order>(`/transactions/orders/${orderId}/confirm-payment`),
  get: (orderId: string) => api.get<Order>(`/transactions/orders/${orderId}`),
  buyerOrders: (buyerId: string) => api.get<Order[]>(`/transactions/orders/buyer/${buyerId}`),
  sellerOrders: (sellerId: string) => api.get<Order[]>(`/transactions/orders/seller/${sellerId}`),
  rate: (orderId: string, data: Record<string, unknown>) =>
    api.post<Order>(`/transactions/orders/${orderId}/rate`, data),
  updateShipping: (orderId: string, data: Record<string, unknown>) =>
    api.patch<Order>(`/transactions/orders/${orderId}/shipping`, data),
  updateStatus: (orderId: string, data: Record<string, unknown>) =>
    api.patch<Order>(`/transactions/orders/${orderId}/status`, data),
  refund: (orderId: string) => api.post<Order>(`/transactions/orders/${orderId}/refund`, {}),
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
  conversation: (otherUserId: string, listingId?: string) => {
    const params = new URLSearchParams({ otherUserId });
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

// ── Notifications ────────────────────────────────────────────────────────
export const notificationsService = {
  list: () => api.get<Notification[]>('/notifications'),
};

// ── Admin ─────────────────────────────────────────────────────────────────
export const adminService = {
  users: () => api.get<User[]>('/auth/users'),
  bootstrapAdmin: (data: { email: string; password: string; setupToken: string }) =>
    api.public.post<unknown>('/auth/admin/bootstrap', data),
};
