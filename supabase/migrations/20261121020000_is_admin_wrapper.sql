-- The admin check as the data API can reach it (docs/spec/02-architecture.md
-- sections 9.1 and 11.2). The API exposes only `public`, and
-- `private.is_admin()` stays where it is: this wrapper runs with the caller's
-- rights and answers for the caller's own session only. The server action
-- wrapper asks it before an admin action; the policies do not use it.

create function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
