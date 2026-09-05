import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getBackendUrl } from '@/lib/backend-url';

// Single backend service (modular monolith)
const BACKEND_URL = getBackendUrl();

type HealthState = 'healthy' | 'unhealthy' | 'degraded';

interface ServiceHealth {
  name: string;
  status: HealthState;
  responseTime: number;
  details: Record<string, unknown>;
  url: string;
}

async function fetchBackendHealth(): Promise<{ data: any; responseTime: number; ok: boolean }> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return { data, responseTime: Date.now() - start, ok: res.ok };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkBackend(): Promise<ServiceHealth> {
  const { data, responseTime, ok } = await fetchBackendHealth().catch(() => ({
    data: { error: 'Connection failed or timed out' },
    responseTime: -1,
    ok: false,
  }));

  if (!ok) {
    return { name: 'Backend API', status: 'unhealthy', responseTime, details: data, url: BACKEND_URL };
  }

  // Backend /health status === 'error' indicates the database is down.
  const status: HealthState = data?.status === 'error' ? 'degraded' : 'healthy';
  return { name: 'Backend API', status, responseTime, details: data, url: BACKEND_URL };
}

async function checkPostgres(): Promise<ServiceHealth> {
  const { data, responseTime, ok } = await fetchBackendHealth().catch(() => ({
    data: {},
    responseTime: -1,
    ok: false,
  }));

  const dbStatus = data?.details?.database?.status;
  const status: HealthState =
    !ok || dbStatus === 'down' ? 'unhealthy' : dbStatus === 'up' ? 'healthy' : 'degraded';

  return {
    name: 'PostgreSQL',
    status,
    responseTime,
    details: { database: dbStatus ?? 'unknown' },
    url: BACKEND_URL,
  };
}

async function checkRedis(): Promise<ServiceHealth> {
  const { data, responseTime, ok } = await fetchBackendHealth().catch(() => ({
    data: {},
    responseTime: -1,
    ok: false,
  }));

  const redisStatus = data?.details?.redis?.status;
  const status: HealthState =
    !ok || redisStatus === 'down' ? 'unhealthy' : redisStatus === 'up' ? 'healthy' : 'degraded';

  return {
    name: 'Redis',
    status,
    responseTime,
    details: { redis: redisStatus ?? 'unknown', ...(data?.details?.redis?.note ? { note: data.details.redis.note } : {}) },
    url: BACKEND_URL,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    const { data, responseTime, ok } = await fetchBackendHealth().catch(() => ({
      data: {},
      responseTime: -1,
      ok: false,
    }));

    const backendStatus: HealthState = !ok ? 'unhealthy' : data?.status === 'error' ? 'degraded' : 'healthy';
    const dbStatus = data?.details?.database?.status;
    const postgresStatus: HealthState =
      !ok || dbStatus === 'down' ? 'unhealthy' : dbStatus === 'up' ? 'healthy' : 'degraded';
    const redisStatus = data?.details?.redis?.status;
    const redisHealthStatus: HealthState =
      !ok || redisStatus === 'down' ? 'unhealthy' : redisStatus === 'up' ? 'healthy' : 'degraded';

    const services: ServiceHealth[] = [
      { name: 'Core Backend Engine', status: backendStatus, responseTime, details: { service: 'veribuy-backend', port: 3000 }, url: BACKEND_URL },
      { name: 'PostgreSQL 17 Database', status: postgresStatus, responseTime: data?.details?.database?.responseTime ?? responseTime, details: { database: dbStatus ?? 'unknown' }, url: BACKEND_URL },
      { name: 'Redis Cache & State', status: redisHealthStatus, responseTime: data?.details?.redis?.responseTime ?? responseTime, details: { redis: redisStatus ?? 'unknown' }, url: BACKEND_URL },
    ];

    const modules = [
      { name: 'Auth & Identity API', route: '/auth', status: backendStatus === 'healthy' ? 'operational' : 'degraded', description: 'JWT tokens, role guards, and cookie sessions' },
      { name: 'Users & Profiles API', route: '/users', status: backendStatus === 'healthy' ? 'operational' : 'degraded', description: 'User account profiles & KYC states' },
      { name: 'Listings & Catalog API', route: '/listings', status: backendStatus === 'healthy' ? 'operational' : 'degraded', description: 'Catalog indexing, filtering, and prices' },
      { name: 'Trust Lens™ Verification API', route: '/trust-lens', status: backendStatus === 'healthy' ? 'operational' : 'degraded', description: 'Device integrity check & verification certificates' },
      { name: 'Transactions & Escrow API', route: '/transactions', status: backendStatus === 'healthy' ? 'operational' : 'degraded', description: 'Stripe intents, escrow vaulting & order payouts' },
      { name: 'Evidence Vault API', route: '/evidence', status: backendStatus === 'healthy' ? 'operational' : 'degraded', description: 'Cloudinary media uploads & inspection assets' },
      { name: 'Notifications & Messaging API', route: '/messages', status: backendStatus === 'healthy' ? 'operational' : 'degraded', description: 'Order lifecycle alerts & user communications' },
    ];

    const healthyCount = services.filter((s) => s.status === 'healthy').length;
    const totalCount = services.length;

    const overallStatus =
      healthyCount === totalCount
        ? 'healthy'
        : healthyCount >= totalCount * 0.7
          ? 'degraded'
          : 'unhealthy';

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overall: overallStatus,
      services,
      modules,
      summary: {
        healthy: healthyCount,
        unhealthy: services.filter((s) => s.status === 'unhealthy').length,
        total: totalCount,
        avgResponseTime: Math.round(
          services.reduce((sum, s) => sum + Math.max(s.responseTime, 0), 0) / totalCount,
        ),
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
