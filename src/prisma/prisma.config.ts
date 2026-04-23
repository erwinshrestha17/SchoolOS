import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx ts-node prisma/seed.ts', // <-- Added this line for seeding
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
