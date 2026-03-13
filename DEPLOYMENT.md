# VeriBuy Deployment Guide

## 🚀 Quick Start with Docker Compose

This guide explains how to deploy the entire VeriBuy platform using Docker Compose.

### Prerequisites

- Docker Engine 20.10+ and Docker Compose V2
- Node.js 22+ (for local development)
- pnpm 9.15.0+ (for local development)
- At least 4GB RAM available for Docker
- Ports 3000-3010, 5432, 6379, 5672, 15672, 9000-9001 available

---

## 📦 Full Stack Deployment

### 1. Clone and Setup

```bash
git clone <repository-url>
cd VeriBuy
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```bash
# Database
POSTGRES_USER=veribuy
POSTGRES_PASSWORD=veribuy_dev_password
POSTGRES_DB=veribuy
POSTGRES_PORT=5432

# Database URLs for services
AUTH_DATABASE_URL=postgresql://veribuy:veribuy_dev_password@postgres:5432/veribuy?schema=auth
USER_DATABASE_URL=postgresql://veribuy:veribuy_dev_password@postgres:5432/veribuy?schema=users
LISTING_DATABASE_URL=postgresql://veribuy:veribuy_dev_password@postgres:5432/veribuy?schema=listings
TRUST_LENS_DATABASE_URL=postgresql://veribuy:veribuy_dev_password@postgres:5432/veribuy?schema=trust_lens
EVIDENCE_DATABASE_URL=postgresql://veribuy:veribuy_dev_password@postgres:5432/veribuy?schema=evidence
TRANSACTION_DATABASE_URL=postgresql://veribuy:veribuy_dev_password@postgres:5432/veribuy?schema=transactions
NOTIFICATION_DATABASE_URL=postgresql://veribuy:veribuy_dev_password@postgres:5432/veribuy?schema=notifications

# Redis
REDIS_PASSWORD=veribuy_redis_dev
REDIS_PORT=6379
REDIS_URL=redis://:veribuy_redis_dev@redis:6379

# RabbitMQ
RABBITMQ_USER=veribuy
RABBITMQ_PASSWORD=veribuy_rabbit_dev
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
RABBITMQ_URL=amqp://veribuy:veribuy_rabbit_dev@rabbitmq:5672

# MinIO (S3-compatible storage)
MINIO_ACCESS_KEY=veribuy_minio
MINIO_SECRET_KEY=veribuy_minio_secret
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ENDPOINT=minio:9000

# JWT Secrets (CHANGE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Service Ports
GATEWAY_PORT=3000
AUTH_SERVICE_PORT=3001
USER_SERVICE_PORT=3002
LISTING_SERVICE_PORT=3003
TRUST_LENS_SERVICE_PORT=3004
EVIDENCE_SERVICE_PORT=3006
TRANSACTION_SERVICE_PORT=3007
NOTIFICATION_SERVICE_PORT=3008

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# Service URLs (for inter-service communication)
AUTH_SERVICE_URL=http://auth-service:3001
USER_SERVICE_URL=http://user-service:3002
LISTING_SERVICE_URL=http://listing-service:3003
TRUST_LENS_SERVICE_URL=http://trust-lens-service:3004
EVIDENCE_SERVICE_URL=http://evidence-service:3006
TRANSACTION_SERVICE_URL=http://transaction-service:3007
NOTIFICATION_SERVICE_URL=http://notification-service:3008

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 3. Deploy Everything

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up --build -d
```

### 4. Verify Deployment

```bash
# Check all services are running
docker-compose ps

# Expected output:
# veribuy-postgres               running   5432/tcp
# veribuy-redis                  running   6379/tcp
# veribuy-rabbitmq               running   5672/tcp, 15672/tcp
# veribuy-minio                  running   9000-9001/tcp
# veribuy-gateway                running   3000/tcp
# veribuy-auth                   running   3001/tcp
# veribuy-user                   running   3002/tcp
# veribuy-listing                running   3003/tcp
# veribuy-trust-lens             running   3004/tcp
# veribuy-evidence               running   3006/tcp
# veribuy-transaction            running   3007/tcp
# veribuy-notification           running   3008/tcp
# veribuy-web                    running   3000/tcp
```

### 5. Access the Application

- **Web Frontend**: http://localhost:3010
- **API Gateway**: http://localhost:3000
- **RabbitMQ Management**: http://localhost:15672 (user: `veribuy`, pass: `veribuy_rabbit_dev`)
- **MinIO Console**: http://localhost:9001 (user: `veribuy_minio`, pass: `veribuy_minio_secret`)

---

## 👤 Default Users

The database is automatically seeded with:

### Admin Account
- **Email**: `admin@veribuy.com`
- **Password**: `Admin123!`
- **Role**: ADMIN
- **Access**: Platform management, no marketplace features

### Test User Account
- **Email**: `frontend-test@veribuy.com`
- **Password**: `Test123!`
- **Role**: USER
- **Access**: Full marketplace features (buy & sell)

### Sample Data
- **1 Active Listing**: iPhone 15 Pro Max - 256GB Natural Titanium ($1,099)
- **Trust Lens Status**: PASSED (Score: 95)
- **Seller**: Test User

---

## 🔧 Management Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f auth-service
docker-compose logs -f web
docker-compose logs -f postgres
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart auth-service
```

### Stop Services

```bash
# Stop all (keeps data)
docker-compose stop

# Stop and remove containers (keeps data)
docker-compose down

# Stop and remove everything including volumes (DELETES DATA!)
docker-compose down -v
```

### Rebuild Services

```bash
# Rebuild all services
docker-compose build

# Rebuild specific service
docker-compose build auth-service

# Rebuild and restart
docker-compose up --build -d
```

### Database Access

```bash
# Access PostgreSQL
docker exec -it veribuy-postgres psql -U veribuy -d veribuy

# View users
docker exec veribuy-postgres psql -U veribuy -d veribuy -c "SELECT email, role FROM auth.users;"

# View listings
docker exec veribuy-postgres psql -U veribuy -d veribuy -c "SELECT title, price, status FROM listings.listings;"
```

### Redis Access

```bash
# Access Redis CLI
docker exec -it veribuy-redis redis-cli -a veribuy_redis_dev

# Check keys
docker exec veribuy-redis redis-cli -a veribuy_redis_dev KEYS "*"
```

---

## 🗄️ Database Schema

The database is automatically initialized with 7 schemas:

1. **auth** - User authentication (users, refresh_tokens)
2. **users** - User profiles
3. **listings** - Product listings
4. **trust_lens** - Verification requests
5. **evidence** - Evidence packs and items
6. **transactions** - Orders and escrow accounts
7. **notifications** - Notifications and messages

---

## 🔄 Fresh Start

If you need to completely reset the database:

```bash
# Stop all services
docker-compose down

# Remove all volumes (THIS DELETES ALL DATA!)
docker-compose down -v

# Start fresh
docker-compose up --build -d
```

The init-db.sh script will automatically:
- Create all database schemas
- Create all tables with proper indexes
- Seed with admin user, test user, and sample listing

---

## 📊 Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Web Frontend                        │
│                   (Next.js - :3010)                     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   API Gateway                           │
│                    (NestJS - :3000)                     │
└───┬──────┬──────┬──────┬──────┬──────┬──────┬─────────┘
    │      │      │      │      │      │      │
┌───▼──┐ ┌─▼───┐ ┌▼────┐ ┌▼────┐ ┌▼───┐ ┌▼───┐ ┌▼──────┐
│ Auth │ │User │ │List │ │Trust│ │Evid│ │Txn │ │Notify │
│ :3001│ │:3002│ │:3003│ │:3004│ │:3006│ │:3007│ │:3008  │
└───┬──┘ └─┬───┘ └┬────┘ └┬────┘ └┬───┘ └┬───┘ └┬──────┘
    │      │      │       │       │      │      │
    └──────┴──────┴───────┴───────┴──────┴──────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
┌───▼──────┐         ┌────▼────┐          ┌─────▼─────┐
│PostgreSQL│         │RabbitMQ │          │   Redis   │
│  :5432   │         │:5672    │          │   :6379   │
└──────────┘         │:15672   │          └───────────┘
                     └─────────┘
                           │
                     ┌─────▼─────┐
                     │   MinIO   │
                     │:9000-9001 │
                     └───────────┘
```

---

## 🐛 Troubleshooting

### Services won't start

```bash
# Check if ports are in use
lsof -nP -iTCP -sTCP:LISTEN | grep -E "3000|3001|5432|6379|5672|9000"

# Kill conflicting processes
# Then restart docker-compose
```

### Database connection errors

```bash
# Check postgres health
docker-compose ps postgres

# Check postgres logs
docker-compose logs postgres

# Verify database exists
docker exec veribuy-postgres psql -U veribuy -l
```

### Service-specific errors

```bash
# Check logs for specific service
docker-compose logs auth-service

# Restart specific service
docker-compose restart auth-service

# Rebuild if code changed
docker-compose up --build auth-service -d
```

### Clear everything and start fresh

```bash
# Nuclear option - deletes everything
docker-compose down -v
docker system prune -a --volumes
docker-compose up --build -d
```

---

## 🔒 Security Notes

⚠️ **IMPORTANT FOR PRODUCTION:**

1. **Change all default passwords** in `.env`
2. **Use strong JWT secrets** (generate with `openssl rand -base64 32`)
3. **Enable HTTPS** with proper SSL certificates
4. **Set up firewall rules** to restrict database access
5. **Use Docker secrets** instead of .env for sensitive data
6. **Enable RabbitMQ authentication** properly
7. **Secure MinIO with proper access policies**
8. **Use production Stripe keys**

---

## 📈 Monitoring

### Health Checks

All services have health check endpoints:

```bash
# Infrastructure
curl http://localhost:5432  # PostgreSQL
curl http://localhost:6379  # Redis
curl http://localhost:15672 # RabbitMQ Management

# Services
curl http://localhost:3001/health  # Auth
curl http://localhost:3002/health  # User
curl http://localhost:3003/health  # Listing
curl http://localhost:3004/health  # Trust Lens
curl http://localhost:3006/health  # Evidence
curl http://localhost:3007/health  # Transaction
curl http://localhost:3008/health  # Notification
```

### Resource Usage

```bash
# Monitor resource usage
docker stats

# Check disk usage
docker system df
```

---

## 📝 Development Workflow

For local development, you can run services individually:

```bash
# Start infrastructure only
docker-compose up postgres redis rabbitmq minio -d

# Run services locally
cd services/auth-service && pnpm dev
cd services/user-service && pnpm dev
# etc...

# Run frontend
cd web && pnpm dev
```

This allows for faster development with hot reload while still using Docker for infrastructure.

---

## 🎯 Next Steps

After deployment:

1. **Test the application**: Visit http://localhost:3010
2. **Login as test user**: frontend-test@veribuy.com / Test123!
3. **Browse listings**: Check the sample iPhone listing
4. **Test checkout flow**: Try purchasing the listing
5. **Test seller flow**: Create a new listing
6. **Monitor logs**: Watch service logs for any issues

---

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**VeriBuy** - Verification-Led Marketplace for Electronics
