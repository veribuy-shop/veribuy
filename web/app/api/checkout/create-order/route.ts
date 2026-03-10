import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, createAuthHeaders, getTokenUserId } from '@/lib/api-auth';
import { sanitizeOrderWithPayment } from '@/lib/sanitize';

const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3007';

export async function POST(req: NextRequest) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
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

    // Validate required fields (buyerId now comes from JWT, not body)
    const { sellerId, listingId, amount, currency, shippingAddress } = body;

    if (!sellerId || !listingId || !amount || !currency) {
      return NextResponse.json(
        { error: 'Missing required fields: sellerId, listingId, amount, and currency are required' },
        { status: 400 }
      );
    }

    // Validate amount is a positive number
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Validate shipping address if provided
    if (shippingAddress) {
      const requiredAddressFields = ['name', 'line1', 'city', 'state', 'postal_code', 'country'];
      const missingFields = requiredAddressFields.filter(field => !shippingAddress[field]);
      
      if (missingFields.length > 0) {
        return NextResponse.json(
          { error: `Missing required address fields: ${missingFields.join(', ')}` },
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
        amount,
        currency,
        shippingAddress,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Transaction service error:', data);
      return NextResponse.json(
        { error: data.message || data.error || 'Failed to create order' },
        { status: response.status }
      );
    }

    // Validate response contains required fields
    if (!data.clientSecret || !data.paymentIntentId) {
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
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
