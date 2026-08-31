export type Role = 'ADMIN' | 'SELLER' | 'BUYER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isEmailVerified?: boolean;
}

export interface UserProfile {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  city?: string;
  bio?: string;
  avatarUrl?: string;
  trustScore?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ListingStatus = 'DRAFT' | 'ACTIVE' | 'PENDING' | 'SOLD' | 'REMOVED';

export interface Listing {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  brand: string;
  model: string;
  deviceType: string;
  price: number;
  currency: string;
  condition: string;
  status: ListingStatus;
  images?: string[];
  trustLensStatus?: string;
  createdAt: string;
  updatedAt: string;
  seller?: { id: string; name: string; email: string; trustScore?: number };
}

export interface TrustLensReport {
  id: string;
  listingId: string;
  status: string;
  score?: number;
  summary?: string;
  checks?: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface Order {
  id: string;
  orderNumber?: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  shippingAddress?: ShippingAddress;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface CreateOrderResult {
  order: Order;
  clientSecret: string;
  paymentIntentId: string;
}

export interface EvidenceItem {
  id: string;
  listingId: string;
  type: string;
  description?: string;
  url: string;
  metadata?: unknown;
  createdAt: string;
}

export interface Conversation {
  id: string;
  listingId?: string;
  buyerId: string;
  sellerId: string;
  unreadCount?: number;
  lastMessageAt?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  listingId?: string;
  subject?: string;
  content: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title?: string;
  body?: string;
  readAt?: string;
  data?: unknown;
  createdAt: string;
}
