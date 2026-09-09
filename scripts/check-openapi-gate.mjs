import { createRequire } from "node:module";
import { resolve } from "node:path";

const apiRoot = resolve("apps/api");
const requireFromApi = createRequire(resolve(apiRoot, "package.json"));

requireFromApi("reflect-metadata");

const { NestFactory } = requireFromApi("@nestjs/core");
const { DocumentBuilder, SwaggerModule } = requireFromApi("@nestjs/swagger");
const { AppModule } = requireFromApi(
  resolve(apiRoot, "dist/apps/api/src/app.module.js"),
);

const HTTP_METHODS = new Set([
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "trace",
]);

const REQUIRED_OPERATIONS = [
  ["post", "/api/v1/auth/login"],
  ["post", "/api/v1/auth/refresh"],
  ["get", "/api/v1/ready"],
  ["get", "/api/v1/platform/tenants"],
  ["post", "/api/v1/attendance/sync"],
  ["post", "/api/v1/homework"],
  ["post", "/api/v1/mobile/teacher/homework"],
  ["post", "/api/v1/finance/payments"],
];

function fail(message) {
  console.error(`OpenAPI contract gate failed: ${message}`);
  process.exitCode = 1;
}

const app = await NestFactory.create(AppModule, {
  logger: false,
  preview: true,
});

try {
  app.setGlobalPrefix("api/v1");

  const swaggerConfig = new DocumentBuilder()
    .setTitle("SchoolOS API")
    .setDescription("Multi-tenant SchoolOS admin API")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const pathEntries = Object.entries(document.paths ?? {});
  const schemas = Object.keys(document.components?.schemas ?? {});
  const operations = [];

  for (const [path, pathItem] of pathEntries) {
    if (!path.startsWith("/api/v1")) {
      fail(`path is outside the API prefix: ${path}`);
    }

    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (HTTP_METHODS.has(method)) {
        operations.push({ method, path, operation });
      }
    }
  }

  if (document.openapi !== "3.0.0") {
    fail(`expected OpenAPI 3.0.0, received ${String(document.openapi)}`);
  }
  if (document.info?.title !== "SchoolOS API") {
    fail("document title is missing or incorrect");
  }
  if (pathEntries.length < 100 || operations.length < 100) {
    fail(
      `generated contract is unexpectedly small (${pathEntries.length} paths, ${operations.length} operations)`,
    );
  }
  if (schemas.length < 50) {
    fail(`generated contract exposes only ${schemas.length} schemas`);
  }

  const bearer = document.components?.securitySchemes?.bearer;
  if (
    !bearer ||
    "$ref" in bearer ||
    bearer.type !== "http" ||
    bearer.scheme !== "bearer"
  ) {
    fail("JWT bearer security scheme is missing or malformed");
  }

  for (const [method, path] of REQUIRED_OPERATIONS) {
    if (!document.paths?.[path]?.[method]) {
      fail(`required operation is missing: ${method.toUpperCase()} ${path}`);
    }
  }

  const operationIds = new Map();
  for (const { method, path, operation } of operations) {
    if (!operation.operationId) {
      fail(`operationId is missing: ${method.toUpperCase()} ${path}`);
      continue;
    }
    if (Object.keys(operation.responses ?? {}).length === 0) {
      fail(`responses are missing: ${method.toUpperCase()} ${path}`);
    }

    const locations = operationIds.get(operation.operationId) ?? [];
    locations.push(`${method.toUpperCase()} ${path}`);
    operationIds.set(operation.operationId, locations);
  }

  for (const [operationId, locations] of operationIds) {
    if (locations.length > 1) {
      fail(`duplicate operationId ${operationId}: ${locations.join(", ")}`);
    }
  }

  if (process.exitCode) {
    throw new Error("Generated OpenAPI contract did not satisfy the gate.");
  }

  console.log(
    `OpenAPI contract gate passed: ${pathEntries.length} paths, ${operations.length} operations, ${schemas.length} schemas.`,
  );
} finally {
  await app.close();
}
