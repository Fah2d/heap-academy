-- public.reorder_courses and public.reorder_chapters (FR-ADM-03, T-20): an
-- admin at aal2 rewrites the order in one statement; a stale or partial
-- order is refused; everyone else is refused and changes nothing. Course
-- "one" is published, so a learner and an admin at aal1 see it and its
-- chapters: their calls pass the order checks and reach row level security.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

delete from public.lessons;
delete from public.chapters;
delete from public.courses;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000401', 'learner-r@example.test'),
  ('00000000-0000-4000-8000-000000000402', 'admin-r@example.test');
insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000402');
alter table public.courses disable trigger courses_before_write;
alter table public.lessons disable trigger lessons_before_write;
insert into public.courses (id, slug, title, summary, position, status) values
  ('40000000-0000-4000-8000-000000000001', 'one', 'One', 'One.', 0, 'published'),
  ('40000000-0000-4000-8000-000000000002', 'two', 'Two', 'Two.', 1, 'draft');
insert into public.chapters (id, course_id, title, position) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'A', 0),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'B', 1),
  ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', 'C', 0);
insert into public.lessons
  (id, course_id, chapter_id, slug, title, xp, instructions_md, tests, status,
   gradable_changed_at, validated_at, published_at)
values
  ('42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   '41000000-0000-4000-8000-000000000001', 'hi', 'Hi', 10,
   'Print hi.', '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'published',
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour');
alter table public.courses enable trigger courses_before_write;
alter table public.lessons enable trigger lessons_before_write;

select is((select prosecdef from pg_proc where oid = 'public.reorder_courses(uuid[])'::regprocedure),
  false, '[T-20] reorder_courses runs with the caller''s rights');
select is((select prosecdef from pg_proc where oid = 'public.reorder_chapters(uuid,uuid[])'::regprocedure),
  false, '[T-20] reorder_chapters runs with the caller''s rights');
select ok((select proconfig @> array['search_path=""'] from pg_proc
  where oid = 'public.reorder_chapters(uuid,uuid[])'::regprocedure),
  '[T-20] reorder_chapters has a pinned search path');
select ok((select proconfig @> array['search_path=""'] from pg_proc
  where oid = 'public.reorder_courses(uuid[])'::regprocedure),
  '[T-20] reorder_courses has a pinned search path');
select is(has_function_privilege('anon', 'public.reorder_courses(uuid[])', 'execute'), false,
  '[T-20] anonymous cannot call reorder_courses');
select is(has_function_privilege('anon', 'public.reorder_chapters(uuid,uuid[])', 'execute'), false,
  '[T-20] anonymous cannot call reorder_chapters');

-- A learner, and an admin before the second step.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000401","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from public.chapters
  where course_id = '40000000-0000-4000-8000-000000000001'), 2,
  '[T-20] a learner sees both chapters of the published course');
select throws_ok($$select public.reorder_chapters('40000000-0000-4000-8000-000000000001',
  array['41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000001']::uuid[])$$,
  'P0001', 'order_out_of_date', '[T-20] a learner cannot reorder chapters, given their full order');
select throws_ok($$select public.reorder_courses(array['40000000-0000-4000-8000-000000000001']::uuid[])$$,
  'P0001', 'order_out_of_date', '[T-20] a learner cannot reorder courses, given every course they see');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000402","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select public.reorder_chapters('40000000-0000-4000-8000-000000000001',
  array['41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000001']::uuid[])$$,
  'P0001', 'order_out_of_date', '[T-19] an admin at aal1 cannot reorder chapters');
select throws_ok($$select public.reorder_courses(array['40000000-0000-4000-8000-000000000001']::uuid[])$$,
  'P0001', 'order_out_of_date', '[T-19] an admin at aal1 cannot reorder courses');
reset role;
select is((select array_agg(title order by position) from public.chapters
  where course_id = '40000000-0000-4000-8000-000000000001'), array['A','B'],
  '[T-20] the refused chapter orders changed nothing');
select is((select array_agg(slug order by position) from public.courses), array['one','two'],
  '[T-20] the refused course orders changed nothing');

-- An admin at aal2.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000402","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$select public.reorder_chapters('40000000-0000-4000-8000-000000000001',
  array['41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000001']::uuid[])$$,
  '[FR-ADM-03] an admin reorders chapters');
select is((select array_agg(title order by position) from public.chapters
  where course_id = '40000000-0000-4000-8000-000000000001'), array['B','A'],
  '[FR-ADM-03] the chapters are in the new order');
select throws_ok($$select public.reorder_chapters('40000000-0000-4000-8000-000000000001',
  array['41000000-0000-4000-8000-000000000001']::uuid[])$$, 'P0001', 'order_out_of_date',
  '[FR-ADM-10] an order that leaves a chapter out is refused');
select throws_ok($$select public.reorder_chapters('40000000-0000-4000-8000-000000000001',
  array['41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000003']::uuid[])$$,
  'P0001', 'order_out_of_date', '[FR-ADM-03] a chapter of another course is refused');
select throws_ok($$select public.reorder_chapters('40000000-0000-4000-8000-000000000001',
  array['41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001']::uuid[])$$,
  'P0001', 'order_out_of_date', '[FR-ADM-03] a repeated chapter is refused');
select lives_ok($$select public.reorder_courses(array['40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000001']::uuid[])$$, '[FR-ADM-03] an admin reorders courses');
select is((select array_agg(slug order by position) from public.courses), array['two','one'],
  '[FR-ADM-03] the courses are in the new order');
select throws_ok($$select public.reorder_courses(array['40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-0000000000ff']::uuid[])$$, 'P0001', 'order_out_of_date',
  '[FR-ADM-03] an order with an unknown course is refused');
select is((select array_agg(slug order by position) from public.courses), array['two','one'],
  '[FR-ADM-03] the refused course order changed nothing');
reset role;

select * from finish();
rollback;
