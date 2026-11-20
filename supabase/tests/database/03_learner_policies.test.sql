-- Profiles, completions and the completion counts, every operation as
-- anonymous, a learner, an admin at aal1 and an admin at aal2, with the
-- answers that could differ also asked as a learner at aal2 who is not an admin
-- (NFR-SEC-03, NFR-SEC-06, FR-PRG-04, FR-ADM-13; T-08, T-10).
begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

delete from public.lessons;
delete from public.chapters;
delete from public.courses;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'learner@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'admin@example.test'),
  ('00000000-0000-4000-8000-000000000003', 'other@example.test'),
  ('00000000-0000-4000-8000-000000000004', 'second-step@example.test');
insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000002');

alter table public.courses disable trigger courses_before_write;
alter table public.lessons disable trigger lessons_before_write;
insert into public.courses (id, slug, title, summary, status) values
  ('10000000-0000-4000-8000-000000000001', 'published-course', 'Published course', 'Published.', 'published'),
  ('10000000-0000-4000-8000-000000000002', 'draft-course', 'Draft course', 'Draft.', 'draft');
insert into public.chapters (id, course_id, title) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Chapter one'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Chapter two');
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
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', 'second-lesson', 'Second lesson', 30,
   'Print bye.', '[{"id":"t1","name":"Prints bye","expected":"bye"}]', 'published',
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour'),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002',
   '20000000-0000-4000-8000-000000000002', 'lesson-in-draft-course', 'Lesson in a draft course', 10,
   'Print hi.', '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'published',
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour');
alter table public.courses enable trigger courses_before_write;
alter table public.lessons enable trigger lessons_before_write;

insert into public.completions (user_id, lesson_id) values
  ('00000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001');

-- Anonymous.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok('select * from public.profiles', '42501', null,
  '[T-08] anonymous cannot select profiles');
select throws_ok(
  $$insert into public.profiles (user_id, display_name) values ('00000000-0000-4000-8000-000000000001', 'x')$$,
  '42501', null, '[T-08] anonymous cannot insert a profile');
select throws_ok($$update public.profiles set display_name = 'x'$$, '42501', null,
  '[T-08] anonymous cannot update a profile');
select throws_ok('delete from public.profiles', '42501', null,
  '[T-08] anonymous cannot delete a profile');
select throws_ok('select * from public.completions', '42501', null,
  '[T-08] anonymous cannot select completions');
select throws_ok(
  $$insert into public.completions (user_id, lesson_id)
    values ('00000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001')$$,
  '42501', null, '[T-10] anonymous cannot insert a completion');
select throws_ok('update public.completions set xp = 50', '42501', null,
  '[T-10] anonymous cannot update a completion');
select throws_ok('delete from public.completions', '42501', null,
  '[T-10] anonymous cannot delete a completion');
select throws_ok('select * from public.lesson_completion_counts()', '42501', null,
  '[FR-ADM-13] anonymous cannot read completion counts');
reset role;

-- A learner.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select results_eq('select user_id from public.profiles',
  array['00000000-0000-4000-8000-000000000001'::uuid],
  '[T-08] a learner selects only their own profile');
select throws_ok(
  $$insert into public.profiles (user_id, display_name) values ('00000000-0000-4000-8000-000000000001', 'x')$$,
  '42501', null, '[T-08] a learner cannot insert a profile');
with changed as (update public.profiles set display_name = 'Ada' returning 1)
select is(count(*)::int, 1, '[T-08] a learner updates only their own profile') from changed;
select throws_ok(
  $$update public.profiles set user_id = '00000000-0000-4000-8000-000000000003'$$,
  '42501', null, '[T-08] a learner cannot change a profile''s owner');
select throws_ok('delete from public.profiles', '42501', null,
  '[T-08] a learner cannot delete a profile');
select is_empty('select * from public.completions',
  '[T-08] a learner selects no other learner''s completion');
select lives_ok(
  $$insert into public.completions (user_id, lesson_id)
    values ('00000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001')$$,
  '[T-10] a learner inserts their own completion of a published lesson');
select results_eq('select lesson_id from public.completions',
  array['30000000-0000-4000-8000-000000000001'::uuid],
  '[T-08] a learner selects their own completion');
select throws_ok(
  $$insert into public.completions (user_id, lesson_id)
    values ('00000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001')$$,
  '23505', null, '[T-10] a learner completes a lesson once');
select throws_ok(
  $$insert into public.completions (user_id, lesson_id)
    values ('00000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000004')$$,
  '42501', null, '[T-08] a learner cannot insert a completion for another learner');
select throws_ok(
  $$insert into public.completions (user_id, lesson_id)
    values ('00000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002')$$,
  'P0001', 'lesson_not_found', '[T-10] a learner cannot complete a draft lesson');
select throws_ok('update public.completions set xp = 50', '42501', null,
  '[T-10] a learner cannot update a completion');
select throws_ok('delete from public.completions', '42501', null,
  '[T-10] a learner cannot delete a completion');
select throws_ok('select * from public.lesson_completion_counts()', '42501', 'not_admin',
  '[FR-ADM-13] a learner cannot read completion counts');
reset role;

select is(
  (select display_name from public.profiles where user_id = '00000000-0000-4000-8000-000000000003'),
  'other',
  '[T-08] the other learner''s profile is unchanged'
);

-- A learner at aal2 who is not on the list: still only their own rows.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select results_eq('select user_id from public.profiles',
  array['00000000-0000-4000-8000-000000000004'::uuid],
  '[T-08] a learner at aal2 selects only their own profile');
select throws_ok(
  $$insert into public.completions (user_id, lesson_id)
    values ('00000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000004')$$,
  '42501', null, '[T-08] a learner at aal2 cannot insert a completion for another learner');
select throws_ok('select * from public.lesson_completion_counts()', '42501', 'not_admin',
  '[FR-ADM-13] a learner at aal2 who is not an admin cannot read completion counts');
reset role;

-- An admin at aal1, then at aal2: their own rows, like a learner.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select results_eq('select user_id from public.profiles',
  array['00000000-0000-4000-8000-000000000002'::uuid],
  '[T-08] an admin at aal1 selects only their own profile');
select throws_ok(
  $$insert into public.profiles (user_id, display_name) values ('00000000-0000-4000-8000-000000000002', 'x')$$,
  '42501', null, '[T-08] an admin at aal1 cannot insert a profile');
with changed as (update public.profiles set display_name = 'Owner' returning 1)
select is(count(*)::int, 1, '[T-08] an admin at aal1 updates only their own profile') from changed;
select throws_ok('delete from public.profiles', '42501', null,
  '[T-08] an admin at aal1 cannot delete a profile');
select is_empty('select * from public.completions',
  '[T-08] an admin at aal1 selects no learner''s completion');
select lives_ok(
  $$insert into public.completions (user_id, lesson_id)
    values ('00000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001')$$,
  '[T-10] an admin at aal1 inserts their own completion of a published lesson');
select throws_ok(
  $$insert into public.completions (user_id, lesson_id)
    values ('00000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000004')$$,
  '42501', null, '[T-08] an admin at aal1 cannot insert a completion for a learner');
select throws_ok('update public.completions set xp = 50', '42501', null,
  '[T-10] an admin at aal1 cannot update a completion');
select throws_ok('delete from public.completions', '42501', null,
  '[T-10] an admin at aal1 cannot delete a completion');
select throws_ok('select * from public.lesson_completion_counts()', '42501', 'not_admin',
  '[FR-ADM-13] an admin at aal1 cannot read completion counts');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select results_eq('select user_id from public.profiles',
  array['00000000-0000-4000-8000-000000000002'::uuid],
  '[T-08] an admin at aal2 selects only their own profile');
select throws_ok(
  $$insert into public.profiles (user_id, display_name) values ('00000000-0000-4000-8000-000000000002', 'x')$$,
  '42501', null, '[T-08] an admin at aal2 cannot insert a profile');
with changed as (update public.profiles set display_name = 'Owner two' returning 1)
select is(count(*)::int, 1, '[T-08] an admin at aal2 updates only their own profile') from changed;
select throws_ok('delete from public.profiles', '42501', null,
  '[T-08] an admin at aal2 cannot delete a profile');
select results_eq('select user_id from public.completions',
  array['00000000-0000-4000-8000-000000000002'::uuid],
  '[T-08] an admin at aal2 selects only their own completions');
select throws_ok(
  $$insert into public.completions (user_id, lesson_id)
    values ('00000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002')$$,
  '42501', null, '[T-10] an admin at aal2 cannot complete a draft lesson');
select throws_ok(
  $$insert into public.completions (user_id, lesson_id)
    values ('00000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003')$$,
  '42501', null, '[T-10] an admin at aal2 cannot complete a published lesson of a draft course');
select throws_ok(
  $$insert into public.completions (user_id, lesson_id)
    values ('00000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000004')$$,
  '42501', null, '[T-08] an admin at aal2 cannot insert a completion for a learner');
select throws_ok('update public.completions set xp = 50', '42501', null,
  '[T-10] an admin at aal2 cannot update a completion');
select throws_ok('delete from public.completions', '42501', null,
  '[T-10] an admin at aal2 cannot delete a completion');
select results_eq(
  'select lesson_id, completions from public.lesson_completion_counts() order by lesson_id',
  $$values ('30000000-0000-4000-8000-000000000001'::uuid, 3::bigint)$$,
  '[FR-ADM-13] an admin at aal2 reads completion counts for every learner');
reset role;

-- The database sets XP and the time (FR-PRG-04; T-10).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.completions (user_id, lesson_id, xp, completed_at)
    values ('00000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004',
            50, now() + interval '1 day')$$,
  '[FR-PRG-04] a learner sends XP and a future time with a completion');
reset role;
select is(
  (select xp from public.completions
   where user_id = '00000000-0000-4000-8000-000000000001'
     and lesson_id = '30000000-0000-4000-8000-000000000004'),
  30,
  '[FR-PRG-04] the completion''s XP is the lesson''s, not the one sent'
);
select ok(
  (select completed_at <= now() from public.completions
   where user_id = '00000000-0000-4000-8000-000000000001'
     and lesson_id = '30000000-0000-4000-8000-000000000004'),
  '[T-10] a completion is never in the future'
);
select is(
  (select sum(xp)::int from public.completions
   where user_id = '00000000-0000-4000-8000-000000000001'),
  50,
  '[FR-PRG-04] XP is the sum of the completed lessons'' XP'
);

select * from finish();
rollback;
