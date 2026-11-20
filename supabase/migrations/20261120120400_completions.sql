-- Completions, insert only, with XP and time set by the database
-- (docs/spec/02-architecture.md sections 8, 8.1, 8.2 and 8.3; FR-PRG-04,
-- FR-PRG-07, FR-ADM-09, FR-ADM-13; T-10).

create table public.completions (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- A lesson with completions cannot be deleted; it can be archived.
  lesson_id uuid not null references public.lessons (id) on delete restrict,
  completed_at timestamptz not null default now(),
  xp integer not null check (xp between 5 and 50),
  code text not null default '' check (char_length(code) <= 20000),
  primary key (user_id, lesson_id)
);

create index completions_lesson_id on public.completions (lesson_id);

alter table public.completions enable row level security;

create policy "learners select own completions" on public.completions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "learners insert own completion for published lesson" on public.completions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.lessons
      join public.courses on courses.id = lessons.course_id
      where lessons.id = completions.lesson_id
        and lessons.status = 'published'
        and courses.status = 'published'
    )
  );

revoke all on table public.completions from anon, authenticated;
grant select, insert on table public.completions to authenticated;

-- XP comes from the lesson whatever the caller sends, and a completion is
-- never in the future. It reads the lesson as the caller, so a lesson the
-- caller may not see is not found, and the insert is refused.
create function private.completions_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  lesson_xp integer;
begin
  select xp into lesson_xp from public.lessons where id = new.lesson_id;
  if lesson_xp is null then
    raise exception 'lesson_not_found' using errcode = 'P0001';
  end if;
  new.xp := lesson_xp;
  new.completed_at := least(coalesce(new.completed_at, now()), now());
  return new;
end;
$$;

revoke all on function private.completions_before_insert() from public;

create trigger completions_before_insert
  before insert on public.completions
  for each row execute function private.completions_before_insert();

-- Counts per lesson for the dashboard (FR-ADM-13). Security definer so it can
-- count every learner's rows; it answers only an admin.
create function public.lesson_completion_counts()
returns table (lesson_id uuid, completions bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return query
    select c.lesson_id, count(*)::bigint
    from public.completions as c
    group by c.lesson_id;
end;
$$;

revoke all on function public.lesson_completion_counts() from public, anon;
grant execute on function public.lesson_completion_counts() to authenticated;
