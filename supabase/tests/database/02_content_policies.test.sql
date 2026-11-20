-- Courses, chapters, lessons and solutions, every operation as four callers:
-- anonymous, a learner, an admin at aal1 and an admin at aal2
-- (NFR-SEC-03, NFR-SEC-06, FR-ADM-14; T-20, T-21).
begin;
create extension if not exists pgtap with schema extensions;
select plan(64);

-- Fixtures, written as the owner with the content triggers off so that a
-- published lesson can carry a validation older than this transaction.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'learner@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'admin@example.test');
insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000002');

alter table public.courses disable trigger courses_before_write;
alter table public.lessons disable trigger lessons_before_write;
alter table public.lesson_solutions disable trigger lesson_solutions_after_write;

insert into public.courses (id, slug, title, summary, status) values
  ('10000000-0000-4000-8000-000000000001', 'published-course', 'Published course', 'Published.', 'published'),
  ('10000000-0000-4000-8000-000000000002', 'draft-course', 'Draft course', 'Draft.', 'draft'),
  ('10000000-0000-4000-8000-000000000003', 'empty-course', 'Empty course', 'Empty.', 'draft');
insert into public.chapters (id, course_id, title) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Chapter one'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Chapter two'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Empty chapter');
insert into public.lessons
  (id, course_id, chapter_id, slug, title, xp, instructions_md, tests, status,
   gradable_changed_at, validated_at, published_at)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', 'published-lesson', 'Published lesson', 20,
   'Print hi.', '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'published',
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', 'draft-lesson', 'Draft lesson', 10,
   '', '[]', 'draft', now() - interval '2 hours', null, null),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002',
   '20000000-0000-4000-8000-000000000002', 'lesson-in-draft-course', 'Lesson in a draft course', 10,
   'Print hi.', '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'published',
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour');
insert into public.lesson_solutions (lesson_id, solution_code) values
  ('30000000-0000-4000-8000-000000000001', 'print("solution token")'),
  ('30000000-0000-4000-8000-000000000002', 'print("draft solution")');

alter table public.courses enable trigger courses_before_write;
alter table public.lessons enable trigger lessons_before_write;
alter table public.lesson_solutions enable trigger lesson_solutions_after_write;

-- Anonymous.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select results_eq('select slug from public.courses', array['published-course'],
  '[NFR-SEC-03] anonymous selects only published courses');
select throws_ok(
  $$insert into public.courses (slug, title, summary) values ('new-course', 'New', 'New.')$$,
  '42501', null, '[T-20] anonymous cannot insert a course');
with changed as (update public.courses set title = 'Changed' returning 1)
select is(count(*)::int, 0, '[T-20] anonymous updates no course') from changed;
with removed as (delete from public.courses returning 1)
select is(count(*)::int, 0, '[T-20] anonymous deletes no course') from removed;

select results_eq('select title from public.chapters order by title',
  array['Chapter one', 'Empty chapter'],
  '[NFR-SEC-03] anonymous selects only chapters of published courses');
select throws_ok(
  $$insert into public.chapters (course_id, title) values ('10000000-0000-4000-8000-000000000001', 'New')$$,
  '42501', null, '[T-20] anonymous cannot insert a chapter');
with changed as (update public.chapters set title = 'Changed' returning 1)
select is(count(*)::int, 0, '[T-20] anonymous updates no chapter') from changed;
with removed as (delete from public.chapters returning 1)
select is(count(*)::int, 0, '[T-20] anonymous deletes no chapter') from removed;

select results_eq('select slug from public.lessons', array['published-lesson'],
  '[FR-ADM-14] anonymous selects only published lessons of published courses');
select throws_ok(
  $$insert into public.lessons (course_id, chapter_id, slug, title)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'new', 'New')$$,
  '42501', null, '[T-20] anonymous cannot insert a lesson');
with changed as (update public.lessons set title = 'Changed' returning 1)
select is(count(*)::int, 0, '[T-20] anonymous updates no lesson') from changed;
with removed as (delete from public.lessons returning 1)
select is(count(*)::int, 0, '[T-20] anonymous deletes no lesson') from removed;

select throws_ok('select * from public.lesson_solutions', '42501', null,
  '[T-21] anonymous cannot select solutions');
select throws_ok(
  $$insert into public.lesson_solutions (lesson_id) values ('30000000-0000-4000-8000-000000000003')$$,
  '42501', null, '[T-21] anonymous cannot insert a solution');
select throws_ok($$update public.lesson_solutions set solution_code = ''$$, '42501', null,
  '[T-21] anonymous cannot update a solution');
select throws_ok('delete from public.lesson_solutions', '42501', null,
  '[T-21] anonymous cannot delete a solution');
reset role;

-- A learner, then an admin at aal1: the same answers.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select results_eq('select slug from public.courses', array['published-course'],
  '[NFR-SEC-03] a learner selects only published courses');
select throws_ok(
  $$insert into public.courses (slug, title, summary) values ('new-course', 'New', 'New.')$$,
  '42501', null, '[T-20] a learner cannot insert a course');
with changed as (update public.courses set title = 'Changed' returning 1)
select is(count(*)::int, 0, '[T-20] a learner updates no course') from changed;
with removed as (delete from public.courses returning 1)
select is(count(*)::int, 0, '[T-20] a learner deletes no course') from removed;

select results_eq('select title from public.chapters order by title',
  array['Chapter one', 'Empty chapter'],
  '[NFR-SEC-03] a learner selects only chapters of published courses');
select throws_ok(
  $$insert into public.chapters (course_id, title) values ('10000000-0000-4000-8000-000000000001', 'New')$$,
  '42501', null, '[T-20] a learner cannot insert a chapter');
with changed as (update public.chapters set title = 'Changed' returning 1)
select is(count(*)::int, 0, '[T-20] a learner updates no chapter') from changed;
with removed as (delete from public.chapters returning 1)
select is(count(*)::int, 0, '[T-20] a learner deletes no chapter') from removed;

select results_eq('select slug from public.lessons', array['published-lesson'],
  '[FR-ADM-14] a learner selects only published lessons of published courses');
select throws_ok(
  $$insert into public.lessons (course_id, chapter_id, slug, title)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'new', 'New')$$,
  '42501', null, '[T-20] a learner cannot insert a lesson');
with changed as (update public.lessons set title = 'Changed' returning 1)
select is(count(*)::int, 0, '[T-20] a learner updates no lesson') from changed;
with removed as (delete from public.lessons returning 1)
select is(count(*)::int, 0, '[T-20] a learner deletes no lesson') from removed;

select is_empty('select * from public.lesson_solutions',
  '[T-21] a learner selects no solution');
select throws_ok(
  $$insert into public.lesson_solutions (lesson_id) values ('30000000-0000-4000-8000-000000000003')$$,
  '42501', null, '[T-21] a learner cannot insert a solution');
with changed as (update public.lesson_solutions set solution_code = '' returning 1)
select is(count(*)::int, 0, '[T-21] a learner updates no solution') from changed;
with removed as (delete from public.lesson_solutions returning 1)
select is(count(*)::int, 0, '[T-21] a learner deletes no solution') from removed;
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select results_eq('select slug from public.courses', array['published-course'],
  '[NFR-SEC-06] an admin at aal1 selects only published courses');
select throws_ok(
  $$insert into public.courses (slug, title, summary) values ('new-course', 'New', 'New.')$$,
  '42501', null, '[T-20] an admin at aal1 cannot insert a course');
with changed as (update public.courses set title = 'Changed' returning 1)
select is(count(*)::int, 0, '[T-20] an admin at aal1 updates no course') from changed;
with removed as (delete from public.courses returning 1)
select is(count(*)::int, 0, '[T-20] an admin at aal1 deletes no course') from removed;

select results_eq('select title from public.chapters order by title',
  array['Chapter one', 'Empty chapter'],
  '[NFR-SEC-06] an admin at aal1 selects only chapters of published courses');
select throws_ok(
  $$insert into public.chapters (course_id, title) values ('10000000-0000-4000-8000-000000000001', 'New')$$,
  '42501', null, '[T-20] an admin at aal1 cannot insert a chapter');
with changed as (update public.chapters set title = 'Changed' returning 1)
select is(count(*)::int, 0, '[T-20] an admin at aal1 updates no chapter') from changed;
with removed as (delete from public.chapters returning 1)
select is(count(*)::int, 0, '[T-20] an admin at aal1 deletes no chapter') from removed;

select results_eq('select slug from public.lessons', array['published-lesson'],
  '[FR-ADM-14] an admin at aal1 selects only published lessons of published courses');
select throws_ok(
  $$insert into public.lessons (course_id, chapter_id, slug, title)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'new', 'New')$$,
  '42501', null, '[T-20] an admin at aal1 cannot insert a lesson');
with changed as (update public.lessons set title = 'Changed' returning 1)
select is(count(*)::int, 0, '[T-20] an admin at aal1 updates no lesson') from changed;
with removed as (delete from public.lessons returning 1)
select is(count(*)::int, 0, '[T-20] an admin at aal1 deletes no lesson') from removed;

select is_empty('select * from public.lesson_solutions',
  '[T-21] an admin at aal1 selects no solution');
select throws_ok(
  $$insert into public.lesson_solutions (lesson_id) values ('30000000-0000-4000-8000-000000000003')$$,
  '42501', null, '[T-21] an admin at aal1 cannot insert a solution');
with changed as (update public.lesson_solutions set solution_code = '' returning 1)
select is(count(*)::int, 0, '[T-21] an admin at aal1 updates no solution') from changed;
with removed as (delete from public.lesson_solutions returning 1)
select is(count(*)::int, 0, '[T-21] an admin at aal1 deletes no solution') from removed;
reset role;

-- An admin at aal2: everything.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select results_eq('select slug from public.courses order by slug',
  array['draft-course', 'empty-course', 'published-course'],
  '[NFR-SEC-06] an admin at aal2 selects every course');
select lives_ok(
  $$insert into public.courses (slug, title, summary) values ('new-course', 'New', 'New.')$$,
  '[NFR-SEC-06] an admin at aal2 inserts a course');
with changed as (
  update public.courses set title = 'Changed'
  where id = '10000000-0000-4000-8000-000000000002' returning 1
)
select is(count(*)::int, 1, '[NFR-SEC-06] an admin at aal2 updates a course') from changed;
with removed as (
  delete from public.courses where id = '10000000-0000-4000-8000-000000000003' returning 1
)
select is(count(*)::int, 1, '[NFR-SEC-06] an admin at aal2 deletes an empty course') from removed;

select results_eq('select title from public.chapters order by title',
  array['Chapter one', 'Chapter two', 'Empty chapter'],
  '[NFR-SEC-06] an admin at aal2 selects every chapter');
select lives_ok(
  $$insert into public.chapters (course_id, title) values ('10000000-0000-4000-8000-000000000001', 'New')$$,
  '[NFR-SEC-06] an admin at aal2 inserts a chapter');
with changed as (
  update public.chapters set title = 'Changed'
  where id = '20000000-0000-4000-8000-000000000002' returning 1
)
select is(count(*)::int, 1, '[NFR-SEC-06] an admin at aal2 updates a chapter') from changed;
with removed as (
  delete from public.chapters where id = '20000000-0000-4000-8000-000000000003' returning 1
)
select is(count(*)::int, 1, '[NFR-SEC-06] an admin at aal2 deletes an empty chapter') from removed;

select results_eq('select slug from public.lessons order by slug',
  array['draft-lesson', 'lesson-in-draft-course', 'published-lesson'],
  '[FR-ADM-14] an admin at aal2 selects every lesson');
select lives_ok(
  $$insert into public.lessons (course_id, chapter_id, slug, title)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'new', 'New')$$,
  '[NFR-SEC-06] an admin at aal2 inserts a draft lesson');
with changed as (
  update public.lessons set title = 'Changed'
  where id = '30000000-0000-4000-8000-000000000001' returning 1
)
select is(count(*)::int, 1, '[NFR-SEC-06] an admin at aal2 changes a published lesson''s title')
from changed;
with removed as (
  delete from public.lessons where id = '30000000-0000-4000-8000-000000000002' returning 1
)
select is(count(*)::int, 1, '[NFR-SEC-06] an admin at aal2 deletes a lesson with no completion')
from removed;

select results_eq('select solution_code from public.lesson_solutions',
  array['print("solution token")'],
  '[T-21] an admin at aal2 selects solutions');
select lives_ok(
  $$insert into public.lesson_solutions (lesson_id, solution_code)
    values ((select id from public.lessons where slug = 'new'), 'print(1)')$$,
  '[NFR-SEC-06] an admin at aal2 inserts a solution for a draft lesson');
with changed as (
  update public.lesson_solutions set solution_code = 'print(2)'
  where lesson_id = (select id from public.lessons where slug = 'new') returning 1
)
select is(count(*)::int, 1, '[NFR-SEC-06] an admin at aal2 updates a draft lesson''s solution')
from changed;
with removed as (
  delete from public.lesson_solutions
  where lesson_id = (select id from public.lessons where slug = 'new') returning 1
)
select is(count(*)::int, 1, '[NFR-SEC-06] an admin at aal2 deletes a draft lesson''s solution')
from removed;
reset role;

select * from finish();
rollback;
