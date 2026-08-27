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

    // Run all checks against the single live health payload
    const [backend, postgres, redis] = await Promise.all([
      checkBackend(),
      checkPostgres(),
      checkRedis(),
    ]);

    const services = [backend, postgres, redis];
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
      infrastructure: [],
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
