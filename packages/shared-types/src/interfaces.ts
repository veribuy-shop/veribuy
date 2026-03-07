import {
  UserRole,
  VerificationStatus,
  ConditionGrade,
  ListingStatus,
  TrustLensStatus,
  DeviceType,
  OrderStatus,
  EvidenceType,
  IntegrityFlag,
} from './enums';

export interface IUser {
  id: string;
  email: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProfile {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  sellerRating?: number;
  totalSales: number;
  totalPurchases: number;
  verificationStatus: VerificationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IListing {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  deviceType: DeviceType;
  brand: string;
  model: string;
  price: number;
  currency: string;
  conditionGrade?: ConditionGrade;
  status: ListingStatus;
  imei?: string;
  serialNumber?: string;
  integrityFlags: IntegrityFlag[];
  trustLensStatus: TrustLensStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITrustLensReview {
  id: string;
  listingId: string;
  sellerId: string;
  status: TrustLensStatus;
  evidenceRequirements: IEvidenceRequirement[];
  identifierValidation: IIdentifierValidation;
  conditionGrade?: ConditionGrade;
  integrityFlags: IntegrityFlag[];
  reviewNotes?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEvidenceRequirement {
  type: EvidenceType;
  description: string;
  required: boolean;
  fulfilled: boolean;
}

export interface IIdentifierValidation {
  imeiProvided: boolean;
  imeiValid?: boolean;
  serialProvided: boolean;
  serialValid?: boolean;
  icloudLocked?: boolean;
  reportedStolen?: boolean;
  blacklisted?: boolean;
}

export interface IDeviceVerificationResult {
  verificationId: string;
  imei?: string;
  serialNumber?: string;
  imeiValid: boolean;
  icloudLocked: boolean;
  reportedStolen: boolean;
  blacklisted: boolean;
  carrier?: string;
  deviceModel?: string;
  verifiedAt: Date;
}

export interface IEvidencePack {
  id: string;
  listingId: string;
  sellerId: string;
  items: IEvidenceItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IEvidenceItem {
  id: string;
  packId: string;
  type: EvidenceType;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface IOrder {
  id: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  escrowId?: string;
  shippingAddress?: IAddress;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface IPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface IHealthCheck {
  status: 'ok' | 'error';
  service: string;
  timestamp: string;
  uptime: number;
  version: string;
}
