-- The read-only role of the nightly backup, as ADR-0030 pins it: it reads
-- every table and sequence of public, private and auth and bypasses row level
-- security; it writes nothing anywhere, has nothing in vault, runs no
-- function in public or private, belongs to no role, and the Data API cannot
-- switch to it (NFR-REL-05, T-24).
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

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

-- Reads: every table, view and sequence of the three schemas a restore needs.
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
     and not has_sequence_privilege('backup_reader', c.oid, 'select')) as found),
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
     and (has_sequence_privilege('backup_reader', c.oid, 'update')
       or has_sequence_privilege('backup_reader', c.oid, 'usage'))) as found),
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

-- Vault: nothing at all, whether or not the extension is installed.
select is(
  (select coalesce(array_agg(name order by name), '{}')
   from (select format('%I.%I', n.nspname, c.relname) as name
   from pg_class as c join pg_namespace as n on n.oid = c.relnamespace
   where n.nspname = 'vault'
     and has_table_privilege('backup_reader', c.oid, 'select')) as found),
  '{}'::text[],
  '[T-24] backup_reader can read no table in vault'
);
select is(
  (select coalesce(bool_or(has_schema_privilege('backup_reader', n.oid, 'usage')), false)
   from pg_namespace as n where n.nspname = 'vault'),
  false,
  '[T-24] backup_reader cannot use the vault schema'
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

-- Membership: it belongs to no role, and no API role can become it.
select is(
  (select coalesce(array_agg(name order by name), '{}')
   from (select m.roleid::regrole::text as name
   from pg_auth_members as m where m.member = 'backup_reader'::regrole) as found),
  '{}'::text[],
  '[T-24] backup_reader is a member of no role (not postgres, authenticator or service_role)'
);
select is(
  (select coalesce(array_agg(name order by name), '{}')
   from (select r as name
   from unnest(array['authenticator', 'anon', 'authenticated', 'service_role']) as r
   where pg_has_role(r::name, 'backup_reader', 'member')) as found),
  '{}'::text[],
  '[T-24] the Data API cannot switch to backup_reader'
);

select * from finish();
rollback;
