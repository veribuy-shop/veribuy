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
    const authResult = requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const enrich = searchParams.get('enrich') !== 'false'; // Default to true for backward compatibility

    // Fetch ALL orders from transaction service by walking every page.
    // The backend caps limit at 100 (PaginationDto @Max(100)), so we request
    // 100 per page and collect until we have every record.
    const PAGE_SIZE = 100;
    let currentPage = 1;
    let totalPages = 1;
    const allRawOrders: RawOrder[] = [];

    do {
      const pageResponse = await fetch(
        `${TRANSACTION_SERVICE_URL}/transactions/orders?page=${currentPage}&limit=${PAGE_SIZE}`,
        { method: 'GET', headers: createAuthHeaders(authResult.token) }
      );

      if (!pageResponse.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch orders' },
          { status: pageResponse.status }
        );
      }

      const pageData = await pageResponse.json();
      const pageOrders: RawOrder[] = Array.isArray(pageData)
        ? pageData
        : (pageData.data || []);

      allRawOrders.push(...pageOrders);

      const pagination = pageData.pagination;
      if (pagination?.totalPages) {
        totalPages = pagination.totalPages;
      } else {
        // No pagination metadata — treat as single page
        break;
      }
      currentPage++;
    } while (currentPage <= totalPages);

    let orders: RawOrder[] = allRawOrders;

    // Filter by status if provided
    if (status && status !== 'ALL') {
      orders = orders.filter(order => order.status === status);
    }

    // Search filter (by order ID)
    if (search && search.trim() !== '') {
      const searchLower = search.toLowerCase();
      orders = orders.filter(order =>
        order.id.toLowerCase().includes(searchLower)
      );
    }

    // Sort by creation date (newest first)
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate statistics
    const stats = {
      totalOrders: orders.length,
      totalRevenue: orders
        .filter(o => ['COMPLETED', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED'].includes(o.status))
        .reduce((sum, o) => sum + (Number(o.amount) * 0.05), 0), // 5% commission
      byStatus: orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // Calculate pagination
    const total = orders.length;
    const pages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedOrders = orders.slice(offset, offset + limit);

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
