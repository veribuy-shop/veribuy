import { NextRequest, NextResponse } from 'next/server';
import { requireRole, createAuthHeaders } from '@/lib/api-auth';
import {
  sanitizeOrder,
  sanitizeOrderAnalytics,
  sanitizeListing,
  sanitizeAdminProfile,
} from '@/lib/sanitize';

const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3007';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';
const LISTING_SERVICE_URL = process.env.LISTING_SERVICE_URL || 'http://localhost:3003';

interface RawOrder {
  id: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  amount: number;
  currency: string;
  status: string;
  paymentIntentId: string | null;
  shippingAddressId: string | null;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  disputedAt: string | null;
  refundedAt: string | null;
}

export async function GET(request: NextRequest) {
  try {
    // Require ADMIN role
    const authResult = await requireRole(request, 'ADMIN'); // PERF-01: requireRole is async — must be awaited
    if ('error' in authResult) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const enrich = searchParams.get('enrich') !== 'false'; // Default to true for backward compatibility

    // PERF-01: Delegate filtering, sorting, and pagination to the backend instead of
    // fetching ALL orders and doing it in-process. This avoids O(n) memory allocation
    // and eliminates the do/while multi-page fetch loop.
    const backendParams = new URLSearchParams({
      page: String(page),
      limit: String(Math.min(limit, 100)), // Backend caps at 100
    });
    if (status && status !== 'ALL') backendParams.set('status', status);
    if (search && search.trim()) backendParams.set('search', search.trim());

    const pageResponse = await fetch(
      `${TRANSACTION_SERVICE_URL}/transactions/orders?${backendParams.toString()}`,
      { method: 'GET', headers: createAuthHeaders(authResult.token) }
    );

    if (!pageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: pageResponse.status }
      );
    }

    const pageData = await pageResponse.json();
    const paginatedOrders: RawOrder[] = Array.isArray(pageData)
      ? pageData
      : (pageData.data || []);

    const pagination = pageData.pagination;
    const total: number = pagination?.total ?? paginatedOrders.length;
    const pages: number = pagination?.totalPages ?? Math.ceil(total / limit);

    // Calculate lightweight statistics from the current page only.
    // Full analytics (all-orders stats) should be a dedicated analytics endpoint.
    const stats = {
      totalOrders: total,
      totalRevenue: paginatedOrders
        .filter((o: RawOrder) => ['COMPLETED', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED'].includes(o.status))
        .reduce((sum: number, o: RawOrder) => sum + (Number(o.amount) * 0.05), 0), // 5% commission estimate
      byStatus: paginatedOrders.reduce((acc: Record<string, number>, order: RawOrder) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // If enrich=false (for analytics), return lightweight sanitized data with sellerId/buyerId
    if (!enrich) {
      return NextResponse.json({
        orders: paginatedOrders.map(sanitizeOrderAnalytics),
        total,
        page,
        pages,
        limit,
        stats,
      });
    }

    // Fetch buyer, seller, and listing details for each order (with auth headers)
    const enrichedOrders = await Promise.all(
      paginatedOrders.map(async (order) => {
        let buyer = null;
        let seller = null;
        let listing = null;

        try {
          const buyerResponse = await fetch(
            `${USER_SERVICE_URL}/users/${order.buyerId}/profile`,
            { method: 'GET', headers: createAuthHeaders(authResult.token) }
          );
          if (buyerResponse.ok) {
            buyer = sanitizeAdminProfile(await buyerResponse.json());
          }
        } catch {
          // non-fatal — buyer profile unavailable
        }

        try {
          const sellerResponse = await fetch(
            `${USER_SERVICE_URL}/users/${order.sellerId}/profile`,
            { method: 'GET', headers: createAuthHeaders(authResult.token) }
          );
          if (sellerResponse.ok) {
            seller = sanitizeAdminProfile(await sellerResponse.json());
          }
        } catch {
          // non-fatal — seller profile unavailable
        }

        try {
          const listingResponse = await fetch(
            `${LISTING_SERVICE_URL}/listings/${order.listingId}`,
            { method: 'GET', headers: createAuthHeaders(authResult.token) }
          );
          if (listingResponse.ok) {
            listing = sanitizeListing(await listingResponse.json());
          }
        } catch {
          // non-fatal — listing unavailable
        }

        return {
          ...sanitizeOrder(order),
          buyer,
          seller,
          listing,
        };
      })
    );

    return NextResponse.json({
      orders: enrichedOrders,
      total,
      page,
      pages,
      limit,
      stats,
    });
  } catch (error) {
    console.error('[Admin Orders API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
