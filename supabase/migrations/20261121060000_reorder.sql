-- Move up and Move down for courses and chapters in one statement each
-- (docs/spec/03-experience.md section 7.3, FR-ADM-03; the `reorder` action
-- of docs/spec/02-architecture.md section 9.1). Security invoker: the
-- caller's own policies decide, so only an admin at aal2 changes a row.
-- Each takes the full new order, so a half-done move cannot be left behind:
-- the positions are rewritten together or not at all.

create function public.reorder_courses(p_course_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_course_ids is null
    or cardinality(p_course_ids) <> (select count(*) from public.courses)
    or cardinality(p_course_ids)
      <> (select count(distinct wanted.course_id) from unnest(p_course_ids) as wanted(course_id))
  then
    raise exception 'order_out_of_date' using errcode = 'P0001';
  end if;
  update public.courses as c
  set position = ordered.position - 1
  from unnest(p_course_ids) with ordinality as ordered(id, position)
  where c.id = ordered.id;
  if not found then
    raise exception 'order_out_of_date' using errcode = 'P0001';
  end if;
end;
$$;

create function public.reorder_chapters(p_course_id uuid, p_chapter_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_chapter_ids is null
    or cardinality(p_chapter_ids)
      <> (select count(*) from public.chapters where course_id = p_course_id)
    or cardinality(p_chapter_ids)
      <> (select count(distinct wanted.chapter_id) from unnest(p_chapter_ids) as wanted(chapter_id))
    or exists (
      select 1 from unnest(p_chapter_ids) as wanted(chapter_id)
      where not exists (
        select 1 from public.chapters as ch
        where ch.id = wanted.chapter_id and ch.course_id = p_course_id
      )
    )
  then
    raise exception 'order_out_of_date' using errcode = 'P0001';
  end if;
  update public.chapters as ch
  set position = ordered.position - 1
  from unnest(p_chapter_ids) with ordinality as ordered(id, position)
  where ch.id = ordered.id and ch.course_id = p_course_id;
  -- Row level security hides the rows from a caller who may not change them.
  if not found then
    raise exception 'order_out_of_date' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.reorder_courses(uuid[]) from public, anon;
revoke all on function public.reorder_chapters(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_courses(uuid[]) to authenticated;
grant execute on function public.reorder_chapters(uuid, uuid[]) to authenticated;
