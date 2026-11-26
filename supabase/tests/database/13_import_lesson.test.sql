-- An imported lesson (FR-ADM-12, T-23), the two steps the import action
-- takes through the admin's session: insert a row last in the chapter, then
-- fill it through save_lesson with the version the insert returned and
-- p_validated false. The draft holds exactly the file's content, is not
-- validated, cannot be published until it is, and no learner sees it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

delete from public.lessons;
delete from public.chapters;
delete from public.courses;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000601', 'learner-i@example.test'),
  ('00000000-0000-4000-8000-000000000602', 'admin-i@example.test');
insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000602');
alter table public.courses disable trigger courses_before_write;
insert into public.courses (id, slug, title, summary, position, status) values
  ('60000000-0000-4000-8000-000000000001', 'one', 'One', 'One.', 0, 'published');
alter table public.courses enable trigger courses_before_write;
insert into public.chapters (id, course_id, title, position) values
  ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'A', 0);

create temporary table imported (id uuid, updated_at timestamptz) on commit drop;
grant select, insert on imported to authenticated;

-- The admin at aal2 imports.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000602","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

with created as (
  insert into public.lessons (course_id, chapter_id, title, slug, position)
  values ('60000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001',
          'Say hello by name', 'say-hello-by-name', 0)
  returning id, updated_at
)
insert into imported select id, updated_at from created;

select lives_ok(
  $$select public.save_lesson(
      (select id from imported), (select updated_at from imported),
      '61000000-0000-4000-8000-000000000001', 'say-hello-by-name', 'Say hello by name', 0, 15,
      '## Ask, then answer', '["Store the answer first."]', '# Ask',
      '[{"id":"greets","name":"Greets Sara","stdin":"Sara\n","afterCode":"","expected":"Hello, Sara!","match":"normalized","hint":""}]',
      'print("Hello, " + input() + "!")',
      '[{"label":"fixed name","code":"print(\"Hello, Sara!\")"}]', false)$$,
  '[FR-ADM-12] save_lesson fills the new row with the version its insert returned');

select results_eq(
  $$select slug, title, xp, instructions_md, hints, starter_code, tests, status
    from public.lessons where id = (select id from imported)$$,
  $$values ('say-hello-by-name', 'Say hello by name', 15, '## Ask, then answer',
    '["Store the answer first."]'::jsonb, '# Ask',
    '[{"id":"greets","name":"Greets Sara","stdin":"Sara\n","afterCode":"","expected":"Hello, Sara!","match":"normalized","hint":""}]'::jsonb,
    'draft')$$,
  '[FR-ADM-12] the draft holds the file''s lesson fields exactly');
select results_eq(
  $$select solution_code, wrong_answers from public.lesson_solutions
    where lesson_id = (select id from imported)$$,
  $$values ('print("Hello, " + input() + "!")',
    '[{"label":"fixed name","code":"print(\"Hello, Sara!\")"}]'::jsonb)$$,
  '[FR-ADM-12] the draft holds the file''s solution and wrong answers exactly');
select is((select validated_at from public.lessons where id = (select id from imported)), null,
  '[T-23] the imported draft is not validated');
select throws_ok(
  $$update public.lessons set status = 'published' where id = (select id from imported)$$,
  'P0001', 'lesson_not_validated',
  '[T-22] [T-23] an imported draft cannot be published before Validate passes');
select is((select status from public.lessons where id = (select id from imported)), 'draft',
  '[T-23] the refused publish changed nothing');
select throws_ok(
  $$select public.save_lesson(
      (select id from imported), (select updated_at from imported) - interval '1 second',
      '61000000-0000-4000-8000-000000000001', 'say-hello-by-name', 'Changed', 0, 15,
      '', '[]', '', '[]', '', '[]', false)$$,
  'P0001', 'lesson_changed_since_loaded',
  '[FR-ADM-10] a fill with any other version is refused');

-- A learner sees no part of it.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000601","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from public.lessons where id = (select id from imported)), 0,
  '[T-21] a learner does not see the imported draft');
select is((select count(*)::int from public.lesson_solutions
  where lesson_id = (select id from imported)), 0,
  '[T-21] a learner does not see its solution');

reset role;
select * from finish();
rollback;
