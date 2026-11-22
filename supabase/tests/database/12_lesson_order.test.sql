-- public.reorder_lessons (FR-ADM-03, T-20) and the lesson version a move
-- keeps (FR-ADM-10): an admin at aal2 rewrites a chapter's order in one
-- statement; a stale, partial or foreign order is refused; everyone else is
-- refused and changes nothing. A move keeps the lesson's updated_at; any
-- other change moves it, a save that changes only the solution included.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

delete from public.lessons;
delete from public.chapters;
delete from public.courses;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000501', 'learner-l@example.test'),
  ('00000000-0000-4000-8000-000000000502', 'admin-l@example.test');
insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000502');
alter table public.courses disable trigger courses_before_write;
alter table public.lessons disable trigger lessons_before_write;
insert into public.courses (id, slug, title, summary, position, status) values
  ('50000000-0000-4000-8000-000000000001', 'one', 'One', 'One.', 0, 'published');
insert into public.chapters (id, course_id, title, position) values
  ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'A', 0),
  ('51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 'B', 1);
insert into public.lessons
  (id, course_id, chapter_id, slug, title, position, xp, instructions_md, tests, status,
   gradable_changed_at, validated_at, published_at, updated_at)
values
  ('52000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001',
   '51000000-0000-4000-8000-000000000001', 'first', 'First', 0, 10,
   'Print hi.', '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'published',
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour',
   now() - interval '1 hour'),
  ('52000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001',
   '51000000-0000-4000-8000-000000000001', 'second', 'Second', 1, 10,
   'Print hi.', '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'published',
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour',
   now() - interval '1 hour'),
  ('52000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000001',
   '51000000-0000-4000-8000-000000000002', 'other', 'Other', 0, 10,
   '', '[]', 'draft', now() - interval '2 hours', null, null, now() - interval '1 hour');
alter table public.lesson_solutions disable trigger lesson_solutions_after_write;
insert into public.lesson_solutions (lesson_id, solution_code, wrong_answers) values
  ('52000000-0000-4000-8000-000000000003', 'print(1)', '[]');
alter table public.lesson_solutions enable trigger lesson_solutions_after_write;
alter table public.courses enable trigger courses_before_write;
alter table public.lessons enable trigger lessons_before_write;

create temporary table loaded on commit drop as
  select id, updated_at from public.lessons;
grant select on loaded to authenticated;

select is((select prosecdef from pg_proc where oid = 'public.reorder_lessons(uuid,uuid[])'::regprocedure),
  false, '[T-20] reorder_lessons runs with the caller''s rights');
select ok((select proconfig @> array['search_path=""'] from pg_proc
  where oid = 'public.reorder_lessons(uuid,uuid[])'::regprocedure),
  '[T-20] reorder_lessons has a pinned search path');
select is(has_function_privilege('anon', 'public.reorder_lessons(uuid,uuid[])', 'execute'), false,
  '[T-20] anonymous cannot call reorder_lessons');

-- A learner, and an admin before the second step.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000501","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from public.lessons
  where chapter_id = '51000000-0000-4000-8000-000000000001'), 2,
  '[T-20] a learner sees both published lessons of chapter A');
select throws_ok($$select public.reorder_lessons('51000000-0000-4000-8000-000000000001',
  array['52000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000001']::uuid[])$$,
  'P0001', 'order_out_of_date', '[T-20] a learner cannot reorder lessons, given their full order');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000502","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select public.reorder_lessons('51000000-0000-4000-8000-000000000001',
  array['52000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000001']::uuid[])$$,
  'P0001', 'order_out_of_date', '[T-19] an admin at aal1 cannot reorder lessons');
reset role;
select is((select array_agg(slug order by position) from public.lessons
  where chapter_id = '51000000-0000-4000-8000-000000000001'), array['first','second'],
  '[T-20] the refused orders changed nothing');

-- An admin at aal2.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000502","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$select public.reorder_lessons('51000000-0000-4000-8000-000000000001',
  array['52000000-0000-4000-8000-000000000001']::uuid[])$$, 'P0001', 'order_out_of_date',
  '[FR-ADM-10] an order that leaves a lesson out is refused');
select throws_ok($$select public.reorder_lessons('51000000-0000-4000-8000-000000000001',
  array['52000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000003']::uuid[])$$,
  'P0001', 'order_out_of_date', '[FR-ADM-03] a lesson of another chapter is refused');
select throws_ok($$select public.reorder_lessons('51000000-0000-4000-8000-000000000001',
  array['52000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001']::uuid[])$$,
  'P0001', 'order_out_of_date', '[FR-ADM-03] a repeated lesson is refused');
select throws_ok($$select public.reorder_lessons('51000000-0000-4000-8000-000000000001', null)$$,
  'P0001', 'order_out_of_date', '[FR-ADM-03] no order is refused');
select lives_ok($$select public.reorder_lessons('51000000-0000-4000-8000-000000000001',
  array['52000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000001']::uuid[])$$,
  '[FR-ADM-03] an admin reorders a chapter''s lessons');
select is((select array_agg(slug order by position) from public.lessons
  where chapter_id = '51000000-0000-4000-8000-000000000001'), array['second','first'],
  '[FR-ADM-03] the lessons are in the new order');
select is((select count(*)::int from public.lessons as l join loaded using (id)
  where l.updated_at = loaded.updated_at), 3,
  '[FR-ADM-10] a move keeps every lesson''s version, so an open editor can still save');
select is((select status from public.lessons where slug = 'first'), 'published',
  '[FR-ADM-03] a published lesson stays published when it moves');
update public.lessons set title = 'First, renamed' where slug = 'first';
select isnt((select l.updated_at from public.lessons as l join loaded using (id) where l.slug = 'first'),
  (select loaded.updated_at from public.lessons as l join loaded using (id) where l.slug = 'first'),
  '[FR-ADM-10] any other change gives the lesson a new version');
update public.lessons set title = 'Second, renamed', position = 5 where slug = 'second';
select isnt((select l.updated_at from public.lessons as l join loaded using (id) where l.slug = 'second'),
  (select loaded.updated_at from public.lessons as l join loaded using (id) where l.slug = 'second'),
  '[FR-ADM-10] a change of position with anything else gives a new version');

-- A save that changes only the solution writes the lesson row unchanged, so
-- its version moves only through lesson_solutions_after_write and
-- gradable_changed_at. A second editor holding the old version is refused.
create temporary table resaved (updated_at timestamptz) on commit drop;
grant select, insert on resaved to authenticated;
insert into resaved
  select public.save_lesson('52000000-0000-4000-8000-000000000003',
    (select updated_at from loaded where id = '52000000-0000-4000-8000-000000000003'),
    '51000000-0000-4000-8000-000000000002', 'other', 'Other', 0, 10, '', '[]',
    (select starter_code from public.lessons where slug = 'other'), '[]', 'print(2)', '[]', false);
select isnt((select updated_at from resaved),
  (select updated_at from loaded where id = '52000000-0000-4000-8000-000000000003'),
  '[FR-ADM-10] a save that changes only the solution gives the lesson a new version');
select is((select updated_at from public.lessons where slug = 'other'), (select updated_at from resaved),
  '[FR-ADM-10] save_lesson returns the version the lesson now has');
select throws_ok($$select public.save_lesson('52000000-0000-4000-8000-000000000003',
    (select updated_at from loaded where id = '52000000-0000-4000-8000-000000000003'),
    '51000000-0000-4000-8000-000000000002', 'other', 'Other', 0, 10, '', '[]',
    (select starter_code from public.lessons where slug = 'other'), '[]', 'print(3)', '[]', false)$$,
  'P0001', 'lesson_changed_since_loaded',
  '[FR-ADM-10] a second save from the version before the solution change is refused');
reset role;
select is((select position from public.lessons where slug = 'other'), 0,
  '[FR-ADM-03] another chapter''s order is untouched');

select * from finish();
rollback;
