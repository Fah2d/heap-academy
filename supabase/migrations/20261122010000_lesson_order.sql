-- The lessons' own order inside a chapter (docs/spec/03-experience.md section
-- 7.3, FR-ADM-03; the `reorder` action of docs/spec/02-architecture.md
-- section 9.1), as 20261121060000_reorder.sql did for courses and chapters.
--
-- 1. reorder_lessons takes the chapter's full new order and rewrites the
--    positions in one statement, or refuses with order_out_of_date.
-- 2. The lesson trigger of 20261120120200_content.sql, unchanged except that
--    a change of position alone keeps updated_at, as for courses and chapters
--    in 20261121070000_structure_versions.sql. The lesson editor saves with
--    the position the lesson has when it saves, never the one it loaded.

create or replace function private.lessons_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  validating boolean :=
    coalesce(current_setting('heap.validated_lesson', true), '') = new.id::text;
  gradable_change boolean;
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
    gradable_change :=
      new.starter_code is distinct from old.starter_code
      or new.tests is distinct from old.tests
      or coalesce(current_setting('heap.solution_changed', true), '') = new.id::text
      or (new.gradable_changed_at is distinct from old.gradable_changed_at
        and new.gradable_changed_at = now());
    if new.validated_at is distinct from old.validated_at
      and new.validated_at is not null
      and not (validating and new.validated_at = now())
    then
      raise exception 'validated_at_set_outside_save_lesson' using errcode = 'P0001';
    end if;
    if gradable_change then
      new.gradable_changed_at := now();
      if not validating then
        new.validated_at := null;
      end if;
    else
      new.gradable_changed_at := old.gradable_changed_at;
    end if;
    new.published_at := case
      when new.status = 'published' and old.status is distinct from 'published' then now()
      else old.published_at
    end;
  end if;
  -- A move (Move up, Move down) changes only the position, which no editor
  -- holds as typed text, so it keeps the version an open editor saves with.
  if tg_op = 'UPDATE'
    and (to_jsonb(new) - 'position' - 'updated_at') = (to_jsonb(old) - 'position' - 'updated_at')
  then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;

  if new.status = 'published'
    and (new.validated_at is null or new.validated_at < new.gradable_changed_at)
  then
    raise exception 'lesson_not_validated' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.lessons_before_write() from public;

create function public.reorder_lessons(p_chapter_id uuid, p_lesson_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_lesson_ids is null
    or cardinality(p_lesson_ids)
      <> (select count(*) from public.lessons where chapter_id = p_chapter_id)
    or cardinality(p_lesson_ids)
      <> (select count(distinct wanted.lesson_id) from unnest(p_lesson_ids) as wanted(lesson_id))
    or exists (
      select 1 from unnest(p_lesson_ids) as wanted(lesson_id)
      where not exists (
        select 1 from public.lessons as l
        where l.id = wanted.lesson_id and l.chapter_id = p_chapter_id
      )
    )
  then
    raise exception 'order_out_of_date' using errcode = 'P0001';
  end if;
  update public.lessons as l
  set position = ordered.position - 1
  from unnest(p_lesson_ids) with ordinality as ordered(id, position)
  where l.id = ordered.id and l.chapter_id = p_chapter_id;
  -- Row level security hides the rows from a caller who may not change them.
  if not found then
    raise exception 'order_out_of_date' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.reorder_lessons(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_lessons(uuid, uuid[]) to authenticated;
