# Security review 6: WP-7.3 part 3, after the round 5 fixes

- Reviewer: `security-reviewer`, same agent as round 5, re-reading both files.
- Range: the same two files, uncommitted, after the round 5 fixes.
- Date: 2026-11-24.

Verdict: APPROVE

## Round 5 findings

1 to 5: FIXED. The role is created with `nologin noinherit bypassrls` and nothing else, and no `alter role` remains; the test pins every attribute, so a leftover local role with other attributes fails. The temp-schema pattern matches `pg_temp_N` and `pg_toast_temp_N` and is applied to the write, sequence and `CREATE` checks. 18 assertions match `plan(18)`. The probes need the runner to be `postgres`, the same as the default privileges, and are dropped inside the rolled-back transaction.

## New findings

1. **MINOR**, test lines 93-98. `maintain` is still unchecked on Postgres 17. Guard it on the server version with `case when current_setting('server_version_num')::int >= 170000 then has_table_privilege(...) else false end`. Leaving it out is acceptable: nothing grants it.
2. **MINOR**, note only. The `CREATE` check fails if Supabase gives `PUBLIC` the `CREATE` right on any schema. That would be a real finding about the stack; read the schema name in the output before changing the test.

## Not run

`pnpm test:db`. The CI `db` job is the first real run.

## Resolution

1 added after this round with the `case` guard; that line was not reviewed again. 2 needs no change.
