import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const client = readFileSync(join(webRoot, 'lib/api/client.ts'), 'utf8');

describe('Phase 7.12 stable API reason codes', () => {
  it('carries the server meta.code on ApiRequestError', () => {
    assert.match(client, /code\?: string;/);
    assert.match(client, /export function parseApiErrorCode\(text: string\)/);
    assert.match(client, /\.meta\s*\?\.code/);
    assert.match(client, /responseRequestId,\s*parseApiErrorCode\(text\),/);
  });
});
