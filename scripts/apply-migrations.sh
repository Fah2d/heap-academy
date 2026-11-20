#!/bin/sh
# Applies supabase/migrations to the database that SUPABASE_DB_URL names. The
# deploy workflow runs it against staging, then production
# (docs/spec/07-operations.md section 3). Already-applied migrations are
# skipped, so a re-run is safe. The URL holds a password: it is masked in the
# workflow log and never printed, and the connection must use TLS.
set -eu

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "apply-migrations: SUPABASE_DB_URL is not set." >&2
  exit 1
fi

if [ -n "${GITHUB_ACTIONS:-}" ]; then
  password=$(node -e 'process.stdout.write(decodeURIComponent(new URL(process.argv[1]).password))' "$SUPABASE_DB_URL")
  if [ -n "$password" ]; then echo "::add-mask::$password"; fi
fi

case "$SUPABASE_DB_URL" in
  *sslmode=require* | *sslmode=verify-full*) ;;
  *)
    echo "apply-migrations: SUPABASE_DB_URL must end with ?sslmode=require (see docs/runbooks/infrastructure-setup.md)." >&2
    exit 1
    ;;
esac

if ! ls supabase/migrations/*.sql >/dev/null 2>&1; then
  echo "apply-migrations: no migrations in supabase/migrations; nothing to apply."
  exit 0
fi

supabase db push --db-url "$SUPABASE_DB_URL"
