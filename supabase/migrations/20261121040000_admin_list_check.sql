-- Whether the caller is on the admin list, at any assurance level
-- (docs/spec/02-architecture.md section 11.2; FR-ADM-01, FR-ADM-02).
--
-- The `/admin` guard must tell an admin who has not passed the second step
-- (sent to setup or verify) from everyone else (the not-found page). The
-- caller's session cannot read `admins`, which has no client policy, and
-- `private.is_admin()` answers false below aal2. So this function reads the
-- caller's own row with the owner's rights and returns one boolean about the
-- caller only. It grants nothing: every policy still asks `private.is_admin()`,
-- which requires aal2. The public wrapper is the only door the data API has.

create function private.is_on_admin_list()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_on_admin_list() from public;
grant execute on function private.is_on_admin_list() to authenticated;

create function public.is_on_admin_list()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_on_admin_list();
$$;

revoke all on function public.is_on_admin_list() from public, anon;
grant execute on function public.is_on_admin_list() to authenticated;
