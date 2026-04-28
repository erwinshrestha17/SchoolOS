import { readFileSync } from 'node:fs';

const mainSource = readFileSync('apps/api/src/main.ts', 'utf8');
const requiredFragments = [
  "import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';",
  'SwaggerModule.createDocument(app, swaggerConfig)',
  "SwaggerModule.setup('api/v1/docs', app, document)",
  ".setTitle('SchoolOS API')",
  ".setVersion('1.0.0')",
  '.addBearerAuth()',
];

const missing = requiredFragments.filter(
  (fragment) => !mainSource.includes(fragment),
);

if (missing.length > 0) {
  console.error('OpenAPI generation gate failed. Missing expected API docs wiring:');
  for (const fragment of missing) {
    console.error(`- ${fragment}`);
  }
  process.exit(1);
}

