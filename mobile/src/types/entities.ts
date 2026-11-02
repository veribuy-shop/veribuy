export type Role = 'ADMIN' | 'SELLER' | 'BUYER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isEmailVerified?: boolean;
  referralCode?: string;
  referralBonusBalance?: number;
  referredById?: string;
}

export type ReferralStatus = 'PENDING' | 'QUALIFIED' | 'PAID';

export interface Referral {
  id: string;
  referrerId: string;
  referredUserId: string;
  status: ReferralStatus;
  bonusAmount: number;
  createdAt: string;
  qualifiedAt?: string;
  paidAt?: string;
  referredUser?: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
  };
}

export interface ReferralSummary {
  referralCode: string;
  referralBonusBalance: number;
  referrals: Referral[];
  totalEarned: number;
  pendingCount: number;
  qualifiedCount: number;
  paidCount: number;
}

export interface UserProfile {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  /** The API nests the saved address; the flat fields above are legacy. */
  address?: {
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
  bio?: string;
  avatarUrl?: string;
  trustScore?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ListingStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'AUCTION_ENDED'
  | 'SOLD'
  | 'DELISTED';

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
  conditionGrade?: string;
  status: ListingStatus;
  images?: string[];
  /** Cover photo resolved by the API from the listing's evidence pack. */
  imageUrl?: string | null;
  trustLensStatus?: string;
  freeShipping?: boolean;
  storageCapacity?: string;
  color?: string;
  imei?: string;
  batteryHealth?: number;
  originalPrice?: number;
  checksSummary?: string[];
  format?: 'FIXED_PRICE' | 'AUCTION';
  startingBid?: number | null;
  buyItNowPrice?: number | null;
  currentBid?: number | null;
  bidCount?: number;
  auctionEndsAt?: string | null;
  highestBidderId?: string | null;
  quantity?: number;
  isBulkListing?: boolean;
  createdAt: string;
  updatedAt: string;
  seller?: {
    id?: string;
    name?: string;
    displayName?: string;
    email?: string;
    joinedYear?: number;
    location?: string;
    city?: string;
    country?: string;
    trustScore?: number;
    sellerRating?: number | null;
  };
}

/** Public, sanitised IMEI check result (never includes the IMEI itself). */
export interface TrustLensCheckSummary {
  imeiValid: boolean | null;
  icloudLocked: boolean | null;
  reportedStolen: boolean | null;
  blacklisted: boolean | null;
  fmiOn: boolean | null;
  verifiedAt: string;
  deviceAttributes: Array<{ label: string; value: string }>;
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
  | 'PAYMENT_RECEIVED'
  | 'ESCROW_HELD'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface Order {
  id: string;
  orderNumber?: string;
  buyerId: string;
  sellerId: string;
  listingId?: string | null;
  listingTitle?: string | null;
  amount: number;
  currency: string;
  status: OrderStatus;
  protectionFee?: number | null;
  shippingFee?: number | null;
  shippingService?: string | null;
  shippingLabelUrl?: string | null;
  dropoffQrCodeUrl?: string | null;
  parcelWeightGrams?: number | null;
  parcelFormat?: string | null;
  freeShipping?: boolean;
  trackingNumber?: string | null;
  carrier?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  disputedAt?: string | null;
  totalAmount?: number | null;
  shippingAddress?: ShippingAddress;
  buyer?: { id?: string; displayName?: string; name?: string; email?: string; avatarUrl?: string | null } | null;
  seller?: { id?: string; displayName?: string; name?: string; email?: string; avatarUrl?: string | null } | null;
  listing?: {
    id?: string;
    title: string;
    brand?: string;
    model?: string;
    price?: number;
    currency?: string;
    condition?: string;
    imageUrl?: string | null;
    images?: string[];
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code?: string;
  postalCode?: string;
  country: string;
  deliveryMethod?: 'HOME' | 'CLICK_AND_COLLECT';
  collectionPoint?: {
    id?: string;
    name: string;
    address?: string;
    city?: string;
    postcode?: string;
    distance?: string;
    hours?: string;
  };
  collectionPin?: string;
  donation?: {
    amount: number;
    charity: string;
  };
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
  /** Automated order/offer/listing update rather than text a person wrote. */
  isSystem?: boolean;
  sender?: { id: string; name?: string | null } | null;
  recipient?: { id: string; name?: string | null } | null;
  listing?: { id: string; title: string } | null;
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
