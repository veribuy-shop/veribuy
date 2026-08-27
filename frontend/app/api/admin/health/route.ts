import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getBackendUrl } from '@/lib/backend-url';

// Single backend service (modular monolith)
const BACKEND_URL = getBackendUrl();

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

async function checkBackend(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${BACKEND_URL}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    const responseTime = Date.now() - start;
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { name: 'Backend API', status: 'unhealthy', responseTime, details: data, url: BACKEND_URL };
    }

    // Terminus returns { status: 'ok' | 'error', details: { database: { status: 'up'|'down' } } }
    const dbStatus = data?.details?.database?.status;
    if (dbStatus === 'down') {
      return { name: 'Backend API', status: 'degraded', responseTime, details: data, url: BACKEND_URL };
    }

    return { name: 'Backend API', status: 'healthy', responseTime, details: data, url: BACKEND_URL };
  } catch {
    return {
      name: 'Backend API',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      details: { error: 'Connection failed or timed out' },
      url: BACKEND_URL,
    };
  }
}

async function checkPostgres(): Promise<InfraHealth> {
  const start = Date.now();
  try {
    // Check database health through the backend Terminus endpoint
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${BACKEND_URL}/health`, { signal: controller.signal, cache: 'no-store' });
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

async function checkRedis(): Promise<InfraHealth> {
  const start = Date.now();
  try {
    // Redis health is inferred from backend health (backend uses Redis for caching)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${BACKEND_URL}/health`, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);
    const responseTime = Date.now() - start;

    if (res.ok) {
      return { name: 'Redis', status: 'healthy', responseTime, details: { note: 'Inferred from backend health' } };
    }
    return { name: 'Redis', status: 'unhealthy', responseTime, details: {} };
  } catch {
    return { name: 'Redis', status: 'unhealthy', responseTime: Date.now() - start, details: { error: 'Unreachable' } };
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(request, 'ADMIN');
    if ('error' in authResult) {
      return authResult.error;
    }

    // Run all checks in parallel
    const [backend, postgres, redis] = await Promise.all([
      checkBackend(),
      checkPostgres(),
      checkRedis(),
    ]);

    const services = [backend];
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
      infrastructure: [postgres, redis],
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
