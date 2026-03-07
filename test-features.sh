#!/bin/bash

# Test Contact Seller and Checkout Features

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing VeriBuy - Contact Seller & Checkout"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Verify notification service is accessible
echo "📡 Test 1: Checking notification service connectivity..."
if docker exec veribuy-web wget -q -O- http://notification-service:3008/health > /dev/null 2>&1; then
  echo "   ✅ Notification service is reachable from web container"
else
  echo "   ❌ Cannot reach notification service"
  exit 1
fi
echo ""

# Test 2: Verify environment variables
echo "🔧 Test 2: Checking environment variables..."
NOTIFICATION_URL=$(docker exec veribuy-web printenv | grep NOTIFICATION_SERVICE_URL | cut -d'=' -f2)
if [ "$NOTIFICATION_URL" = "http://notification-service:3008" ]; then
  echo "   ✅ NOTIFICATION_SERVICE_URL correctly set to: $NOTIFICATION_URL"
else
  echo "   ❌ NOTIFICATION_SERVICE_URL is: $NOTIFICATION_URL (should be http://notification-service:3008)"
fi

LISTING_URL=$(docker exec veribuy-web printenv | grep LISTING_SERVICE_URL | cut -d'=' -f2)
if [ "$LISTING_URL" = "http://listing-service:3003" ]; then
  echo "   ✅ LISTING_SERVICE_URL correctly set to: $LISTING_URL"
else
  echo "   ❌ LISTING_SERVICE_URL is: $LISTING_URL (should be http://listing-service:3003)"
fi
echo ""

# Test 3: Check Stripe configuration
echo "💳 Test 3: Checking Stripe configuration..."
STRIPE_KEY=$(docker exec veribuy-web printenv | grep NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | cut -d'=' -f2)
if [ -n "$STRIPE_KEY" ]; then
  echo "   ⚠️  Stripe publishable key found: ${STRIPE_KEY:0:20}..."
  if [[ "$STRIPE_KEY" == pk_test_51QhbRyK8GBBC8YUw* ]]; then
    echo "   ⚠️  WARNING: Using placeholder Stripe key"
    echo "   ℹ️  Checkout button will be disabled until you add real keys"
    echo "   ℹ️  Get real keys from: https://dashboard.stripe.com/test/apikeys"
  else
    echo "   ✅ Using custom Stripe key (may be valid)"
  fi
else
  echo "   ❌ No Stripe key configured"
fi
echo ""

# Test 4: Verify listings exist
echo "📦 Test 4: Checking listings..."
LISTING_COUNT=$(curl -s http://localhost:3003/listings | jq 'length')
if [ "$LISTING_COUNT" -gt 0 ]; then
  echo "   ✅ Found $LISTING_COUNT active listings"
else
  echo "   ❌ No listings found"
fi
echo ""

# Test 5: Check notification service routes
echo "📮 Test 5: Checking notification service routes..."
if docker exec veribuy-notification wget -q -O- http://localhost:3008/health > /dev/null 2>&1; then
  echo "   ✅ Notification service health check passing"
else
  echo "   ❌ Notification service health check failing"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Contact Seller Form: READY TO TEST"
echo "   • Visit: http://localhost:3010/browse"
echo "   • Click any listing → Contact Seller"
echo "   • Fill form and send message"
echo ""
echo "⚠️  Checkout Button: NEEDS STRIPE KEYS"
echo "   • Get keys: https://dashboard.stripe.com/test/apikeys"
echo "   • Update .env with real keys"
echo "   • Restart: docker-compose down && docker-compose up -d"
echo ""
echo "📋 Active Listings: $LISTING_COUNT available"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
