import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders, getTokenUserId, getTokenRole } from '@/lib/api-auth';
import { sanitizeOrderWithPayment } from '@/lib/sanitize';
import { getBackendUrl } from '@/lib/backend-url';
import { isUuid } from '@/lib/validate-id';
import { friendlyApiError } from '@/lib/api-errors';

const TRANSACTION_SERVICE_URL = getBackendUrl();

export async function POST(req: NextRequest) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    // Admins are for management only and cannot checkout or purchase items
    const role = await getTokenRole(authResult.token);
    if (role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Administrator accounts are restricted to platform management and cannot purchase listings. Please use a buyer account.' },
        { status: 403 },
      );
    }

    // Extract buyerId from the verified JWT — never trust client-supplied buyerId
    const buyerId = await getTokenUserId(authResult.token);
    if (!buyerId) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or expired token' },
        { status: 401 },
      );
    }

    const body = await req.json();

    // NOTE: `amount` and `shippingFee` are display hints only. The backend
    // derives the authoritative price from the listing and recomputes shipping
    // via the Royal Mail rate engine, rejecting the order if the client's
    // figure is stale. They are forwarded solely so the backend can detect and
    // surface a stale-price mismatch to the buyer.
    const {
      sellerId,
      listingId,
      amount,
      currency,
      shippingAddress,
      shippingFee,
      shippingService,
      deliveryMethod,
      collectionPoint,
      donationAmount,
      charityName,
      offerId,
    } = body;

    if (!sellerId || !listingId || !currency) {
      return NextResponse.json(
        { error: 'Missing required fields: sellerId, listingId, and currency are required' },
        { status: 400 }
      );
    }

    // Validate amount shape if supplied (value is authoritative server-side)
    if (amount !== undefined && amount !== null && (typeof amount !== 'number' || amount <= 0)) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Validate shippingFee if provided
    if (shippingFee !== undefined && shippingFee !== null) {
      if (typeof shippingFee !== 'number' || shippingFee < 0) {
        return NextResponse.json(
          { error: 'Shipping fee must be a non-negative number' },
          { status: 400 },
        );
      }
    }

    // Validate shippingService if provided
    if (shippingService && !['TRACKED_24', 'TRACKED_48', 'SPECIAL_DELIVERY_1PM'].includes(shippingService)) {
      return NextResponse.json(
        { error: 'Shipping service must be TRACKED_24, TRACKED_48 or SPECIAL_DELIVERY_1PM' },
        { status: 400 },
      );
    }

    // Validate shipping address if provided
    if (shippingAddress) {
      const requiredAddressFields = ['name', 'line1', 'city', 'state', 'postal_code', 'country'];
      const missingFields = requiredAddressFields.filter(field => !shippingAddress[field]);
      
      if (missingFields.length > 0) {
        return NextResponse.json(
          { error: 'Please complete your delivery address (name, address line 1, town, county, postcode and country).' },
          { status: 400 }
        );
      }

      // Validate country code is 2 characters
      if (shippingAddress.country.length !== 2) {
        return NextResponse.json(
          { error: 'Country must be a valid ISO 3166-1 alpha-2 code (e.g., US, GB, NG)' },
          { status: 400 }
        );
      }
    }

    // Forward request to transaction service with authorization
    const response = await fetch(`${TRANSACTION_SERVICE_URL}/transactions/orders`, {
      method: 'POST',
      headers: createAuthHeaders(authResult.token),
      body: JSON.stringify({
        buyerId,
        sellerId,
        listingId,
        amount: amount ?? undefined,
        currency,
        shippingAddress,
        shippingFee: shippingFee ?? undefined,
        shippingService: shippingService ?? undefined,
        deliveryMethod: deliveryMethod ?? undefined,
        collectionPoint: collectionPoint ?? undefined,
        donationAmount: donationAmount ?? undefined,
        charityName: charityName ?? undefined,
        // Validated server-side against an ACCEPTED offer for this buyer/listing.
        offerId: isUuid(offerId) ? offerId : undefined,
      }),
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      console.error('Transaction service error:', data || response.statusText);
      return NextResponse.json(
        { error: friendlyApiError(data, 'We could not start checkout for this item. Please try again.') },
        { status: response.status }
      );
    }

    // Validate response contains required fields
    if (!data?.clientSecret || !data?.paymentIntentId) {
      console.error('Invalid response from transaction service:', data);
      return NextResponse.json(
        { error: 'Invalid response from payment service. Please try again.' },
        { status: 500 }
      );
    }

    // Transaction service returns { order: {...}, clientSecret, paymentIntentId }
    // Flatten so sanitizeOrderWithPayment receives a single object with all fields
    const flat = {
      ...(data.order ?? data),
      clientSecret: data.clientSecret,
      paymentIntentId: data.paymentIntentId,
    };

    return NextResponse.json(sanitizeOrderWithPayment(flat));
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'We could not start checkout. Please try again.' },
      { status: 500 }
    );
  }
}
