-- save_lesson: the lesson, its solution and its wrong answers in one
-- transaction (docs/spec/02-architecture.md sections 7.1, 7.2 and 8.3;
-- docs/spec/04-content-system.md section 4.2; FR-ADM-10, FR-GRD-05, T-22).
--
-- Security invoker, so the admin policies decide. It refuses when the lesson
-- changed after the editor loaded it. When the server action reports that this
-- exact content passed validation, validated_at is set in the same statement
-- that writes the content, so a published lesson is never left unvalidated.
-- Returns the lesson's new updated_at, the editor's next copy. The server
-- action passes that value back unchanged, as the text Postgres returned: a
-- JavaScript Date keeps only milliseconds, so it would fail to match whenever
-- the stored time has microseconds.
--
-- A caller who may not change the lesson matches no row and is told the
-- lesson was not found; only an admin is told the copy is stale.

create function public.save_lesson(
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
      position = p_position,
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

revoke all on function public.save_lesson(
  uuid, timestamptz, uuid, text, text, integer, integer, text, jsonb, text, jsonb, text, jsonb, boolean
) from public, anon;
grant execute on function public.save_lesson(
  uuid, timestamptz, uuid, text, text, integer, integer, text, jsonb, text, jsonb, text, jsonb, boolean
) to authenticated;
