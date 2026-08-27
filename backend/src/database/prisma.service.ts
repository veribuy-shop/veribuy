import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PoolConfig } from 'pg';
import { PrismaClient } from '.prisma/veribuy-client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }
    const isProd = process.env.NODE_ENV === 'production';
    // Strip any sslmode=... param so pg does not force cert verification, then
    // enable TLS explicitly below. Render internal Postgres uses a self-signed cert.
    const cleanUrl = connectionString.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
    const poolConfig: PoolConfig = {
      connectionString: cleanUrl,
      ssl: isProd ? { rejectUnauthorized: false } : undefined,
    };
    super({ adapter: new PrismaPg(poolConfig) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
