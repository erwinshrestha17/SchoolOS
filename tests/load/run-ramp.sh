#!/usr/bin/env bash
# Concurrency ramp against a single endpoint using autocannon.
#
# This is the *smoke-grade* harness used to find the first bottleneck quickly.
# The full scenario suite lives in tests/load/k6/ — see LOAD_TEST_PLAN.md.
#
# Usage:
#   tests/load/run-ramp.sh <path> [duration] [concurrency-list]
#
# Example:
#   tests/load/run-ramp.sh /api/v1/mobile/me/notifications/unread-count 15 "10 50 100 200"
#
# Requires: PERF_ACCESS_TOKEN in the environment (see tests/load/README.md).
set -euo pipefail

PATH_UNDER_TEST="${1:?usage: run-ramp.sh <path> [duration] [concurrency-list]}"
DURATION="${2:-15}"
LEVELS="${3:-10 25 50 100 200}"
BASE_URL="${PERF_BASE_URL:-http://localhost:4000}"
TOKEN="${PERF_ACCESS_TOKEN:?PERF_ACCESS_TOKEN is required}"
OUT_DIR="${PERF_OUT_DIR:-$(dirname "$0")/results}"

mkdir -p "$OUT_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
SUMMARY="$OUT_DIR/ramp-$STAMP.tsv"

printf 'concurrency\trps\tp50_ms\tp97_5_ms\tp99_ms\tmax_ms\tnon2xx\ttimeouts\n' > "$SUMMARY"

echo "Ramp: $PATH_UNDER_TEST  (${DURATION}s per level)"
echo "Output: $SUMMARY"
echo

for c in $LEVELS; do
  raw="$OUT_DIR/raw-$STAMP-c$c.json"
  autocannon -c "$c" -d "$DURATION" -j \
    -H "Authorization=Bearer $TOKEN" \
    -H "User-Agent=Dart/3.0 (dart:io)" \
    "$BASE_URL$PATH_UNDER_TEST" > "$raw" 2>/dev/null

  node -e '
    const path = require("path");
    const r = require(path.resolve(process.argv[1]));
    const row = [
      process.argv[2],
      Math.round(r.requests.average),
      r.latency.p50, r.latency.p97_5, r.latency.p99, r.latency.max,
      r.non2xx ?? 0,
      r.timeouts ?? 0,
    ].join("\t");
    console.log(row);
  ' "$raw" "$c" | tee -a "$SUMMARY"
done

echo
echo "--- summary ---"
column -t "$SUMMARY"
