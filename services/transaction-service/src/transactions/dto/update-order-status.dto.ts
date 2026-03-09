import { IsEnum, IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * Statuses that external actors (buyers, sellers, admins) may request via the
 * public PATCH /transactions/orders/:id/status endpoint.
 *
 * PAYMENT_RECEIVED and ESCROW_HELD are intentionally excluded — they are set
 * exclusively by the confirmPayment flow and must never be reachable via this
 * DTO, even by admins, to prevent bypassing the Stripe payment verification.
 */
export enum OrderStatus {
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  DISPUTED = 'DISPUTED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  trackingNumber?: string;
}
