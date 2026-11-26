#!/usr/bin/env bash
# The nightly backup of ADR-0030, run by .github/workflows/backup.yml.
#
#   backup.sh recipient          prints the committed age recipient after it
#                                matches BACKUP_AGE_RECIPIENT
#   backup.sh dump <file>        dumps the data of public, private and auth as
#                                backup_reader and writes only the age
#                                ciphertext to <file>
#
# The connection comes in parts, from the environment: BACKUP_DB_HOST,
# BACKUP_DB_PORT (default 5432, the session pooler), BACKUP_DB_NAME (default
# postgres), BACKUP_DB_USER and BACKUP_DB_PASSWORD. The password reaches
# pg_dump only as PGPASSWORD, never on a command line, and this script never
# prints it, a connection string, or pg_dump's own words, which can name the
# host and the user. No `set -x`. The plaintext dump goes through a pipe
# straight into age; it never touches the disk.
#
# Exit codes: 0 done, 1 a check or the dump failed, 2 usage error.
set -euo pipefail
umask 077

RECIPIENT_FILE="${BACKUP_RECIPIENT_FILE:-ops/backup-recipient.age.pub}"
AGE_HEADER="age-encryption.org/v1"

fail() {
  printf 'backup: %s\n' "$1" >&2
  exit 1
}

# The committed public key, checked against the production-backup
# environment's copy: a key changed in one place only fails the run.
recipient() {
  [[ -f "$RECIPIENT_FILE" ]] || fail "no committed recipient key at $RECIPIENT_FILE"
  local committed expected
  committed="$(tr -d '[:space:]' <"$RECIPIENT_FILE")"
  [[ "$committed" =~ ^age1[02-9ac-hj-np-z]{58}$ ]] || fail "the committed recipient is not an age public key"
  expected="$(printf '%s' "${BACKUP_AGE_RECIPIENT:-}" | tr -d '[:space:]')"
  [[ -n "$expected" ]] || fail "BACKUP_AGE_RECIPIENT is not set"
  [[ "$committed" == "$expected" ]] || fail "the committed recipient differs from the production-backup environment's"
  printf '%s\n' "$committed"
}

dump() {
  local out="$1"
  local name
  for name in BACKUP_DB_HOST BACKUP_DB_USER BACKUP_DB_PASSWORD; do
    [[ -n "${!name:-}" ]] || fail "$name is not set"
  done
  [[ ! -e "$out" ]] || fail "the output file already exists"
  local key
  key="$(recipient)"
  # The host and the user are environment variables, not secrets, so the
  # runner does not hide them by itself. The password is a secret, which it
  # hides already, so it is never printed here, not even to mask it.
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    printf '::add-mask::%s\n' "$BACKUP_DB_HOST" "$BACKUP_DB_USER"
  fi
  local status=0
  # Data only: a restore goes into a database whose migrations made the
  # schema; it runs with session_replication_role=replica, so triggers do not
  # fire twice (docs/runbooks/restore.md). auth.schema_migrations belongs to
  # the auth service of the target, so its rows stay out.
  PGHOST="$BACKUP_DB_HOST" \
    PGPORT="${BACKUP_DB_PORT:-5432}" \
    PGDATABASE="${BACKUP_DB_NAME:-postgres}" \
    PGUSER="$BACKUP_DB_USER" \
    PGPASSWORD="$BACKUP_DB_PASSWORD" \
    PGSSLMODE="${BACKUP_DB_SSLMODE:-require}" \
    PGCONNECT_TIMEOUT=30 \
    pg_dump --data-only --no-owner --no-privileges \
    --schema=public --schema=private --schema=auth \
    --exclude-table-data=auth.schema_migrations \
    2>/dev/null | age --encrypt --recipient "$key" --output "$out" || status=$?
  if [[ "$status" -ne 0 ]]; then
    rm -f "$out"
    fail "the dump failed (exit $status); pg_dump's message is not printed, because it can name the host and the user"
  fi
  [[ -s "$out" ]] || fail "the dump is empty"
  [[ "$(head -c ${#AGE_HEADER} "$out")" == "$AGE_HEADER" ]] || {
    rm -f "$out"
    fail "the output is not age ciphertext"
  }
  printf 'backup: wrote %s bytes of age ciphertext\n' "$(wc -c <"$out" | tr -d ' ')"
}

case "${1:-}" in
  recipient)
    [[ $# -eq 1 ]] || {
      echo "usage: backup.sh recipient | dump <file>" >&2
      exit 2
    }
    recipient
    ;;
  dump)
    [[ $# -eq 2 ]] || {
      echo "usage: backup.sh recipient | dump <file>" >&2
      exit 2
    }
    dump "$2"
    ;;
  *)
    echo "usage: backup.sh recipient | dump <file>" >&2
    exit 2
    ;;
esac
