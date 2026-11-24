-- The size checks of every text column and JSON list at their limits, the
-- rule that a published lesson is complete, the stale-copy refusal across two
-- saves, and the two timestamp triggers (docs/spec/04-content-system.md
-- sections 1.3 and 2.1; docs/spec/02-architecture.md section 8; FR-ADM-04,
-- FR-ADM-10, FR-GRD-01, FR-PRF-02, FR-PRG-04). Each limit is tried at its
-- value, which passes, and one past it, which fails.
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

delete from public.lessons;
delete from public.chapters;
delete from public.courses;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'learner@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000002', 'admin@example.test', '{}');
insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000002');

alter table public.courses disable trigger courses_before_write;
alter table public.lessons disable trigger lessons_before_write;
alter table public.lesson_solutions disable trigger lesson_solutions_after_write;
insert into public.courses (id, slug, title, summary, status) values
  ('10000000-0000-4000-8000-000000000001', 'limits', 'Limits', 'Limits.', 'published');
insert into public.chapters (id, course_id, title) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Chapter');
-- Loaded an hour ago, so a save moves updated_at forward.
insert into public.lessons
  (id, course_id, chapter_id, slug, title, instructions_md, tests, status,
   gradable_changed_at, validated_at, published_at, updated_at)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', 'published', 'Published', 'Print hi.',
   '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'published',
   now() - interval '3 hours', now() - interval '2 hours', now() - interval '2 hours',
   now() - interval '1 hour'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', 'draft', 'Draft', '', '[]', 'draft',
   now() - interval '3 hours', null, null, now() - interval '1 hour'),
  -- Only the two-save test touches this one.
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', 'saved-twice', 'Saved twice', '', '[]', 'draft',
   now() - interval '3 hours', null, null, now() - interval '1 hour');
insert into public.lesson_solutions (lesson_id, solution_code) values
  ('30000000-0000-4000-8000-000000000001', 'print("hi")'),
  ('30000000-0000-4000-8000-000000000002', ''),
  ('30000000-0000-4000-8000-000000000003', '');
alter table public.courses enable trigger courses_before_write;
alter table public.lessons enable trigger lessons_before_write;
alter table public.lesson_solutions enable trigger lesson_solutions_after_write;

-- One valid test case with the given name, and a list of n of them.
create function pg_temp.test_case(name text) returns jsonb language sql as $$
  select jsonb_build_object('id', 't1', 'name', name, 'expected', 'hi') $$;
create function pg_temp.test_cases(n integer) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('id', 't' || i, 'name', 'Case ' || i, 'expected', 'hi'))
  from generate_series(1, n) as i $$;

-- Titles: 1 to 60 characters for a course, a chapter and a lesson.
select lives_ok(
  $$update public.courses set title = repeat('a', 60) where id = '10000000-0000-4000-8000-000000000001'$$,
  '[FR-ADM-03] a course title of 60 characters is stored');
select throws_ok(
  $$update public.courses set title = repeat('a', 61) where id = '10000000-0000-4000-8000-000000000001'$$,
  '23514', null, '[FR-ADM-03] a course title of 61 characters is refused');
select throws_ok(
  $$update public.courses set title = '' where id = '10000000-0000-4000-8000-000000000001'$$,
  '23514', null, '[FR-ADM-03] an empty course title is refused');
select lives_ok(
  $$update public.courses set summary = repeat('a', 140) where id = '10000000-0000-4000-8000-000000000001'$$,
  '[FR-ADM-03] a course summary of 140 characters is stored');
select throws_ok(
  $$update public.courses set summary = repeat('a', 141) where id = '10000000-0000-4000-8000-000000000001'$$,
  '23514', null, '[FR-ADM-03] a course summary of 141 characters is refused');
select lives_ok(
  $$update public.chapters set title = repeat('a', 60) where id = '20000000-0000-4000-8000-000000000001'$$,
  '[FR-ADM-03] a chapter title of 60 characters is stored');
select throws_ok(
  $$update public.chapters set title = repeat('a', 61) where id = '20000000-0000-4000-8000-000000000001'$$,
  '23514', null, '[FR-ADM-03] a chapter title of 61 characters is refused');
select lives_ok(
  $$update public.lessons set title = repeat('a', 60) where id = '30000000-0000-4000-8000-000000000002'$$,
  '[FR-ADM-04] a lesson title of 60 characters is stored');
select throws_ok(
  $$update public.lessons set title = repeat('a', 61) where id = '30000000-0000-4000-8000-000000000002'$$,
  '23514', null, '[FR-ADM-04] a lesson title of 61 characters is refused');
select throws_ok(
  $$update public.lessons set title = '' where id = '30000000-0000-4000-8000-000000000002'$$,
  '23514', null, '[FR-ADM-04] an empty lesson title is refused');

-- XP: 5 to 50.
select lives_ok(
  $$update public.lessons set xp = 5 where id = '30000000-0000-4000-8000-000000000002'$$,
  '[FR-PRG-04] a lesson worth 5 XP is stored');
select lives_ok(
  $$update public.lessons set xp = 50 where id = '30000000-0000-4000-8000-000000000002'$$,
  '[FR-PRG-04] a lesson worth 50 XP is stored');
select throws_ok(
  $$update public.lessons set xp = 4 where id = '30000000-0000-4000-8000-000000000002'$$,
  '23514', null, '[FR-PRG-04] a lesson worth 4 XP is refused');
select throws_ok(
  $$update public.lessons set xp = 51 where id = '30000000-0000-4000-8000-000000000002'$$,
  '23514', null, '[FR-PRG-04] a lesson worth 51 XP is refused');

-- Text of a lesson.
select lives_ok(
  $$update public.lessons set instructions_md = repeat('a', 20000) where id = '30000000-0000-4000-8000-000000000002'$$,
  '[FR-ADM-04] instructions of 20,000 characters are stored');
select throws_ok(
  $$update public.lessons set instructions_md = repeat('a', 20001) where id = '30000000-0000-4000-8000-000000000002'$$,
  '23514', null, '[FR-ADM-04] instructions of 20,001 characters are refused');
select lives_ok(
  $$update public.lessons set starter_code = repeat('a', 10000) where id = '30000000-0000-4000-8000-000000000002'$$,
  '[FR-ADM-04] a starter of 10,000 characters is stored');
select throws_ok(
  $$update public.lessons set starter_code = repeat('a', 10001) where id = '30000000-0000-4000-8000-000000000002'$$,
  '23514', null, '[FR-ADM-04] a starter of 10,001 characters is refused');
select lives_ok(
  $$update public.lesson_solutions set solution_code = repeat('a', 10000) where lesson_id = '30000000-0000-4000-8000-000000000002'$$,
  '[FR-ADM-04] a solution of 10,000 characters is stored');
select throws_ok(
  $$update public.lesson_solutions set solution_code = repeat('a', 10001) where lesson_id = '30000000-0000-4000-8000-000000000002'$$,
  '23514', null, '[FR-ADM-04] a solution of 10,001 characters is refused');

-- Test cases: at most 12; a name of 1 to 80 characters that is not blank; an id of the parser's form.
select lives_ok(
  format('update public.lessons set tests = %L where id = %L', pg_temp.test_cases(12), '30000000-0000-4000-8000-000000000002'),
  '[FR-GRD-01] 12 test cases are stored');
select throws_ok(
  format('update public.lessons set tests = %L where id = %L', pg_temp.test_cases(13), '30000000-0000-4000-8000-000000000002'),
  '23514', null, '[FR-GRD-01] 13 test cases are refused');
select lives_ok(
  format('update public.lessons set tests = %L where id = %L', jsonb_build_array(pg_temp.test_case(repeat('a', 80))), '30000000-0000-4000-8000-000000000002'),
  '[FR-GRD-01] a test case name of 80 characters is stored');
select throws_ok(
  format('update public.lessons set tests = %L where id = %L', jsonb_build_array(pg_temp.test_case(repeat('a', 81))), '30000000-0000-4000-8000-000000000002'),
  '23514', null, '[FR-GRD-01] a test case name of 81 characters is refused');
select throws_ok(
  format('update public.lessons set tests = %L where id = %L', jsonb_build_array(pg_temp.test_case(E'\t')), '30000000-0000-4000-8000-000000000002'),
  '23514', null, '[FR-GRD-01] a test case name that is only a tab is refused');
select throws_ok(
  format('update public.lessons set tests = %L where id = %L', jsonb_build_array(pg_temp.test_case(E'  　﻿ ')), '30000000-0000-4000-8000-000000000002'),
  '23514', null, '[FR-GRD-01] a test case name of Unicode spaces is refused');
select lives_ok(
  format('update public.lessons set tests = %L where id = %L', jsonb_build_array(pg_temp.test_case(E'  x ')), '30000000-0000-4000-8000-000000000002'),
  '[FR-GRD-01] a test case name with one letter among spaces is stored');
select throws_ok(
  $$update public.lessons set tests = '[{"id":"-t1","name":"Prints hi","expected":"hi"}]'
    where id = '30000000-0000-4000-8000-000000000002'$$,
  '23514', null, '[FR-GRD-01] a test case id that starts with a hyphen is refused');
select throws_ok(
  format('update public.lessons set tests = %L where id = %L',
    jsonb_build_array(jsonb_build_object('id', repeat('t', 65), 'name', 'A', 'expected', 'a')),
    '30000000-0000-4000-8000-000000000002'),
  '23514', null, '[FR-GRD-01] a test case id of 65 characters is refused');

-- Wrong answers: at most three.
select lives_ok(
  $$update public.lesson_solutions set solution_code = '',
      wrong_answers = '[{"label":"a","code":"pass"},{"label":"b","code":"pass"},{"label":"c","code":"pass"}]'
    where lesson_id = '30000000-0000-4000-8000-000000000002'$$,
  '[FR-ADM-04] three wrong answers are stored');
select throws_ok(
  $$update public.lesson_solutions set
      wrong_answers = '[{"label":"a","code":"pass"},{"label":"b","code":"pass"},{"label":"c","code":"pass"},{"label":"d","code":"pass"}]'
    where lesson_id = '30000000-0000-4000-8000-000000000002'$$,
  '23514', null, '[FR-ADM-04] four wrong answers are refused');

-- A published lesson has instructions and at least one test case.
-- Marked as validated, as save_lesson does, so the check and not the publish
-- rule is what refuses it.
select set_config('heap.validated_lesson', '30000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$update public.lessons set tests = '[]', validated_at = now()
    where id = '30000000-0000-4000-8000-000000000001'$$,
  '23514', null, '[FR-GRD-05] a published lesson cannot lose its last test case, even validated');
select set_config('heap.validated_lesson', '', true);
select throws_ok(
  $$update public.lessons set instructions_md = '' where id = '30000000-0000-4000-8000-000000000001'$$,
  '23514', null, '[FR-ADM-04] a published lesson cannot lose its instructions');

-- A stale copy is refused on the second save, not only when it was never
-- current. As an admin at aal2, who is told the copy is stale.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok(
  $$select public.save_lesson(
      '30000000-0000-4000-8000-000000000003', now() - interval '1 hour',
      '20000000-0000-4000-8000-000000000001', 'saved-twice', 'First save', 0, 10,
      '', '[]', '', '[]', '', '[]', false)$$,
  '[FR-ADM-10] the first save with the copy loaded an hour ago is stored');
select throws_ok(
  $$select public.save_lesson(
      '30000000-0000-4000-8000-000000000003', now() - interval '1 hour',
      '20000000-0000-4000-8000-000000000001', 'saved-twice', 'Second save', 0, 10,
      '', '[]', '', '[]', '', '[]', false)$$,
  'P0001', 'lesson_changed_since_loaded',
  '[FR-ADM-10] a second save with the same old copy is refused');
select is(
  (select title from public.lessons where id = '30000000-0000-4000-8000-000000000003'),
  'First save',
  '[FR-ADM-10] the refused save changed nothing');
select throws_ok(
  $$update public.lesson_solutions set lesson_id = '30000000-0000-4000-8000-000000000001'
    where lesson_id = '30000000-0000-4000-8000-000000000003'$$,
  '42501', null,
  '[T-22] an admin cannot move a solution to another lesson');
reset role;

-- The timestamps the database keeps.
select lives_ok(
  $$update public.lessons set title = 'Renamed' where id = '30000000-0000-4000-8000-000000000001'$$,
  '[FR-ADM-07] a published lesson is renamed');
select ok(
  (select published_at < now() - interval '1 hour' from public.lessons
   where id = '30000000-0000-4000-8000-000000000001'),
  '[FR-ADM-07] renaming a published lesson keeps the time it was published');
select lives_ok(
  $$update public.lesson_solutions set updated_at = '2000-01-01'
    where lesson_id = '30000000-0000-4000-8000-000000000002'$$,
  '[FR-ADM-10] a caller sends an old updated_at for a solution');
select is(
  (select updated_at from public.lesson_solutions
   where lesson_id = '30000000-0000-4000-8000-000000000002'),
  now(),
  '[FR-ADM-10] the solution''s updated_at is the server''s time');

-- A learner's own profile and completion.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select lives_ok(
  $$update public.profiles set display_name = repeat('a', 40)$$,
  '[FR-PRF-02] a learner stores a name of 40 characters');
select throws_ok(
  $$update public.profiles set display_name = repeat('a', 41)$$,
  '23514', null, '[FR-PRF-02] a learner''s name of 41 characters is refused');
select lives_ok(
  $$insert into public.completions (user_id, lesson_id, code)
    values ('00000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', repeat('a', 20000))$$,
  '[FR-PRG-04] a completion with 20,000 characters of code is stored');
reset role;
select throws_ok(
  $$insert into public.completions (user_id, lesson_id, code)
    values ('00000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', repeat('a', 20001))$$,
  '23514', null, '[FR-PRG-04] a completion with 20,001 characters of code is refused');

-- The privileges each role holds, so a later migration cannot widen one
-- unnoticed. TRUNCATE ignores row level security.
select is(
  (select array_agg(format('%s:%s:%s', r, t, p) order by r, t, p)
   from unnest(array['anon', 'authenticated']) as r,
        unnest(array['courses', 'chapters', 'lessons', 'lesson_solutions', 'profiles',
                     'completions', 'admins']) as t,
        unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p
   where has_table_privilege(r, 'public.' || t, p)),
  array[
    'anon:chapters:SELECT', 'anon:courses:SELECT', 'anon:lessons:SELECT',
    'authenticated:chapters:DELETE', 'authenticated:chapters:INSERT',
    'authenticated:chapters:SELECT', 'authenticated:chapters:UPDATE',
    'authenticated:completions:SELECT',
    'authenticated:courses:DELETE', 'authenticated:courses:INSERT',
    'authenticated:courses:SELECT', 'authenticated:courses:UPDATE',
    'authenticated:lesson_solutions:DELETE', 'authenticated:lesson_solutions:SELECT',
    'authenticated:lessons:DELETE', 'authenticated:lessons:INSERT',
    'authenticated:lessons:SELECT', 'authenticated:lessons:UPDATE',
    'authenticated:profiles:SELECT'
  ],
  '[NFR-SEC-03] each role holds exactly the table privileges the policies expect');
select is(
  (select array_agg(format('%s:%s', t, c) order by t, c)
   from (values ('profiles'), ('completions'), ('lesson_solutions')) as tables (t),
        lateral (select column_name::text as c from information_schema.columns
                 where table_schema = 'public' and table_name = t) as columns
   where has_column_privilege('authenticated', 'public.' || t, c, 'UPDATE')
      or has_column_privilege('authenticated', 'public.' || t, c, 'INSERT')),
  array[
    'completions:code', 'completions:completed_at', 'completions:lesson_id', 'completions:user_id',
    'lesson_solutions:lesson_id', 'lesson_solutions:solution_code', 'lesson_solutions:wrong_answers',
    'profiles:display_name', 'profiles:time_zone'
  ],
  '[NFR-SEC-03] a signed-in caller may write only these columns of profiles, completions and solutions');

select * from finish();
rollback;
