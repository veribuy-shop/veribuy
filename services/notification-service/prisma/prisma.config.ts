import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.NOTIFICATION_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://veribuy:veribuy_dev_password@localhost:5432/veribuy?schema=notifications',
  },
});
