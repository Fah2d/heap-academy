-- The admin allow-list and the one admin test every policy uses
-- (docs/spec/02-architecture.md sections 8, 8.2 and 8.3; ADR-0025).

create schema private;
revoke all on schema private from public;

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Rows are added by SQL, never by the app: no client policy at all.
alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;

-- An admin is a user in `admins` whose session carries assurance level aal2,
-- which Supabase sets only after the second sign-in step (E-20). A session
-- without an `aal` claim is at aal1.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and exists (
      select 1 from public.admins where user_id = (select auth.uid())
    );
$$;

revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
