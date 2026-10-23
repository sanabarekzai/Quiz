#!/usr/bin/env bash
set -euo pipefail

npm ci --no-audit --no-fund
psql "${DATABASE_URL:?DATABASE_URL is required for development schema setup}" -v ON_ERROR_STOP=1 -f db/schema.sql
psql "${DATABASE_URL:?DATABASE_URL is required for development schema setup}" -v ON_ERROR_STOP=1 -f db/seed-study-personality.sql
npm test
