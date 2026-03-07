import { IsEnum } from 'class-validator';
import { ListingStatus } from '.prisma/listing-client';

// Allowed status transitions (state machine)
export const ALLOWED_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  [ListingStatus.DRAFT]: [ListingStatus.SUBMITTED, ListingStatus.DELISTED],
  [ListingStatus.SUBMITTED]: [ListingStatus.UNDER_REVIEW, ListingStatus.REJECTED, ListingStatus.DELISTED],
  [ListingStatus.UNDER_REVIEW]: [ListingStatus.APPROVED, ListingStatus.REJECTED],
  [ListingStatus.APPROVED]: [ListingStatus.ACTIVE, ListingStatus.REJECTED],
  [ListingStatus.REJECTED]: [ListingStatus.SUBMITTED, ListingStatus.DELISTED],
  [ListingStatus.ACTIVE]: [ListingStatus.SOLD, ListingStatus.DELISTED, ListingStatus.UNDER_REVIEW],
  [ListingStatus.SOLD]: [],  // Terminal — no transitions
  [ListingStatus.DELISTED]: [],  // Terminal — no transitions
};

export class UpdateStatusDto {
  @IsEnum(ListingStatus, {
    message: `status must be one of: ${Object.values(ListingStatus).join(', ')}`,
  })
  status: ListingStatus;
}
