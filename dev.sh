#!/bin/bash

# VeriBuy Development with Docker + Hot Reload
# Changes to your code will reflect INSTANTLY without rebuilds!

echo "🚀 Starting VeriBuy in Docker with HOT RELOAD"
echo "=============================================="
echo ""
echo "✨ Code changes will reflect INSTANTLY - no rebuilds needed!"
echo "✨ Everything runs in Docker for easy deployment"
echo ""

# Start all services
echo "📦 Starting all services..."
docker-compose -f docker-compose.dev.yml up --build

