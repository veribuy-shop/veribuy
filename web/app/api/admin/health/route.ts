import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

// Service health endpoints (direct HTTP, not through gateway)
const SERVICES = [
  { name: 'Gateway',              url: process.env.GATEWAY_SERVICE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000' },
  { name: 'Auth Service',         url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001' },
  { name: 'User Service',         url: process.env.USER_SERVICE_URL || 'http://localhost:3002' },
  { name: 'Listing Service',      url: process.env.LISTING_SERVICE_URL || 'http://localhost:3003' },
  { name: 'Trust Lens Service',   url: process.env.TRUST_LENS_SERVICE_URL || 'http://localhost:3004' },

  { name: 'Evidence Service',     url: process.env.EVIDENCE_SERVICE_URL || 'http://localhost:3006' },
  { name: 'Transaction Service',  url: process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3007' },
  { name: 'Notification Service', url: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008' },
];

// RabbitMQ management API
const RABBITMQ_URL = process.env.RABBITMQ_MANAGEMENT_URL || 'http://localhost:15672';
const RABBITMQ_USER = process.env.RABBITMQ_USER || 'veribuy';
const RABBITMQ_PASS = process.env.RABBITMQ_PASSWORD || 'veribuy_rabbit_dev';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  details: Record<string, unknown>;
  url: string;
}

interface InfraHealth {
  name: string;
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  details: Record<string, unknown>;
}

async function checkService(service: typeof SERVICES[number]): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${service.url}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    const responseTime = Date.now() - start;
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { name: service.name, status: 'unhealthy', responseTime, details: data, url: service.url };
    }

    // Terminus returns { status: 'ok' | 'error', details: { database: { status: 'up'|'down' } } }
    const dbStatus = data?.details?.database?.status;
    if (dbStatus === 'down') {
      return { name: service.name, status: 'degraded', responseTime, details: data, url: service.url };
    }

    return { name: service.name, status: 'healthy', responseTime, details: data, url: service.url };
  } catch {
    return {
      name: service.name,
      status: 'unhealthy',
      responseTime: Date.now() - start,
      details: { error: 'Connection failed or timed out' },
      url: service.url,
    };
  }
}

async function checkRedis(): Promise<InfraHealth> {
  const start = Date.now();
  try {
    // We can't directly ping Redis from a Next.js API route without a Redis client.
    // Instead, we rely on the services that use Redis being healthy.
    // But we can check if the auth-service /health is up as a proxy for Redis health.
    // For a more direct check, we'll use the user-service health since it uses Redis heavily.
    const url = process.env.USER_SERVICE_URL || 'http://localhost:3002';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url}/health`, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);
    const responseTime = Date.now() - start;

    if (res.ok) {
      return { name: 'Redis', status: 'healthy', responseTime, details: { note: 'Inferred from service health' } };
    }
    return { name: 'Redis', status: 'unhealthy', responseTime, details: {} };
  } catch {
    return { name: 'Redis', status: 'unhealthy', responseTime: Date.now() - start, details: { error: 'Unreachable' } };
  }
}

async function checkRabbitMQ(): Promise<InfraHealth> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${RABBITMQ_URL}/api/healthchecks/node`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${RABBITMQ_USER}:${RABBITMQ_PASS}`).toString('base64'),
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    const responseTime = Date.now() - start;
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.status === 'ok') {
      return { name: 'RabbitMQ', status: 'healthy', responseTime, details: data };
    }
    return { name: 'RabbitMQ', status: 'unhealthy', responseTime, details: data };
  } catch {
    return { name: 'RabbitMQ', status: 'unhealthy', responseTime: Date.now() - start, details: { error: 'Connection failed' } };
  }
}

async function checkPostgres(): Promise<InfraHealth> {
  const start = Date.now();
  try {
    // Check database health through the auth-service Terminus endpoint
    // which does a Prisma ping check against PostgreSQL
    const url = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${url}/health`, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);
    const responseTime = Date.now() - start;
    const data = await res.json().catch(() => ({}));

    const dbStatus = data?.details?.database?.status;
    if (res.ok && dbStatus === 'up') {
      return { name: 'PostgreSQL', status: 'healthy', responseTime, details: { database: dbStatus } };
    }
    return { name: 'PostgreSQL', status: 'unhealthy', responseTime, details: data };
  } catch {
    return { name: 'PostgreSQL', status: 'unhealthy', responseTime: Date.now() - start, details: { error: 'Unreachable' } };
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    // Run all checks in parallel
    const [services, redis, rabbitmq, postgres] = await Promise.all([
      Promise.all(SERVICES.map(checkService)),
      checkRedis(),
      checkRabbitMQ(),
      checkPostgres(),
    ]);

    const healthyCount = services.filter(s => s.status === 'healthy').length;
    const totalCount = services.length;

    const overallStatus = healthyCount === totalCount
      ? 'healthy'
      : healthyCount >= totalCount * 0.7
        ? 'degraded'
        : 'unhealthy';

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overall: overallStatus,
      services,
      infrastructure: [postgres, redis, rabbitmq],
      summary: {
        healthy: healthyCount,
        unhealthy: totalCount - healthyCount,
        total: totalCount,
        avgResponseTime: Math.round(services.reduce((sum, s) => sum + s.responseTime, 0) / totalCount),
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { error: 'Failed to check system health' },
      { status: 500 },
    );
  }
}
