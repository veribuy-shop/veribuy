#!/bin/bash

# VeriBuy Local Development Setup
# Run this to start development with hot-reload (no rebuilds needed!)

echo "🚀 Starting VeriBuy in Local Development Mode"
echo "=============================================="
echo ""
echo "This will:"
echo "  ✓ Run databases in Docker (PostgreSQL, Redis, RabbitMQ, MinIO)"
echo "  ✓ Run services locally with hot-reload (changes reflect instantly!)"
echo ""

# Stop all existing containers
echo "📦 Stopping existing Docker containers..."
docker-compose down 2>/dev/null

# Start only infrastructure in Docker
echo "🐳 Starting infrastructure (PostgreSQL, Redis, RabbitMQ, MinIO, Jaeger)..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for infrastructure to be ready..."
sleep 5

# Check if healthy
echo "✅ Infrastructure status:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep veribuy

echo ""
echo "════════════════════════════════════════════"
echo "🎉 Infrastructure is ready!"
echo "════════════════════════════════════════════"
echo ""
echo "Now run services locally with HOT RELOAD:"
echo ""
echo "  cd /Users/octosoft/Desktop/VeriBuy"
echo "  pnpm dev"
echo ""
echo "This will start ALL services in watch mode:"
echo "  • Gateway (port 3000)"
echo "  • Auth Service (port 3001)"
echo "  • User Service (port 3002)"
echo "  • Listing Service (port 3003)"
echo "  • Trust Lens Service (port 3004)"
echo "  • Evidence Service (port 3006)"
echo "  • Transaction Service (port 3007)"
echo "  • Notification Service (port 3008)"
echo "  • Web Frontend (port 3010)"
echo ""
echo "✨ ANY code changes will reflect INSTANTLY!"
echo "   No rebuilds needed!"
echo ""
echo "Database URLs:"
echo "  PostgreSQL: postgresql://veribuy:veribuy_dev_password@localhost:5432/veribuy"
echo "  Redis: redis://localhost:6379"
echo "  RabbitMQ: amqp://veribuy:veribuy_rabbit_dev@localhost:5672"
echo "  MinIO: http://localhost:9000"
echo "  Jaeger: http://localhost:16686"
echo ""
