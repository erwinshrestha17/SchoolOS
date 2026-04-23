import 'dotenv/config';
import { defineConfig, env } from '@prisma/config';

export default defineConfig({
  migrations: {
    seed: 'tsx seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});