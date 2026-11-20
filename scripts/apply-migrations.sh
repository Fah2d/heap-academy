#!/bin/sh
# Applies supabase/migrations to the database that SUPABASE_DB_URL names. The
# deploy workflow runs it against staging, then production
# (docs/spec/07-operations.md section 3). Already-applied migrations are
# skipped, so a re-run is safe. The URL holds a password: it is masked in the
# workflow log and never printed, and the connection must use TLS.
#
# `--include-seed` also runs supabase/seed.sql. Only the staging step passes
# it: production is never seeded (.claude/rules/database.md). So that a wrong
# URL in the staging environment cannot seed production, it also needs
# SEED_PROJECT_REF, the staging project's reference, and refuses a URL that
# does not name it. The CLI records each seed file it has run and runs it
# once; the seed also skips itself when the sample course exists.
set -eu

seed=no
case "${1:-}" in
  "") ;;
  --include-seed) seed=yes ;;
  *)
    echo "apply-migrations: unknown option $1; the only one is --include-seed." >&2
    exit 1
    ;;
esac

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

if [ "$seed" = yes ]; then
  if [ -z "${SEED_PROJECT_REF:-}" ]; then
    echo "apply-migrations: --include-seed needs SEED_PROJECT_REF, the staging project's reference." >&2
    exit 1
  fi
  case "$SUPABASE_DB_URL" in
    *"$SEED_PROJECT_REF"*) ;;
    *)
      echo "apply-migrations: SUPABASE_DB_URL does not name the project in SEED_PROJECT_REF; not seeding." >&2
      exit 1
      ;;
  esac
fi

if ! ls supabase/migrations/*.sql >/dev/null 2>&1; then
  echo "apply-migrations: no migrations in supabase/migrations; nothing to apply."
  exit 0
fi

if [ "$seed" = yes ]; then
  supabase db push --db-url "$SUPABASE_DB_URL" --include-seed
else
  supabase db push --db-url "$SUPABASE_DB_URL"
fi
