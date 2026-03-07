import { IsEnum, IsString, IsOptional, MaxLength } from 'class-validator';

export enum OrderStatus {
  PENDING = 'PENDING',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  ESCROW_HELD = 'ESCROW_HELD',
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
