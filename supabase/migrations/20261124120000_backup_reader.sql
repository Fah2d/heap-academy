-- The read-only role the nightly backup connects as (ADR-0030; NFR-REL-05,
-- T-24). It reads every row of public, private and auth, so a dump keeps
-- accounts and the admin's second step, and it can change nothing.
--
-- Created without login. Its password is a secret of the `production-backup`
-- environment, so it never enters a migration: the owner turns login on and
-- sets it with psql's \password from the drill machine, never in the SQL
-- editor (docs/runbooks/restore.md section 2 step 4). A role with no
-- password cannot sign in.
--
-- Roles belong to the whole database cluster, not one database, so the role
-- may already exist (a local stack whose database was reset). A new role has
-- no superuser, create or replication right, and `postgres`, which is not a
-- superuser on Supabase, may not name those in `alter role`, so the create
-- states only what differs. A dump must read every row, so this role alone
-- bypasses row level security (accepted in ADR-0030). The database test pins
-- every attribute.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'backup_reader') then
    create role backup_reader nologin noinherit bypassrls;
  end if;
end
$$;

-- Read access to the three schemas a restore needs, tables and sequences.
grant usage on schema public, private, auth to backup_reader;
grant select on all tables in schema public, private, auth to backup_reader;
grant select on all sequences in schema public, private, auth to backup_reader;

-- Tables and sequences later migrations add to public and private are
-- readable too. Tables Supabase adds to auth are not covered: the database
-- test lists every auth table, so a new one fails the `db` job and the next
-- dump, never silently.
alter default privileges for role postgres in schema public, private
  grant select on tables to backup_reader;
alter default privileges for role postgres in schema public, private
  grant select on sequences to backup_reader;

-- No function in public or private runs as this role. Each function there
-- already revokes execute from public; this covers a direct grant.
revoke execute on all functions in schema public, private from backup_reader;
