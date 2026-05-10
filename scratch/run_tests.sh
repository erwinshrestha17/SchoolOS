#!/bin/bash
export COREPACK_ENABLE_STRICT=0
export COREPACK_ENABLE_AUTO_PIN=0
# Try to find jest in the root node_modules
JEST_BIN="./node_modules/.bin/jest"
if [ ! -f "$JEST_BIN" ]; then
  JEST_BIN="./node_modules/.pnpm/node_modules/.bin/jest"
fi

if [ ! -f "$JEST_BIN" ]; then
  echo "Jest binary not found"
  exit 1
fi

$JEST_BIN "$@"
