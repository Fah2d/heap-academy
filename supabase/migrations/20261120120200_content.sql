-- Courses, chapters, lessons and their admin-only solutions
-- (docs/spec/02-architecture.md sections 7, 8, 8.2 and 8.3;
-- docs/spec/04-content-system.md section 1; ADR-0024, ADR-0026).

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (char_length(slug) <= 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 60),
  summary text not null check (char_length(summary) between 1 and 140),
  outcomes jsonb not null default '[]' check (private.valid_text_list(outcomes, 5, 140)),
  position integer not null default 0 check (position >= 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  title text not null check (char_length(title) between 1 and 60),
  summary text not null default '' check (char_length(summary) <= 140),
  position integer not null default 0 check (position >= 0),
  -- The target of the lessons' (chapter, course) key.
  unique (id, course_id)
);

create index chapters_course_id on public.chapters (course_id);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  chapter_id uuid not null,
  slug text not null
    check (char_length(slug) <= 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 60),
  position integer not null default 0 check (position >= 0),
  xp integer not null default 10 check (xp between 5 and 50),
  instructions_md text not null default '' check (char_length(instructions_md) <= 20000),
  hints jsonb not null default '[]' check (private.valid_text_list(hints, 5, 300)),
  starter_code text not null default '' check (char_length(starter_code) <= 10000),
  tests jsonb not null default '[]' check (private.valid_test_cases(tests)),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  gradable_changed_at timestamptz not null default now(),
  validated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug),
  -- The chapter must belong to the course. A chapter with lessons cannot be
  -- deleted.
  foreign key (chapter_id, course_id) references public.chapters (id, course_id)
    on delete restrict
);

create index lessons_chapter_course on public.lessons (chapter_id, course_id);

create table public.lesson_solutions (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  solution_code text not null default '' check (char_length(solution_code) <= 10000),
  wrong_answers jsonb not null default '[]' check (private.valid_wrong_answers(wrong_answers)),
  updated_at timestamptz not null default now()
);

-- Row level security: default deny, then one policy per operation and role.

alter table public.courses enable row level security;
alter table public.chapters enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_solutions enable row level security;

create policy "everyone selects published courses" on public.courses
  for select to anon, authenticated
  using (status = 'published');
create policy "admins select courses" on public.courses
  for select to authenticated using ((select private.is_admin()));
create policy "admins insert courses" on public.courses
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins update courses" on public.courses
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete courses" on public.courses
  for delete to authenticated using ((select private.is_admin()));

create policy "everyone selects chapters of published courses" on public.chapters
  for select to anon, authenticated
  using (exists (
    select 1 from public.courses
    where courses.id = chapters.course_id and courses.status = 'published'
  ));
create policy "admins select chapters" on public.chapters
  for select to authenticated using ((select private.is_admin()));
create policy "admins insert chapters" on public.chapters
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins update chapters" on public.chapters
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete chapters" on public.chapters
  for delete to authenticated using ((select private.is_admin()));

create policy "everyone selects published lessons of published courses" on public.lessons
  for select to anon, authenticated
  using (status = 'published' and exists (
    select 1 from public.courses
    where courses.id = lessons.course_id and courses.status = 'published'
  ));
create policy "admins select lessons" on public.lessons
  for select to authenticated using ((select private.is_admin()));
create policy "admins insert lessons" on public.lessons
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins update lessons" on public.lessons
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete lessons" on public.lessons
  for delete to authenticated using ((select private.is_admin()));

-- Solutions and wrong answers: admins only, for every operation.
create policy "admins select lesson solutions" on public.lesson_solutions
  for select to authenticated using ((select private.is_admin()));
create policy "admins insert lesson solutions" on public.lesson_solutions
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins update lesson solutions" on public.lesson_solutions
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete lesson solutions" on public.lesson_solutions
  for delete to authenticated using ((select private.is_admin()));

revoke all on table public.lesson_solutions from anon;

-- Triggers.

-- Courses: the server's clock, and a course needs a published lesson to be
-- published (section 8.3, publish guard).
create function private.courses_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();

  if new.status = 'published'
    and (tg_op = 'INSERT' or old.status is distinct from 'published')
    and not exists (
      select 1 from public.lessons
      where lessons.course_id = new.id and lessons.status = 'published'
    )
  then
    raise exception 'course_has_no_published_lesson' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger courses_before_write
  before insert or update on public.courses
  for each row execute function private.courses_before_write();

-- Lessons: the columns only the server sets, then the publish rule of
-- section 7.2. gradable_changed_at moves to now() when the starter or the
-- test cases change, or when the solution trigger below asks for it by
-- setting it to now(); a caller cannot move it back. validated_at changes
-- only through save_lesson, which names the lesson in a transaction setting.
create function private.lessons_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  validating boolean :=
    coalesce(current_setting('heap.validated_lesson', true), '') = new.id::text;
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.gradable_changed_at := now();
    if new.validated_at is not null and not (validating and new.validated_at = now()) then
      raise exception 'validated_at_set_outside_save_lesson' using errcode = 'P0001';
    end if;
    new.published_at := case when new.status = 'published' then now() end;
  else
    new.created_at := old.created_at;
    if new.starter_code is distinct from old.starter_code
      or new.tests is distinct from old.tests
      or new.gradable_changed_at = now()
    then
      new.gradable_changed_at := now();
    else
      new.gradable_changed_at := old.gradable_changed_at;
    end if;
    if new.validated_at is distinct from old.validated_at
      and not (validating and new.validated_at = now())
    then
      raise exception 'validated_at_set_outside_save_lesson' using errcode = 'P0001';
    end if;
    new.published_at := case
      when new.status = 'published' and old.status is distinct from 'published' then now()
      else old.published_at
    end;
  end if;
  new.updated_at := now();

  if new.status = 'published'
    and (new.validated_at is null or new.validated_at < new.gradable_changed_at)
  then
    raise exception 'lesson_not_validated' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger lessons_before_write
  before insert or update on public.lessons
  for each row execute function private.lessons_before_write();

-- A change to the solution or the wrong answers is a gradable change of the
-- lesson (section 8.3). The lesson's own trigger then applies the publish
-- rule, so a published lesson's solution changes only with a validation.
create function private.lesson_solutions_after_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.solution_code is not distinct from old.solution_code
    and new.wrong_answers is not distinct from old.wrong_answers
  then
    return null;
  end if;
  update public.lessons
  set gradable_changed_at = now()
  where id = case when tg_op = 'DELETE' then old.lesson_id else new.lesson_id end;
  return null;
end;
$$;

create trigger lesson_solutions_after_write
  after insert or update or delete on public.lesson_solutions
  for each row execute function private.lesson_solutions_after_write();

create trigger lesson_solutions_touch_updated_at
  before update on public.lesson_solutions
  for each row execute function private.touch_updated_at();

revoke all on function private.courses_before_write() from public;
revoke all on function private.lessons_before_write() from public;
revoke all on function private.lesson_solutions_after_write() from public;
