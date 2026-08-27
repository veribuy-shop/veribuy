import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Load backend/.env first, then fall back to the repository root .env.
loadEnv({ path: path.resolve(__dirname, '.env') });
loadEnv({ path: path.resolve(__dirname, '../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || '',
  },
});
