export enum EventPattern {
  // Auth events
  USER_REGISTERED = 'user.registered',
  USER_LOGIN = 'user.login',
  USER_VERIFIED = 'user.verified',

  // Listing events
  LISTING_SUBMITTED = 'listing.submitted',
  LISTING_APPROVED = 'listing.approved',
  LISTING_REJECTED = 'listing.rejected',
  LISTING_UPDATED = 'listing.updated',
  LISTING_DELETED = 'listing.deleted',

  // Trust Lens events
  TRUST_LENS_REVIEW_STARTED = 'trust_lens.review.started',
  TRUST_LENS_REVIEW_COMPLETED = 'trust_lens.review.completed',
  TRUST_LENS_REVIEW_FAILED = 'trust_lens.review.failed',

  // Evidence events
  EVIDENCE_UPLOADED = 'evidence.uploaded',
  EVIDENCE_PACK_COMPLETE = 'evidence.pack.complete',

  // Transaction events
  ORDER_CREATED = 'order.created',
  ORDER_PAYMENT_RECEIVED = 'order.payment.received',
  ORDER_ESCROW_HELD = 'order.escrow.held',
  ORDER_SHIPPED = 'order.shipped',
  ORDER_DELIVERED = 'order.delivered',
  ORDER_COMPLETED = 'order.completed',
  ORDER_DISPUTED = 'order.disputed',
  ORDER_REFUNDED = 'order.refunded',

  // Notification events
  NOTIFICATION_SEND = 'notification.send',
}

export interface BaseEvent {
  eventId: string;
  timestamp: string;
  source: string;
}

export interface UserRegisteredEvent extends BaseEvent {
  pattern: EventPattern.USER_REGISTERED;
  data: {
    userId: string;
    email: string;
    role: string;
  };
}

export interface ListingSubmittedEvent extends BaseEvent {
  pattern: EventPattern.LISTING_SUBMITTED;
  data: {
    listingId: string;
    sellerId: string;
    deviceType: string;
    imei?: string;
    serialNumber?: string;
  };
}

export interface ListingApprovedEvent extends BaseEvent {
  pattern: EventPattern.LISTING_APPROVED;
  data: {
    listingId: string;
    sellerId: string;
    conditionGrade: string;
    trustScore: number;
  };
}

export interface OrderCreatedEvent extends BaseEvent {
  pattern: EventPattern.ORDER_CREATED;
  data: {
    orderId: string;
    buyerId: string;
    sellerId: string;
    listingId: string;
    amount: number;
    currency: string;
  };
}

export interface NotificationSendEvent extends BaseEvent {
  pattern: EventPattern.NOTIFICATION_SEND;
  data: {
    userId: string;
    channel: 'email' | 'push' | 'sms';
    template: string;
    payload: Record<string, unknown>;
  };
}
