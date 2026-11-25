-- save_lesson keeps the lesson's place in its chapter (FR-ADM-10, FR-ADM-03).
--
-- A move from the course editor keeps the lesson's updated_at
-- (20261122010000_lesson_order.sql), so an editor opened before the move can
-- still save. Its copy of the position is then out of date, and writing it
-- back would undo the move and could leave two lessons in one place. The
-- position is now taken from the row in the same statement that checks the
-- version; p_position is used only when the save moves the lesson to another
-- chapter. The signature is unchanged, so its grants stay as they were.

create or replace function public.save_lesson(
  p_lesson_id uuid,
  p_loaded_updated_at timestamptz,
  p_chapter_id uuid,
  p_slug text,
  p_title text,
  p_position integer,
  p_xp integer,
  p_instructions_md text,
  p_hints jsonb,
  p_starter_code text,
  p_tests jsonb,
  p_solution_code text,
  p_wrong_answers jsonb,
  p_validated boolean
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_at timestamptz;
begin
  if p_validated then
    perform set_config('heap.validated_lesson', p_lesson_id::text, true);
  end if;

  update public.lessons
  set chapter_id = p_chapter_id,
      slug = p_slug,
      title = p_title,
      position = case when chapter_id = p_chapter_id then position else p_position end,
      xp = p_xp,
      instructions_md = p_instructions_md,
      hints = p_hints,
      starter_code = p_starter_code,
      tests = p_tests,
      validated_at = case when p_validated then now() else validated_at end
  where id = p_lesson_id and updated_at = p_loaded_updated_at
  returning updated_at into saved_at;

  if saved_at is null then
    perform set_config('heap.validated_lesson', '', true);
    if private.is_admin() and exists (select 1 from public.lessons where id = p_lesson_id) then
      raise exception 'lesson_changed_since_loaded' using errcode = 'P0001';
    end if;
    raise exception 'lesson_not_found' using errcode = 'P0001';
  end if;

  insert into public.lesson_solutions (lesson_id, solution_code, wrong_answers)
  values (p_lesson_id, p_solution_code, p_wrong_answers)
  on conflict (lesson_id) do update
  set solution_code = excluded.solution_code,
      wrong_answers = excluded.wrong_answers;

  perform set_config('heap.validated_lesson', '', true);
  return (select updated_at from public.lessons where id = p_lesson_id);
end;
$$;
