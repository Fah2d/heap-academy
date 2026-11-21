-- Versions for the course editor's stale-save refusal (FR-ADM-10,
-- docs/spec/03-experience.md section 7.3): a save carries the updated_at the
-- editor loaded, and the row is written only if it still has it.
--
-- 1. Chapters get updated_at from the server's clock, so a rename from a
--    stale tab is refused instead of overwriting a newer one.
-- 2. Moving a course or a chapter (Move up, Move down) changes only its
--    position, which no editor holds as typed text. Such a move keeps the
--    row's updated_at, so an editor open in another tab can still save.

alter table public.chapters
  add column updated_at timestamptz not null default now();

create function private.chapters_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and (to_jsonb(new) - 'position' - 'updated_at') = (to_jsonb(old) - 'position' - 'updated_at')
  then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger chapters_before_write
  before insert or update on public.chapters
  for each row execute function private.chapters_before_write();

revoke all on function private.chapters_before_write() from public;

-- The course trigger of 20261120120200_content.sql, unchanged except that a
-- change of position alone keeps updated_at.
create or replace function private.courses_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
  else
    new.created_at := old.created_at;
    if (to_jsonb(new) - 'position' - 'updated_at' - 'created_at')
      = (to_jsonb(old) - 'position' - 'updated_at' - 'created_at')
    then
      new.updated_at := old.updated_at;
    else
      new.updated_at := now();
    end if;
  end if;

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

revoke all on function private.courses_before_write() from public;
