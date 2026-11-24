-- One profile per user, created by a trigger when the user is created
-- (docs/spec/02-architecture.md sections 8, 8.2 and 8.3).

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  time_zone text not null default 'UTC' check (char_length(time_zone) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A learner, and an admin, reads and changes only their own row. Rows are
-- created by the trigger and removed with the user, so no insert or delete
-- policy exists.
create policy "users select own profile" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, time_zone) on table public.profiles to authenticated;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- The first display name is the name the sign-in provider gave, else the
-- part of the email before the at sign, cut to 40 characters.
create function private.create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      new.id::text
    ), 40)
  );
  return new;
end;
$$;

revoke all on function private.create_profile() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.create_profile();
