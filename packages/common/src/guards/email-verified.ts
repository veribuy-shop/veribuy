import { ForbiddenException } from '@nestjs/common';

/**
 * Blocks value-creating actions (listing, bidding, buying, messaging) for
 * accounts that have not yet verified their email address. `isEmailVerified`
 * is populated from server-side state by the JWT strategy.
 */
export function assertEmailVerified(user: { isEmailVerified?: boolean } | undefined): void {
  if (!user || user.isEmailVerified !== true) {
    throw new ForbiddenException('Please verify your email address before continuing');
  }
}
