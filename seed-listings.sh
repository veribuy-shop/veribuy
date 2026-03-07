#!/bin/bash

# Seed sample listings for VeriBuy

set -e

echo "📦 Seeding VeriBuy with sample listings..."
echo ""

LISTING_SERVICE="http://localhost:3003"

# Test seller ID (you can replace with actual user ID from your system)
SELLER_ID="550e8400-e29b-41d4-a716-446655440000"

# Array of sample listings
declare -a LISTINGS=(
  # iPhone 14 Pro
  '{
    "sellerId": "'$SELLER_ID'",
    "title": "iPhone 14 Pro 256GB Deep Purple - Excellent Condition",
    "description": "Excellent condition iPhone 14 Pro with 256GB storage. Includes original box, charger, and protective case. Battery health at 95%. No scratches on screen, minimal wear on chassis. Fully unlocked and ready for activation.",
    "deviceType": "SMARTPHONE",
    "brand": "Apple",
    "model": "iPhone 14 Pro",
    "price": 899.99,
    "currency": "USD",
    "conditionGrade": "A",
    "imei": "352146110123456",
    "serialNumber": "F2LK9876QWER"
  }'
  
  # Samsung Galaxy S23
  '{
    "sellerId": "'$SELLER_ID'",
    "title": "Samsung Galaxy S23 Ultra 512GB Phantom Black with S Pen",
    "description": "Like-new Galaxy S23 Ultra with S Pen included. 512GB storage, unlocked for all carriers. Screen protector applied from day one. Minor scuffs on back glass. Powerful camera system and stunning display.",
    "deviceType": "SMARTPHONE",
    "brand": "Samsung",
    "model": "Galaxy S23 Ultra",
    "price": 849.99,
    "currency": "USD",
    "conditionGrade": "A",
    "imei": "352146110234567",
    "serialNumber": "R58N987ABCD"
  }'
  
  # MacBook Pro
  '{
    "sellerId": "'$SELLER_ID'",
    "title": "MacBook Pro 14\" M2 Pro 16GB 512GB Space Gray - AppleCare+ Included",
    "description": "2023 MacBook Pro 14-inch with M2 Pro chip, 16GB RAM, 512GB SSD. Perfect for developers and creatives. Battery cycle count: 45. AppleCare+ valid until 2025. Includes original charger and USB-C cable.",
    "deviceType": "LAPTOP",
    "brand": "Apple",
    "model": "MacBook Pro 14",
    "price": 1699.99,
    "currency": "USD",
    "conditionGrade": "A",
    "serialNumber": "C02Y123456AB"
  }'
  
  # iPad Air
  '{
    "sellerId": "'$SELLER_ID'",
    "title": "iPad Air 5th Gen 256GB WiFi + Cellular Blue with Accessories",
    "description": "iPad Air with M1 chip and cellular connectivity. 256GB storage. Comes with Magic Keyboard and Apple Pencil 2nd gen. Screen is pristine, slight wear on back aluminum. Perfect for productivity and creativity.",
    "deviceType": "TABLET",
    "brand": "Apple",
    "model": "iPad Air",
    "price": 549.99,
    "currency": "USD",
    "conditionGrade": "B",
    "serialNumber": "DMQK123456"
  }'
  
  # Google Pixel 8 Pro
  '{
    "sellerId": "'$SELLER_ID'",
    "title": "Google Pixel 8 Pro 256GB Obsidian - Amazing Camera System",
    "description": "Latest Google Pixel 8 Pro with amazing camera system and AI features. 256GB unlocked for all carriers. Includes case and screen protector. 7 years of OS updates remaining. Good condition with some minor scratches on the frame.",
    "deviceType": "SMARTPHONE",
    "brand": "Google",
    "model": "Pixel 8 Pro",
    "price": 699.99,
    "currency": "USD",
    "conditionGrade": "B",
    "imei": "352146110345678",
    "serialNumber": "GG123456789"
  }'
  
  # Apple Watch
  '{
    "sellerId": "'$SELLER_ID'",
    "title": "Apple Watch Series 8 GPS + Cellular 45mm Midnight with Extra Bands",
    "description": "Apple Watch Series 8 with cellular connectivity for calls and messages. Stainless steel case, midnight sport band included. Additional bands included (sport loop and leather). Battery holds charge well throughout the day. Some scratches on the stainless steel case from normal wear.",
    "deviceType": "SMARTWATCH",
    "brand": "Apple",
    "model": "Watch Series 8",
    "price": 329.99,
    "currency": "USD",
    "conditionGrade": "C",
    "serialNumber": "FR123456ABC"
  }'
  
  # Dell XPS 15
  '{
    "sellerId": "'$SELLER_ID'",
    "title": "Dell XPS 15 9520 Intel i7 32GB RAM 1TB SSD 4K OLED Display",
    "description": "Powerful Dell XPS 15 with 12th gen Intel i7 processor, 32GB RAM, 1TB NVMe SSD, NVIDIA RTX 3050 Ti GPU. Stunning 15.6 inch 4K OLED display with incredible color accuracy. Perfect for gaming, video editing, and productivity. Excellent condition with minimal signs of use.",
    "deviceType": "LAPTOP",
    "brand": "Dell",
    "model": "XPS 15 9520",
    "price": 1399.99,
    "currency": "USD",
    "conditionGrade": "A",
    "serialNumber": "DELL123ABC"
  }'
  
  # PlayStation 5
  '{
    "sellerId": "'$SELLER_ID'",
    "title": "Sony PlayStation 5 Disc Edition with Extra Controller and Box",
    "description": "PS5 disc edition in excellent condition with minimal use. Includes original retail box with all packaging, HDMI cable, power cable, one DualSense wireless controller (white), and one additional DualSense controller (cosmic red). Barely used, works flawlessly. Perfect for gaming enthusiasts.",
    "deviceType": "GAMING_CONSOLE",
    "brand": "Sony",
    "model": "PlayStation 5",
    "price": 449.99,
    "currency": "USD",
    "conditionGrade": "A",
    "serialNumber": "PS5-123456789"
  }'
)

SUCCESS_COUNT=0
FAIL_COUNT=0
LISTING_IDS=()

for listing in "${LISTINGS[@]}"; do
  # Extract title for display
  TITLE=$(echo "$listing" | jq -r '.title')
  echo -n "Creating: $TITLE... "
  
  # Make API call
  RESPONSE=$(curl -s -X POST "$LISTING_SERVICE/listings" \
    -H "Content-Type: application/json" \
    -d "$listing")
  
  # Check if successful
  if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    LISTING_ID=$(echo "$RESPONSE" | jq -r '.id')
    LISTING_IDS+=("$LISTING_ID")
    echo "✅ Created (ID: ${LISTING_ID:0:8}...)"
    ((SUCCESS_COUNT++))
  else
    echo "❌ Failed"
    echo "   Error: $(echo "$RESPONSE" | jq -r '.message // .error // "Unknown error"')"
    ((FAIL_COUNT++))
  fi
done

# Activate all created listings
if [ ${#LISTING_IDS[@]} -gt 0 ]; then
  echo ""
  echo "🔄 Activating listings and marking as verified..."
  for id in "${LISTING_IDS[@]}"; do
    # Update status to ACTIVE
    curl -s -X PUT "$LISTING_SERVICE/listings/$id/status" \
      -H "Content-Type: application/json" \
      -d '{"status": "ACTIVE"}' > /dev/null
    
    # Update trustLensStatus to PASSED
    curl -s -X PUT "$LISTING_SERVICE/listings/$id/trust-lens" \
      -H "Content-Type: application/json" \
      -d '{"trustLensStatus": "PASSED"}' > /dev/null
  done
  echo "✅ All listings activated and verified"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Created: $SUCCESS_COUNT listings"
if [ $FAIL_COUNT -gt 0 ]; then
  echo "❌ Failed: $FAIL_COUNT listings"
fi
echo ""
echo "View listings at: http://localhost:3010/browse"
echo "API endpoint: http://localhost:3003/listings"
