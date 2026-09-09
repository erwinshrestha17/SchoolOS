import { cpSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const shouldBuild = process.argv.includes('--build');

if (shouldBuild) {
  const nextBin = resolve('node_modules/next/dist/bin/next');
  const result = spawnSync(process.execPath, [nextBin, 'build'], {
    env: process.env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const standaloneRoot = resolve('.next/standalone/apps/web');
const standaloneServer = resolve(standaloneRoot, 'server.js');

if (!existsSync(standaloneServer)) {
  throw new Error(
    'Missing standalone web artifact. Run the SchoolOS web build before starting Playwright.',
  );
}

cpSync(resolve('.next/static'), resolve(standaloneRoot, '.next/static'), {
  force: true,
  recursive: true,
});

if (existsSync(resolve('public'))) {
  cpSync(resolve('public'), resolve(standaloneRoot, 'public'), {
    force: true,
    recursive: true,
  });
}

process.env.PORT = process.env.SCHOOLOS_WEB_E2E_PORT ?? '3101';
process.env.HOSTNAME = 'localhost';

await import(pathToFileURL(standaloneServer).href);
