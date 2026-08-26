import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isOfflineReadCacheRecordFresh,
  isOfflineReadTransportError,
  OFFLINE_READ_MAX_AGE_MS,
} from "../lib/offline-read-cache.ts";

test("offline reads fall back only for transport failures", () => {
  assert.equal(isOfflineReadTransportError(new TypeError("fetch failed")), true);
  assert.equal(
    isOfflineReadTransportError(
      Object.assign(new Error("Forbidden"), { statusCode: 403 }),
    ),
    false,
  );
  assert.equal(isOfflineReadTransportError(new Error("Server failed")), false);
});

test("a cache write failure cannot replace an authoritative response", async () => {
  const source = await readFile(
    new URL("../lib/offline-read-cache.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /const payload = await fetcher\(\);[\s\S]*try \{[\s\S]*await writeOfflineReadCache\([\s\S]*\} catch \{[\s\S]*Cache persistence must not hide a successful authoritative response\.[\s\S]*return payload;/,
  );
});

test("offline read records expire at the bounded lease horizon", () => {
  const now = new Date("2026-08-26T08:00:00.000Z");
  assert.equal(
    isOfflineReadCacheRecordFresh(
      { savedAt: new Date(now.getTime() - OFFLINE_READ_MAX_AGE_MS).toISOString() },
      now,
    ),
    true,
  );
  assert.equal(
    isOfflineReadCacheRecordFresh(
      {
        savedAt: new Date(
          now.getTime() - OFFLINE_READ_MAX_AGE_MS - 1,
        ).toISOString(),
      },
      now,
    ),
    false,
  );
  assert.equal(
    isOfflineReadCacheRecordFresh(
      { savedAt: new Date(now.getTime() + 1).toISOString() },
      now,
    ),
    false,
  );
});
