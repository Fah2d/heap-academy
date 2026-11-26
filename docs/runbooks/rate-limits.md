# Runbook: per-action rate limits

How to set up and change the Postgres counters that limit each server action and the report endpoint `/api/csp-report` per network address (an IPv6 address by its /64 prefix) (T-14 in `docs/spec/06-security-privacy.md`, `docs/spec/07-operations.md` section 7, ADR-0029). The firewall rule on every path is separate and is set in the Vercel dashboard.

The action wrapper signs each count with `ACTION_COUNTER_KEY`. The database checks that signature against the Vault secret `action_counter_key`. The two values must be the same, or no server action runs: every action then answers "unavailable", the report endpoint answers 503, and the logs show `error:counter-unavailable`. Sign-out is never counted, so it works even then. A deployment on Vercel refuses to start with the public local value from `.env.example`.

Run every SQL step in the Supabase dashboard of the project named in the step, under **SQL Editor**. Never run it from the development machine (CLAUDE.md rule 10).

## 1. Set the key (once per project, before the migration is deployed)

Do this for staging and for production. Each project gets its own key.

1. [ ] Make a random key of 64 hex characters on your own computer: `openssl rand -hex 32`. Do not paste it into a chat, an issue or a file in the repository.
2. [ ] In the Supabase dashboard of the project, under **SQL Editor**, run this with the key in place of `<key>`:

   ```sql
   select vault.create_secret('<key>', 'action_counter_key');
   ```

   If it says the name exists, change the key instead (section 2).
3. [ ] In Vercel, under **Settings → Environment Variables**, add `ACTION_COUNTER_KEY` with the same key, marked **Sensitive**, for the environment that uses this Supabase project (Preview for staging, Production for production).
4. [ ] Deploy. Then sign in on that site: a sign-in that works shows that the key matches.

## 2. Change the key

1. [ ] Make a new key as in section 1 step 1.
2. [ ] In **SQL Editor**:

   ```sql
   select vault.update_secret(
     (select id from vault.secrets where name = 'action_counter_key'),
     '<new key>'
   );
   ```

3. [ ] Set the same value in Vercel and redeploy at once. Between the two steps, server actions answer "unavailable".

## 3. The local stack and CI

`supabase start` stores `ACTION_COUNTER_KEY` from the shell as the Vault secret (`supabase/config.toml`, `[db.vault]`). Export the value from `.env.example` before you start the stack. If the stack was started without it, run `supabase stop` and start it again with the variable set. CI sets the same local value in `.github/workflows/ci.yml`. That value is not a secret and protects nothing.

## 4. Change a limit

The limits are in code: `DEFAULT_PER_MINUTE` and `SIGN_IN_PER_MINUTE` in `src/infrastructure/actions/action-counter.ts`, and an action's own `perMinute`. A change goes through a pull request. The database accepts any limit from 1 to 10,000.

## 5. When someone is refused

A refused call logs `error:rate-limited` with the action's route; a refused report gets 429. The counter keeps only the current minute, so a person who is refused can try again within a minute. The table stores an HMAC of each address, never the address itself, so it cannot tell you who was refused.
