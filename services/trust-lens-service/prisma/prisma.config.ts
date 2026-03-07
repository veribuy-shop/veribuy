import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.TRUST_LENS_DATABASE_URL || process.env.DATABASE_URL || '',
  },
});
