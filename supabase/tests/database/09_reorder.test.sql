-- public.reorder_courses and public.reorder_chapters (FR-ADM-03, T-20): an
-- admin at aal2 rewrites the order in one statement; a stale or partial
-- order is refused; everyone else is refused and changes nothing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

delete from public.lessons;
delete from public.chapters;
delete from public.courses;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000401', 'learner-r@example.test'),
  ('00000000-0000-4000-8000-000000000402', 'admin-r@example.test');
insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000402');
insert into public.courses (id, slug, title, summary, position) values
  ('40000000-0000-4000-8000-000000000001', 'one', 'One', 'One.', 0),
  ('40000000-0000-4000-8000-000000000002', 'two', 'Two', 'Two.', 1);
insert into public.chapters (id, course_id, title, position) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'A', 0),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'B', 1),
  ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', 'C', 0);

select is((select prosecdef from pg_proc where oid = 'public.reorder_courses(uuid[])'::regprocedure),
  false, '[T-20] reorder_courses runs with the caller''s rights');
select is((select prosecdef from pg_proc where oid = 'public.reorder_chapters(uuid,uuid[])'::regprocedure),
  false, '[T-20] reorder_chapters runs with the caller''s rights');
select ok((select proconfig @> array['search_path=""'] from pg_proc
  where oid = 'public.reorder_chapters(uuid,uuid[])'::regprocedure), '[T-20] a pinned search path');
select is(has_function_privilege('anon', 'public.reorder_courses(uuid[])', 'execute'), false,
  '[T-20] anonymous cannot call reorder_courses');
select is(has_function_privilege('anon', 'public.reorder_chapters(uuid,uuid[])', 'execute'), false,
  '[T-20] anonymous cannot call reorder_chapters');

-- A learner, and an admin before the second step.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000401","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$select public.reorder_chapters('40000000-0000-4000-8000-000000000001',
  array['41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000001']::uuid[])$$,
  'P0001', null, '[T-20] a learner cannot reorder chapters');
select throws_ok($$select public.reorder_courses(array[]::uuid[])$$, 'P0001', null,
  '[T-20] a learner cannot reorder courses');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000402","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select public.reorder_chapters('40000000-0000-4000-8000-000000000001',
  array['41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000001']::uuid[])$$,
  'P0001', null, '[T-19] an admin at aal1 cannot reorder chapters');
reset role;
select is((select array_agg(title order by position) from public.chapters
  where course_id = '40000000-0000-4000-8000-000000000001'), array['A','B'],
  '[T-20] the refused calls changed nothing');

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
reset role;

select * from finish();
rollback;
