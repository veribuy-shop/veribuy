import { Injectable } from '@nestjs/common';
import { ListingStatus, OrderStatus, Prisma, ReviewStatus, TrustLensStatus } from '.prisma/veribuy-client';
import { checkoutHoldMinutes, postingOverdueDays } from '../../../../src/config/marketplace.config';
import { PrismaService } from '../../../../src/database/prisma.service';

const MAX_PAGE_SIZE = 100;

/** Listings that are finished with, so they no longer need a reviewer. */
const CLOSED_LISTING_STATUSES: ListingStatus[] = [
  ListingStatus.SOLD,
  ListingStatus.DELISTED,
  ListingStatus.REJECTED,
];

const OPEN_REVIEW_STATUSES: ReviewStatus[] = [ReviewStatus.PENDING, ReviewStatus.IN_PROGRESS, ReviewStatus.REQUIRES_REVIEW];

/** What a reviewer has to act on: one row per listing, whatever brought it here. */
const REVIEW_QUEUE_WHERE: Prisma.ListingWhereInput = {
  status: { notIn: CLOSED_LISTING_STATUSES },
  OR: [
    { status: { in: [ListingStatus.SUBMITTED, ListingStatus.UNDER_REVIEW] } },
    { trustLensStatus: TrustLensStatus.REQUIRES_REVIEW },
    { verificationRequest: { status: { in: OPEN_REVIEW_STATUSES } } },
  ],
};

const LISTING_VIEWS: Record<string, Prisma.ListingWhereInput> = {
  all: {},
  live: { status: ListingStatus.ACTIVE },
  review: REVIEW_QUEUE_WHERE,
  drafts: { status: ListingStatus.DRAFT },
  reserved: { status: { in: [ListingStatus.INACTIVE, ListingStatus.AUCTION_ENDED] } },
  sold: { status: ListingStatus.SOLD },
  removed: { status: { in: [ListingStatus.DELISTED, ListingStatus.REJECTED] } },
};

const ORDER_VIEWS: Record<string, OrderStatus[] | null> = {
  all: null,
  escrow: [OrderStatus.PAYMENT_RECEIVED, OrderStatus.ESCROW_HELD],
  transit: [OrderStatus.SHIPPED, OrderStatus.DELIVERED],
  disputed: [OrderStatus.DISPUTED],
  completed: [OrderStatus.COMPLETED],
  refunded: [OrderStatus.REFUNDED],
  unpaid: [OrderStatus.PENDING],
  cancelled: [OrderStatus.CANCELLED],
};

const HELD_STATUSES: OrderStatus[] = [
  OrderStatus.PAYMENT_RECEIVED,
  OrderStatus.ESCROW_HELD,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.DISPUTED,
];

const LISTING_ROW_SELECT = {
  id: true,
  title: true,
  brand: true,
  model: true,
  deviceType: true,
  price: true,
  currency: true,
  status: true,
  format: true,
  conditionGrade: true,
  trustLensStatus: true,
  integrityFlags: true,
  sellerId: true,
  imei: true,
  serialNumber: true,
  createdAt: true,
  seller: { select: { name: true, email: true } },
  verificationRequest: { select: { status: true } },
  evidencePack: {
    select: { items: { select: { url: true }, take: 1, orderBy: { createdAt: 'asc' as const } }, _count: { select: { items: true } } },
  },
} satisfies Prisma.ListingSelect;

type ListingRow = Prisma.ListingGetPayload<{ select: typeof LISTING_ROW_SELECT }>;
type ListingIdentity = Pick<ListingRow, 'id' | 'sellerId' | 'title' | 'imei' | 'serialNumber'>;

/** The ways two listings can be the same device. Sellers may list several similar items, so titles only match per seller. */
function duplicateKeys(listing: ListingIdentity): string[] {
  const keys: string[] = [];
  const imei = listing.imei?.replace(/\D/g, '');
  if (imei && imei.length >= 8) keys.push(`imei:${imei}`);
  const serial = listing.serialNumber?.trim().toUpperCase();
  if (serial) keys.push(`serial:${serial}`);
  // Only a fallback: two listings with different identifiers are different devices.
  if (keys.length === 0) {
    keys.push(`title:${listing.sellerId}:${listing.title.trim().toLowerCase().replace(/\s+/g, ' ')}`);
  }
  return keys;
}

/** Groups listing ids that look like the same device. Exported for testing. */
export function findDuplicateGroups(listings: ListingIdentity[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const listing of listings) {
    for (const key of duplicateKeys(listing)) {
      groups.set(key, [...(groups.get(key) ?? []), listing.id]);
    }
  }
  return [...groups.values()].filter((ids) => ids.length > 1);
}

function pageOf(page?: string, limit?: string) {
  const size = Math.min(Math.max(Number(limit) || 25, 1), MAX_PAGE_SIZE);
  const current = Math.max(Number(page) || 1, 1);
  return { take: size, skip: (current - 1) * size, page: current, limit: size };
}

/** Only the end of an identifier is needed to compare listings at a glance. */
function maskIdentifier(value: string | null): string | null {
  return value ? `…${value.slice(-4)}` : null;
}

function toListingRow(listing: ListingRow, duplicateIds: Set<string>) {
  const { imei, serialNumber, evidencePack, seller, verificationRequest, ...rest } = listing;
  return {
    ...rest,
    price: Number(listing.price),
    imeiEnding: maskIdentifier(imei),
    serialEnding: maskIdentifier(serialNumber),
    sellerName: seller?.name ?? 'Unknown seller',
    sellerEmail: seller?.email ?? null,
    reviewStatus: verificationRequest?.status ?? null,
    imageUrl: evidencePack?.items[0]?.url ?? null,
    photoCount: evidencePack?._count.items ?? 0,
    possibleDuplicate: duplicateIds.has(listing.id),
  };
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Open listings only: a sold or removed copy doesn't need anyone's attention. */
  private async duplicateGroups(): Promise<string[][]> {
    const open = await this.prisma.listing.findMany({
      where: { status: { notIn: CLOSED_LISTING_STATUSES } },
      select: { id: true, sellerId: true, title: true, imei: true, serialNumber: true },
    });
    return findDuplicateGroups(open);
  }

  private overdueCutoff(): Date {
    return new Date(Date.now() - postingOverdueDays() * 24 * 60 * 60 * 1000);
  }

  async getSummary() {
    const [reviewWaiting, oldestReview, disputes, overdue, heldAmount, unpaid, groups] = await Promise.all([
      this.prisma.listing.count({ where: REVIEW_QUEUE_WHERE }),
      this.prisma.listing.findFirst({
        where: REVIEW_QUEUE_WHERE,
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.order.count({ where: { status: OrderStatus.DISPUTED } }),
      this.prisma.order.count({ where: { status: OrderStatus.ESCROW_HELD, paidAt: { lt: this.overdueCutoff() } } }),
      this.prisma.order.aggregate({ where: { status: { in: HELD_STATUSES } }, _sum: { totalAmount: true } }),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      this.duplicateGroups(),
    ]);

    return {
      reviewWaiting,
      oldestReviewAt: oldestReview?.createdAt ?? null,
      disputes,
      overduePosting: overdue,
      postingOverdueDays: postingOverdueDays(),
      heldAmount: Number(heldAmount._sum.totalAmount ?? 0),
      unpaidCheckouts: unpaid,
      checkoutHoldMinutes: checkoutHoldMinutes(),
      duplicateGroups: groups.length,
    };
  }

  async getReviewQueue(page?: string, limit?: string) {
    const paging = pageOf(page, limit);
    const [rows, total, groups] = await Promise.all([
      this.prisma.listing.findMany({
        where: REVIEW_QUEUE_WHERE,
        orderBy: { createdAt: 'asc' },
        take: paging.take,
        skip: paging.skip,
        select: LISTING_ROW_SELECT,
      }),
      this.prisma.listing.count({ where: REVIEW_QUEUE_WHERE }),
      this.duplicateGroups(),
    ]);
    const duplicateIds = new Set(groups.flat());
    return { data: rows.map((row) => toListingRow(row, duplicateIds)), total, page: paging.page, limit: paging.limit };
  }

  async getListings(query: { view?: string; search?: string; page?: string; limit?: string }) {
    const paging = pageOf(query.page, query.limit);
    const groups = await this.duplicateGroups();
    const duplicateIds = new Set(groups.flat());

    const filters: Prisma.ListingWhereInput[] = [
      query.view === 'duplicates' ? { id: { in: [...duplicateIds] } } : LISTING_VIEWS[query.view ?? 'all'] ?? {},
    ];
    const term = query.search?.trim();
    if (term) {
      filters.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { brand: { contains: term, mode: 'insensitive' } },
          { model: { contains: term, mode: 'insensitive' } },
          { imei: { contains: term } },
          { serialNumber: { contains: term, mode: 'insensitive' } },
          { seller: { email: { contains: term, mode: 'insensitive' } } },
          { seller: { name: { contains: term, mode: 'insensitive' } } },
          ...(/^[0-9a-f-]{8,36}$/i.test(term) ? [{ id: { startsWith: term.toLowerCase() } }] : []),
        ],
      });
    }
    const where: Prisma.ListingWhereInput = { AND: filters };

    const [rows, total, counts] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: paging.take,
        skip: paging.skip,
        select: LISTING_ROW_SELECT,
      }),
      this.prisma.listing.count({ where }),
      this.listingViewCounts(),
    ]);

    return {
      data: rows.map((row) => toListingRow(row, duplicateIds)),
      total,
      page: paging.page,
      limit: paging.limit,
      counts: { ...counts, duplicates: duplicateIds.size },
    };
  }

  private async listingViewCounts() {
    const entries = await Promise.all(
      Object.entries(LISTING_VIEWS).map(async ([view, where]) => [view, await this.prisma.listing.count({ where })] as const),
    );
    return Object.fromEntries(entries);
  }

  async getOrders(query: { view?: string; search?: string; page?: string; limit?: string }) {
    const paging = pageOf(query.page, query.limit);
    const filters: Prisma.OrderWhereInput[] = [];

    if (query.view === 'attention') {
      filters.push({
        OR: [
          { status: OrderStatus.DISPUTED },
          { status: OrderStatus.ESCROW_HELD, paidAt: { lt: this.overdueCutoff() } },
        ],
      });
    } else {
      const statuses = ORDER_VIEWS[query.view ?? 'all'];
      if (statuses) filters.push({ status: { in: statuses } });
    }

    const term = query.search?.trim();
    if (term) {
      filters.push({
        OR: [
          { listingTitle: { contains: term, mode: 'insensitive' } },
          { trackingNumber: { contains: term, mode: 'insensitive' } },
          { buyer: { email: { contains: term, mode: 'insensitive' } } },
          { buyer: { name: { contains: term, mode: 'insensitive' } } },
          { seller: { email: { contains: term, mode: 'insensitive' } } },
          { seller: { name: { contains: term, mode: 'insensitive' } } },
          ...(/^[0-9a-f-]{8,36}$/i.test(term) ? [{ id: { startsWith: term.toLowerCase() } }] : []),
        ],
      });
    }
    const where: Prisma.OrderWhereInput = { AND: filters };

    const [rows, total, byStatus, attention] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: paging.take,
        skip: paging.skip,
        select: {
          id: true,
          listingId: true,
          listingTitle: true,
          status: true,
          amount: true,
          totalAmount: true,
          currency: true,
          trackingNumber: true,
          paidAt: true,
          shippedAt: true,
          createdAt: true,
          buyer: { select: { name: true, email: true } },
          seller: { select: { name: true, email: true } },
        },
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.count({
        where: {
          OR: [
            { status: OrderStatus.DISPUTED },
            { status: OrderStatus.ESCROW_HELD, paidAt: { lt: this.overdueCutoff() } },
          ],
        },
      }),
    ]);

    const countFor = (statuses: OrderStatus[]) =>
      byStatus.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + row._count._all, 0);
    const counts: Record<string, number> = { attention };
    for (const [view, statuses] of Object.entries(ORDER_VIEWS)) {
      counts[view] = statuses ? countFor(statuses) : byStatus.reduce((sum, row) => sum + row._count._all, 0);
    }

    const overdueBefore = this.overdueCutoff().getTime();
    return {
      data: rows.map((order) => ({
        ...order,
        amount: Number(order.amount),
        totalAmount: Number(order.totalAmount ?? order.amount),
        buyerName: order.buyer?.name ?? 'Unknown buyer',
        buyerEmail: order.buyer?.email ?? null,
        sellerName: order.seller?.name ?? 'Unknown seller',
        sellerEmail: order.seller?.email ?? null,
        postingOverdue:
          order.status === OrderStatus.ESCROW_HELD && !!order.paidAt && order.paidAt.getTime() < overdueBefore,
        buyer: undefined,
        seller: undefined,
      })),
      total,
      page: paging.page,
      limit: paging.limit,
      counts,
    };
  }

  async getAuditLog(page?: string, limit?: string) {
    const paging = pageOf(page, limit);
    const [rows, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: paging.take,
        skip: paging.skip,
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          note: true,
          createdAt: true,
          admin: { select: { name: true, email: true } },
        },
      }),
      this.prisma.adminAuditLog.count(),
    ]);
    return { data: rows, total, page: paging.page, limit: paging.limit };
  }
}
