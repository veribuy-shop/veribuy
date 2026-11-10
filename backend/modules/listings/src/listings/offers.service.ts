import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../src/database/prisma.service';
import { PUBLIC_USER_SELECT, toPublicUser } from '../../../../src/common/public-name';
import { Prisma } from '.prisma/veribuy-client';
import { CreateOfferDto, RespondToOfferDto } from './dto/offer.dto';
import { offerPaymentWindowHours } from '../../../../src/config/marketplace.config';

/** Lowest acceptable offer as a fraction of the asking price. */
const MIN_OFFER_RATIO = 0.4;

const OFFER_SELECT = {
  id: true,
  listingId: true,
  buyerId: true,
  sellerId: true,
  amount: true,
  note: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  listing: { select: { id: true, title: true, price: true, currency: true, status: true } },
  buyer: { select: PUBLIC_USER_SELECT },
  seller: { select: PUBLIC_USER_SELECT },
} as const;

type OfferRow = Prisma.OfferGetPayload<{ select: typeof OFFER_SELECT }>;

/** Buyer and seller see each other's public name, not their real one. */
function toPublicOffer<T extends OfferRow | null>(offer: T) {
  return offer && { ...offer, buyer: toPublicUser(offer.buyer), seller: toPublicUser(offer.seller) };
}

/**
 * Price offers on fixed-price listings.
 *
 * SECURITY: the offer amount only ever becomes a charge through
 * TransactionsService.createOrder, which re-validates the ACCEPTED offer
 * (buyer, listing, expiry) server-side. Clients never supply a price.
 */
@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createOffer(listingId: string, buyerId: string, dto: CreateOfferDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, sellerId: true, price: true, status: true, format: true, trustLensStatus: true, title: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId === buyerId) throw new BadRequestException('You cannot make an offer on your own listing');
    if (listing.format !== 'FIXED_PRICE' || listing.status !== 'ACTIVE' || listing.trustLensStatus !== 'PASSED') {
      throw new BadRequestException('Offers can only be made on live fixed-price listings');
    }

    const asking = Number(listing.price);
    const amount = Math.round(dto.amount * 100) / 100;
    if (amount >= asking) {
      throw new BadRequestException('Your offer is at or above the asking price — you can buy it now instead');
    }
    if (amount < asking * MIN_OFFER_RATIO) {
      throw new BadRequestException(`Offers must be at least ${MIN_OFFER_RATIO * 100}% of the asking price`);
    }

    // One open offer per buyer per listing: a new offer replaces the old one.
    await this.prisma.offer.updateMany({
      where: { listingId, buyerId, status: 'PENDING' },
      data: { status: 'WITHDRAWN' },
    });

    const offer = await this.prisma.offer.create({
      data: {
        listingId,
        buyerId,
        sellerId: listing.sellerId,
        amount,
        note: dto.note?.trim() || null,
      },
      select: OFFER_SELECT,
    });

    await this.notify(buyerId, listing.sellerId, listingId,
      `New offer: £${amount.toFixed(2)} for ${listing.title}`,
      `You received an offer of £${amount.toFixed(2)} (asking £${asking.toFixed(2)}).` +
        (offer.note ? `\n\nBuyer note: "${offer.note}"` : '') +
        `\n\nAccept or decline it from your Offers page.`);

    return toPublicOffer(offer);
  }

  async listForUser(userId: string, role: 'buyer' | 'seller') {
    await this.expireStaleOffers();
    const offers = await this.prisma.offer.findMany({
      where: role === 'buyer' ? { buyerId: userId } : { sellerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: OFFER_SELECT,
    });
    return offers.map(toPublicOffer);
  }

  async respond(offerId: string, userId: string, dto: RespondToOfferDto) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true, listingId: true, buyerId: true, sellerId: true, amount: true, status: true,
        listing: { select: { title: true, status: true } } },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    const isSeller = offer.sellerId === userId;
    const isBuyer = offer.buyerId === userId;
    if (dto.action === 'WITHDRAW' ? !isBuyer : !isSeller) {
      throw new ForbiddenException('You cannot perform this action on this offer');
    }
    if (offer.status !== 'PENDING') {
      throw new ConflictException(`This offer is already ${offer.status.toLowerCase()}`);
    }
    if (dto.action === 'ACCEPT' && offer.listing.status !== 'ACTIVE') {
      throw new BadRequestException('This listing is no longer available');
    }

    const nextStatus = dto.action === 'ACCEPT' ? 'ACCEPTED' : dto.action === 'DECLINE' ? 'DECLINED' : 'WITHDRAWN';
    const { count } = await this.prisma.offer.updateMany({
      where: { id: offerId, status: 'PENDING' },
      data: {
        status: nextStatus,
        ...(nextStatus === 'ACCEPTED' ? { expiresAt: new Date(Date.now() + offerPaymentWindowHours() * 60 * 60 * 1000) } : {}),
      },
    });
    if (count !== 1) throw new ConflictException('This offer was updated by someone else — please refresh');

    const amount = Number(offer.amount).toFixed(2);
    if (nextStatus === 'ACCEPTED') {
      await this.notify(offer.sellerId, offer.buyerId, offer.listingId,
        `Offer accepted: £${amount} for ${offer.listing.title}`,
        `Good news — the seller accepted your offer of £${amount}. Complete checkout within ${offerPaymentWindowHours()} hours from your Offers page.`);
    } else if (nextStatus === 'DECLINED') {
      await this.notify(offer.sellerId, offer.buyerId, offer.listingId,
        `Offer declined for ${offer.listing.title}`,
        `The seller declined your offer of £${amount}. You can make a new offer or buy at the asking price.`);
    }

    return toPublicOffer(await this.prisma.offer.findUnique({ where: { id: offerId }, select: OFFER_SELECT }));
  }

  /** Accepted offers that were not paid in time lapse back to the asking price. */
  private async expireStaleOffers() {
    await this.prisma.offer.updateMany({
      where: { status: 'ACCEPTED', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
  }

  private async notify(senderId: string, recipientId: string, listingId: string, subject: string, content: string) {
    await this.prisma.message
      .create({ data: { senderId, recipientId, listingId, subject, content, isSystem: true } })
      .catch((err) => this.logger.warn(`Failed to record offer message: ${(err as Error).message}`));
  }
}
