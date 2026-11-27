-- The read-only role of the nightly backup, as ADR-0030 pins it after
-- decision P: through pg_read_all_data it reads every table and sequence of
-- public, private and auth and bypasses row level security; it writes
-- nothing anywhere, cannot decrypt Vault, runs no function in public or
-- private, belongs to pg_read_all_data and no other role, and the Data API
-- cannot switch to it (NFR-REL-05, T-24).
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

select has_role('backup_reader', '[T-24] the backup_reader role exists');

-- Attributes.
select is(
  (select rolbypassrls from pg_roles where rolname = 'backup_reader'),
  true,
  '[T-24] backup_reader bypasses row level security, so a dump reads every row'
);
select is(
  (select rolsuper or rolcreaterole or rolcreatedb or rolreplication
   from pg_roles where rolname = 'backup_reader'),
  false,
  '[T-24] backup_reader is not a superuser and cannot create roles or databases or replicate'
);
select is(
  (select rolcanlogin from pg_roles where rolname = 'backup_reader'),
  false,
  '[T-24] no migration lets backup_reader sign in: the owner sets its password outside the repository'
);

-- Every table of auth is either dumped or left out on purpose, so a table
-- the auth service adds fails here until someone decides which. The second
-- list must equal scripts/backup.sh's --exclude-table-data list
-- (scripts/backup.test.ts checks).
select is(
  (select coalesce(array_agg(c.relname::text order by c.relname), '{}')
   from pg_class as c join pg_namespace as n on n.oid = c.relnamespace
   where n.nspname = 'auth' and c.relkind in ('r', 'p')),
  (select array_agg(t order by t) from unnest(
    -- Dumped: accounts, their sign-in methods and second steps, and settings.
    array['custom_oauth_providers', 'identities', 'instances', 'mfa_factors',
      'mfa_recovery_code_sets', 'mfa_recovery_codes', 'oauth_clients', 'oauth_consents',
      'saml_providers', 'scim_users', 'sso_domains', 'sso_providers', 'users',
      'webauthn_credentials']
    -- Left out by scripts/backup.sh:
    || array['audit_log_entries', 'flow_state', 'mfa_amr_claims', 'mfa_challenges',
      'oauth_authorizations', 'oauth_client_states', 'one_time_tokens', 'refresh_tokens',
      'saml_relay_states', 'schema_migrations', 'scim_tokens', 'sessions',
      'webauthn_challenges']) as t),
  '[NFR-REL-05] [T-24] every auth table is either dumped or left out on purpose'
);
-- Reads: every table, view and sequence of the three schemas a restore needs.
-- A grant on a table is not enough: pg_dump must also use its schema, or it
-- stops with "permission denied for schema auth" (the local rehearsal of
-- 2026-11-26). auth belongs to supabase_admin, and postgres, which runs the
-- migrations, holds USAGE on it without the right to grant it.
select is(
  (select coalesce(array_agg(n order by n), '{}')
   from unnest(array['auth', 'private', 'public']) as n
   where not has_schema_privilege('backup_reader', n, 'usage')),
  '{}'::text[],
  '[NFR-REL-05] backup_reader can use public, private and auth, as pg_dump needs'
);
select is(
  (select coalesce(array_agg(name order by name), '{}')
   from (select format('%I.%I', n.nspname, c.relname) as name
   from pg_class as c join pg_namespace as n on n.oid = c.relnamespace
   where n.nspname in ('public', 'private', 'auth')
     and c.relkind in ('r', 'p', 'v', 'm', 'f')
     and not has_table_privilege('backup_reader', c.oid, 'select')) as found),
  '{}'::text[],
  '[NFR-REL-05] backup_reader can read every table and view in public, private and auth'
);
select is(
  (select coalesce(array_agg(name order by name), '{}')
   from (select format('%I.%I', n.nspname, c.relname) as name
   from pg_class as c join pg_namespace as n on n.oid = c.relnamespace
   where n.nspname in ('public', 'private', 'auth')
     and c.relkind = 'S'
     -- In a case, so the planner cannot call it on a table first.
     and case when c.relkind = 'S'
       then not has_sequence_privilege('backup_reader', c.oid, 'select') end) as found),
  '{}'::text[],
  '[NFR-REL-05] backup_reader can read every sequence in public, private and auth'
);
select ok(
  has_table_privilege('backup_reader', 'auth.users', 'select')
    and has_table_privilege('backup_reader', 'auth.identities', 'select')
    and has_table_privilege('backup_reader', 'auth.mfa_factors', 'select'),
  '[NFR-REL-05] backup_reader reads accounts, identities and second-step factors'
);
select ok(
  has_table_privilege('backup_reader', 'public.lesson_solutions', 'select')
    and has_table_privilege('backup_reader', 'public.admins', 'select'),
  '[NFR-REL-05] backup_reader reads the tables no other client role can'
);

-- A table or sequence a later migration adds to public or private is
-- readable without a new grant, and not writable.
create table public.backup_reader_probe (id integer primary key);
create table private.backup_reader_probe (id integer primary key);
create sequence private.backup_reader_probe_seq;
select ok(
  has_table_privilege('backup_reader', 'public.backup_reader_probe', 'select')
    and has_table_privilege('backup_reader', 'private.backup_reader_probe', 'select')
    and has_sequence_privilege('backup_reader', 'private.backup_reader_probe_seq', 'select'),
  '[NFR-REL-05] a table or sequence added to public or private later is readable by backup_reader'
);
select is(
  has_table_privilege('backup_reader', 'public.backup_reader_probe', 'insert')
    or has_table_privilege('backup_reader', 'private.backup_reader_probe', 'insert')
    or has_sequence_privilege('backup_reader', 'private.backup_reader_probe_seq', 'usage'),
  false,
  '[T-24] a table or sequence added to public or private later is not writable by backup_reader'
);
drop table public.backup_reader_probe;
drop table private.backup_reader_probe;
drop sequence private.backup_reader_probe_seq;

-- Writes: nothing, in any schema it can reach.
select is(
  (select coalesce(array_agg(name order by name), '{}')
   from (select format('%I.%I', n.nspname, c.relname) as name
   from pg_class as c join pg_namespace as n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p', 'v', 'm', 'f')
     and has_schema_privilege('backup_reader', n.oid, 'usage')
     and n.nspname !~ '^pg_(toast_)?temp_'
     -- Postgres grants UPDATE on this view to every role: it changes only the
     -- session's own settings, as SET does, and writes no row.
     and (n.nspname, c.relname) <> ('pg_catalog', 'pg_settings')
     and (has_table_privilege('backup_reader', c.oid, 'insert')
       or has_table_privilege('backup_reader', c.oid, 'update')
       or has_table_privilege('backup_reader', c.oid, 'delete')
       or has_table_privilege('backup_reader', c.oid, 'truncate')
       or has_table_privilege('backup_reader', c.oid, 'references')
       or has_table_privilege('backup_reader', c.oid, 'trigger')
       -- `maintain` exists from Postgres 17 only.
       or case when current_setting('server_version_num')::int >= 170000
            then has_table_privilege('backup_reader', c.oid, 'maintain')
            else false end)) as found),
  '{}'::text[],
  '[T-24] backup_reader cannot insert, update, delete, truncate, reference, trigger or maintain any table it can reach'
);
select is(
  (select coalesce(array_agg(name order by name), '{}')
   from (select format('%I.%I', n.nspname, c.relname) as name
   from pg_class as c join pg_namespace as n on n.oid = c.relnamespace
   where c.relkind = 'S'
     and has_schema_privilege('backup_reader', n.oid, 'usage')
     and n.nspname !~ '^pg_(toast_)?temp_'
     and case when c.relkind = 'S'
       then has_sequence_privilege('backup_reader', c.oid, 'update')
         or has_sequence_privilege('backup_reader', c.oid, 'usage') end) as found),
  '{}'::text[],
  '[T-24] backup_reader cannot move any sequence it can reach'
);
-- The session's own temp schema is left out: every role may create there,
-- and pgTAP keeps its own tables there.
select is(
  (select coalesce(array_agg(name order by name), '{}')
   from (select n.nspname::text as name
   from pg_namespace as n
   where n.nspname !~ '^pg_(toast_)?temp_'
     and has_schema_privilege('backup_reader', n.oid, 'create')) as found),
  '{}'::text[],
  '[T-24] backup_reader cannot create objects in any schema'
);

-- Vault: pg_read_all_data reads vault.secrets as ciphertext (accepted in
-- ADR-0030's amendment for decision P). Decrypting it, or writing a secret,
-- takes a function in vault, and the role can run none of them. The same
-- is checked by running as the role, at the end of this file.
select is(
  (select coalesce(array_agg(name order by name), '{}')
   from (select p.oid::regprocedure::text as name
   from pg_proc as p join pg_namespace as n on n.oid = p.pronamespace
   where n.nspname = 'vault'
     and has_function_privilege('backup_reader', p.oid, 'execute')) as found),
  '{}'::text[],
  '[T-24] backup_reader cannot execute any function in vault, so it cannot decrypt a secret'
);

-- Functions: none in public or private.
select is(
  (select coalesce(array_agg(name order by name), '{}')
   from (select p.oid::regprocedure::text as name
   from pg_proc as p join pg_namespace as n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private')
     and has_function_privilege('backup_reader', p.oid, 'execute')) as found),
  '{}'::text[],
  '[T-24] backup_reader cannot execute any function in public or private'
);

-- Membership: pg_read_all_data and nothing else, directly or through
-- another role, and no API role can become it.
select is(
  (select coalesce(array_agg(name order by name), '{}')
   from (select r.rolname::text as name
   from pg_roles as r
   where r.rolname <> 'backup_reader'
     and pg_has_role('backup_reader', r.oid, 'member')) as found),
  array['pg_read_all_data'],
  '[T-24] backup_reader belongs to pg_read_all_data and no other role (not postgres, authenticator or service_role)'
);
select is(
  (select array_agg(format('inherit=%s admin=%s', m.inherit_option::text, m.admin_option::text))
   from pg_auth_members as m
   where m.member = 'backup_reader'::regrole and m.roleid = 'pg_read_all_data'::regrole),
  array['inherit=true admin=false'],
  '[NFR-REL-05] [T-24] backup_reader inherits pg_read_all_data, so pg_dump reads without SET ROLE, and cannot grant it on'
);
select is(
  (select coalesce(array_agg(name order by name), '{}')
   from (select r as name
   from unnest(array['authenticator', 'anon', 'authenticated', 'service_role']) as r
   where pg_has_role(r::name, 'backup_reader', 'member')) as found),
  '{}'::text[],
  '[T-24] the Data API cannot switch to backup_reader'
);

-- The same, as the role itself. postgres holds backup_reader with the admin
-- option but without SET, so this transaction gives itself SET; the rollback
-- at the end takes it back. Every check above is unaffected: they ask about
-- backup_reader's rights, not postgres's.
grant backup_reader to postgres with set true, inherit false;
set local role backup_reader;
select lives_ok(
  'select count(*) from auth.users, public.lesson_solutions, vault.secrets',
  '[NFR-REL-05] as backup_reader, a read of auth, public and vault runs'
);
select throws_ok(
  'select decrypted_secret from vault.decrypted_secrets',
  '42501',
  'permission denied for function _crypto_aead_det_decrypt',
  '[T-24] as backup_reader, reading a decrypted Vault secret is refused'
);
select throws_ok(
  'insert into public.admins default values',
  '42501',
  null,
  '[T-24] as backup_reader, a write to public is refused'
);
select throws_ok(
  'delete from auth.users',
  '42501',
  null,
  '[T-24] as backup_reader, a write to auth is refused'
);
reset role;

select * from finish();
rollback;
