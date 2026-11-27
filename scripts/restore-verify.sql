-- The verification of a restore drill (ADR-0030, NFR-REL-05; runbook
-- docs/runbooks/restore.md section 4). Run on the drill machine, against the
-- restored database:
--
--   psql -v ON_ERROR_STOP=1 -v lesson=<a published lesson's slug> \
--     -f scripts/restore-verify.sql <database URL>
--
-- It prints the row counts to compare with the production dashboard, then
-- fails with the reason if no account, no admin, or no published lesson was
-- restored, if the named lesson is not published with its solution, or if a
-- table in public lost row level security, or one that needs a policy has
-- none.

\set QUIET on
select set_config('restore_verify.lesson', :'lesson', false) \g /dev/null
\set QUIET off

select 'auth.users' as rows_of, count(*) as count from auth.users
union all select 'auth.identities', count(*) from auth.identities
union all select 'auth.mfa_factors', count(*) from auth.mfa_factors
union all select 'public.admins', count(*) from public.admins
union all select 'public.profiles', count(*) from public.profiles
union all select 'public.courses', count(*) from public.courses
union all select 'public.chapters', count(*) from public.chapters
union all select 'public.lessons', count(*) from public.lessons
union all select 'public.lesson_solutions', count(*) from public.lesson_solutions
union all select 'public.completions', count(*) from public.completions;

do $verify$
declare
  wanted text := current_setting('restore_verify.lesson');
  unprotected text;
begin
  if (select count(*) from auth.users) = 0 then
    raise exception 'restore check failed: auth.users is empty';
  end if;
  if (select count(*) from public.admins) = 0 then
    raise exception 'restore check failed: public.admins is empty';
  end if;
  if not exists (
    select 1 from public.admins a join auth.users u on u.id = a.user_id
  ) then
    raise exception 'restore check failed: no admin row points at a restored account';
  end if;
  if not exists (select 1 from public.lessons where status = 'published') then
    raise exception 'restore check failed: no published lesson';
  end if;
  if not exists (
    select 1
    from public.lessons l
    join public.lesson_solutions s on s.lesson_id = l.id
    where l.slug = wanted and l.status = 'published'
  ) then
    raise exception 'restore check failed: the lesson % is not published with its solution', wanted;
  end if;
  select string_agg(c.relname, ', ' order by c.relname) into unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (not c.relrowsecurity
      -- admins is read only through private.is_admin(), so it has no policy
      -- by design (supabase/migrations/20261120120000_admins.sql).
      or (c.relname <> 'admins' and not exists (
        select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)));
  if unprotected is not null then
    raise exception 'restore check failed: without row level security or a policy: %', unprotected;
  end if;
  raise notice 'restore check passed: accounts, the admin, the lesson % and every policy', wanted;
end
$verify$;
