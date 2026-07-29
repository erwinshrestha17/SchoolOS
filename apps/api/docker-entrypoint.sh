#!/bin/sh
set -eu

echo "Running database migrations before API startup..."
node ./node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma

echo "Starting SchoolOS API..."
exec "$@"
