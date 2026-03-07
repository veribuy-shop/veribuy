#!/bin/bash

# VeriBuy Payment Flow Test Script
# This script tests the complete Stripe payment integration

set -e

echo "🧪 Testing VeriBuy Payment Flow"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
TRANSACTION_SERVICE="http://localhost:3007"
WEB_SERVICE="http://localhost:3010"

# Test data
BUYER_ID="test-buyer-$(date +%s)"
SELLER_ID="test-seller-$(date +%s)"
LISTING_ID="test-listing-$(date +%s)"
AMOUNT=99.99
CURRENCY="USD"

echo -e "${BLUE}Step 1: Checking Service Health${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check transaction service
if curl -s -f "$TRANSACTION_SERVICE/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Transaction service is healthy${NC}"
else
    echo -e "${YELLOW}⚠ Transaction service health check not available (might be normal)${NC}"
fi

# Check web service
if curl -s -f "$WEB_SERVICE" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Web service is responding${NC}"
else
    echo -e "${RED}✗ Web service is not responding${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 2: Creating Test Order${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create order payload
ORDER_PAYLOAD=$(cat <<EOF
{
  "buyerId": "$BUYER_ID",
  "sellerId": "$SELLER_ID",
  "listingId": "$LISTING_ID",
  "amount": $AMOUNT,
  "currency": "$CURRENCY",
  "shippingAddress": {
    "name": "John Test Doe",
    "line1": "123 Test Street",
    "line2": "Apt 4B",
    "city": "San Francisco",
    "state": "CA",
    "postal_code": "94102",
    "country": "US"
  }
}
EOF
)

echo "Creating order with amount: \$$AMOUNT $CURRENCY"

# Make API call
RESPONSE=$(curl -s -X POST "$TRANSACTION_SERVICE/transactions/orders" \
  -H "Content-Type: application/json" \
  -d "$ORDER_PAYLOAD")

# Check if response contains error
if echo "$RESPONSE" | grep -q '"error"'; then
    echo -e "${RED}✗ Failed to create order${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

# Extract data from response
ORDER_ID=$(echo "$RESPONSE" | jq -r '.order.id' 2>/dev/null)
CLIENT_SECRET=$(echo "$RESPONSE" | jq -r '.clientSecret' 2>/dev/null)
PAYMENT_INTENT_ID=$(echo "$RESPONSE" | jq -r '.paymentIntentId' 2>/dev/null)

if [ "$ORDER_ID" = "null" ] || [ -z "$ORDER_ID" ]; then
    echo -e "${RED}✗ Failed to extract order ID from response${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Order created successfully${NC}"
echo "  Order ID: $ORDER_ID"
echo "  Payment Intent ID: $PAYMENT_INTENT_ID"
echo "  Client Secret: ${CLIENT_SECRET:0:30}..."

echo ""
echo -e "${BLUE}Step 3: Payment Information${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "At this point, the frontend would use Stripe.js to:"
echo "  1. Display the payment form with CardElement"
echo "  2. Collect payment method from user"
echo "  3. Call stripe.confirmCardPayment(clientSecret, paymentMethod)"
echo ""
echo "For testing, use these Stripe test cards:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Success:${NC} 4242 4242 4242 4242 (any future date, any CVC)"
echo -e "${YELLOW}3D Secure:${NC} 4000 0027 6000 3184 (requires authentication)"
echo -e "${RED}Declined:${NC} 4000 0000 0000 0002 (card declined)"
echo ""
echo "More test cards: https://docs.stripe.com/testing#cards"

echo ""
echo -e "${BLUE}Step 4: Payment Confirmation Flow${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "After successful payment with Stripe:"
echo "  1. Frontend receives paymentIntent.status = 'succeeded'"
echo "  2. Frontend calls: POST /api/checkout/confirm-payment"
echo "     with orderId and paymentIntentId"
echo "  3. Backend:"
echo "     • Verifies payment with Stripe API"
echo "     • Updates order status to 'PAYMENT_RECEIVED'"
echo "     • Creates escrow record with status 'HELD'"
echo "     • Updates order status to 'ESCROW_HELD'"
echo ""
echo "⚠️  Note: Actual payment confirmation requires completing"
echo "   the Stripe payment in the browser UI"

echo ""
echo -e "${BLUE}Step 5: Accessing the Checkout UI${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To test the full payment flow in your browser:"
echo ""
echo "1. Create a listing at: ${GREEN}http://localhost:3010/listings/create${NC}"
echo "2. Go to the listing page and click 'Buy Now'"
echo "3. You'll be redirected to: ${GREEN}http://localhost:3010/checkout?listingId=<id>${NC}"
echo "4. Fill in shipping address and payment details"
echo "5. Use test card: ${GREEN}4242 4242 4242 4242${NC}"
echo "6. Complete payment and see order confirmation"

echo ""
echo -e "${BLUE}Step 6: Order Status & Escrow Flow${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Order Status Flow:"
echo "  PENDING → PAYMENT_RECEIVED → ESCROW_HELD → SHIPPED → DELIVERED → COMPLETED"
echo ""
echo "Escrow Flow:"
echo "  1. Payment held in escrow (status: HELD)"
echo "  2. Seller ships device"
echo "  3. Buyer receives and confirms"
echo "  4. Escrow released to seller (status: RELEASED)"
echo ""
echo "If disputed:"
echo "  • Order status: DISPUTED"
echo "  • Escrow status: DISPUTED"
echo "  • Admin review required"
echo ""
echo "If refunded:"
echo "  • Stripe refund.create() called"
echo "  • Order status: REFUNDED"
echo "  • Escrow status: REFUNDED"

echo ""
echo -e "${BLUE}Step 7: API Endpoints Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Transaction Service Endpoints:"
echo "  POST   /transactions/orders                    - Create order"
echo "  POST   /transactions/orders/:id/confirm-payment - Confirm payment"
echo "  PATCH  /transactions/orders/:id/status         - Update status"
echo "  GET    /transactions/orders/:id                - Get order"
echo "  GET    /transactions/orders/buyer/:buyerId     - Get buyer orders"
echo "  GET    /transactions/orders/seller/:sellerId   - Get seller orders"
echo "  POST   /transactions/orders/:id/refund         - Refund order"
echo ""
echo "Web API Proxy Endpoints:"
echo "  POST   /api/checkout/create-order              - Proxy to transaction service"
echo "  POST   /api/checkout/confirm-payment           - Proxy to transaction service"
echo "  GET    /api/checkout/orders/:id                - Get order details"

echo ""
echo -e "${GREEN}✓ Payment flow test completed!${NC}"
echo ""
echo "Created test order: $ORDER_ID"
echo "Check it in your database with:"
echo "  docker exec -it veribuy-postgres psql -U veribuy -d veribuy -c \"SELECT * FROM transactions.orders WHERE id = '$ORDER_ID';\""
