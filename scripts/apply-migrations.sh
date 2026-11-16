#!/bin/sh
# Applies supabase/migrations to the database that SUPABASE_DB_URL names. The
# deploy workflow runs it against staging, then production
# (docs/spec/07-operations.md section 3). Already-applied migrations are
# skipped, so a re-run is safe. The URL holds a password: it is never printed.
set -eu

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "apply-migrations: SUPABASE_DB_URL is not set." >&2
  exit 1
fi

if ! ls supabase/migrations/*.sql >/dev/null 2>&1; then
  echo "apply-migrations: no migrations in supabase/migrations; nothing to apply."
  exit 0
fi

supabase db push --db-url "$SUPABASE_DB_URL"
