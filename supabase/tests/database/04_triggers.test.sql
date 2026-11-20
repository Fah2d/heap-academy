-- Each trigger and save_lesson, tried against the rule it enforces
-- (FR-GRD-05, FR-ADM-09, FR-ADM-10, FR-PRG-07; T-22).
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000002', 'admin@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000003', 'other@example.test', '{"full_name":"  Sara Ahmed  "}');
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
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002',
   '20000000-0000-4000-8000-000000000002', 'lesson-in-draft-course', 'Lesson in a draft course', 10,
   'Print hi.', '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'published',
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour');
insert into public.lesson_solutions (lesson_id, solution_code) values
  ('30000000-0000-4000-8000-000000000001', 'print("hi")');
alter table public.courses enable trigger courses_before_write;
alter table public.lessons enable trigger lessons_before_write;
alter table public.lesson_solutions enable trigger lesson_solutions_after_write;

insert into public.completions (user_id, lesson_id) values
  ('00000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001');

-- New user (section 8.3).
select is(
  (select display_name from public.profiles where user_id = '00000000-0000-4000-8000-000000000003'),
  'Sara Ahmed',
  'a new user gets a profile named from the sign-in provider'
);
select is(
  (select display_name from public.profiles where user_id = '00000000-0000-4000-8000-000000000002'),
  'admin',
  'a new user with no name is named from the email'
);

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

-- The publish rule (section 7.2).
select throws_ok(
  $$update public.lessons set starter_code = 'print("hi")'
    where id = '30000000-0000-4000-8000-000000000001'$$,
  'P0001', 'lesson_not_validated',
  '[FR-GRD-05] a published lesson''s starter cannot change without a validation');
select throws_ok(
  $$update public.lessons set tests = '[{"id":"t2","name":"Prints bye","expected":"bye"}]'
    where id = '30000000-0000-4000-8000-000000000001'$$,
  'P0001', 'lesson_not_validated',
  '[FR-GRD-05] a published lesson''s test cases cannot change without a validation');
select throws_ok(
  $$update public.lesson_solutions set solution_code = 'print("bye")'
    where lesson_id = '30000000-0000-4000-8000-000000000001'$$,
  'P0001', 'lesson_not_validated',
  '[FR-GRD-05] a published lesson''s solution cannot change without a validation');
select throws_ok(
  $$update public.lesson_solutions set wrong_answers = '[{"label":"Prints nothing","code":"pass"}]'
    where lesson_id = '30000000-0000-4000-8000-000000000001'$$,
  'P0001', 'lesson_not_validated',
  '[FR-GRD-05] a published lesson''s wrong answers cannot change without a validation');
select throws_ok(
  $$update public.lessons set status = 'published'
    where id = '30000000-0000-4000-8000-000000000002'$$,
  'P0001', 'lesson_not_validated',
  '[T-22] a lesson that was never validated cannot be published');
select throws_ok(
  $$update public.lessons set validated_at = now()
    where id = '30000000-0000-4000-8000-000000000002'$$,
  'P0001', 'validated_at_set_outside_save_lesson',
  '[T-22] validated_at is set only by save_lesson');
select lives_ok(
  $$update public.lessons set gradable_changed_at = now() - interval '1 day'
    where id = '30000000-0000-4000-8000-000000000001'$$,
  'a caller asks to move gradable_changed_at back');
select ok(
  (select gradable_changed_at > now() - interval '3 hours' from public.lessons
   where id = '30000000-0000-4000-8000-000000000001'),
  '[T-22] gradable_changed_at never moves back');
select lives_ok(
  $$update public.lessons set title = 'Renamed', instructions_md = 'Print hi, please.', xp = 25
    where id = '30000000-0000-4000-8000-000000000001'$$,
  '[FR-GRD-05] a published lesson''s title, instructions and XP change at once');

-- save_lesson (sections 7.1 and 8.3).
select throws_ok(
  $$select public.save_lesson(
      '30000000-0000-4000-8000-000000000001', now() - interval '1 day',
      '20000000-0000-4000-8000-000000000001', 'published-lesson', 'Renamed', 0, 25,
      'Print hi, please.', '[]', 'print("start")',
      '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'print("hi")', '[]', true)$$,
  'P0001', 'lesson_changed_since_loaded',
  '[FR-ADM-10] save_lesson refuses a copy older than the stored lesson');
select throws_ok(
  $$select public.save_lesson(
      '30000000-0000-4000-8000-000000000001',
      (select updated_at from public.lessons where id = '30000000-0000-4000-8000-000000000001'),
      '20000000-0000-4000-8000-000000000001', 'published-lesson', 'Renamed', 0, 25,
      'Print hi, please.', '[]', 'print("start")',
      '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'print("hi")', '[]', false)$$,
  'P0001', 'lesson_not_validated',
  '[FR-GRD-05] save_lesson refuses a gradable change to a published lesson without a validation');
select lives_ok(
  $$select public.save_lesson(
      '30000000-0000-4000-8000-000000000001',
      (select updated_at from public.lessons where id = '30000000-0000-4000-8000-000000000001'),
      '20000000-0000-4000-8000-000000000001', 'published-lesson', 'Renamed', 0, 25,
      'Print hi, please.', '[]', 'print("start")',
      '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'print("hi there")',
      '[{"label":"Prints nothing","code":"pass"}]', true)$$,
  '[FR-GRD-05] save_lesson saves a validated gradable change to a published lesson');
select results_eq(
  $$select status, starter_code, validated_at >= gradable_changed_at
    from public.lessons where id = '30000000-0000-4000-8000-000000000001'$$,
  $$values ('published'::text, 'print("start")'::text, true)$$,
  '[FR-GRD-05] the lesson stays published, validated since its change');
select is(
  (select solution_code from public.lesson_solutions
   where lesson_id = '30000000-0000-4000-8000-000000000001'),
  'print("hi there")',
  'save_lesson writes the solution in the same call');
select is(
  current_setting('heap.validated_lesson', true),
  '',
  '[T-22] save_lesson clears its validation mark before it returns');
select lives_ok(
  $$select public.save_lesson(
      '30000000-0000-4000-8000-000000000002',
      (select updated_at from public.lessons where id = '30000000-0000-4000-8000-000000000002'),
      '20000000-0000-4000-8000-000000000001', 'draft-lesson', 'Draft lesson', 0, 10,
      '', '[]', '', '[]', '', '[]', false)$$,
  'save_lesson saves a draft that has not passed validation');

-- Courses (section 8.3).
select throws_ok(
  $$update public.courses set status = 'published'
    where id = '10000000-0000-4000-8000-000000000003'$$,
  'P0001', 'course_has_no_published_lesson',
  '[FR-ADM-09] a course with no published lesson cannot be published');
select lives_ok(
  $$update public.courses set status = 'published'
    where id = '10000000-0000-4000-8000-000000000002'$$,
  '[FR-ADM-09] a course with a published lesson can be published');

-- Deletion and archiving (FR-ADM-09, FR-PRG-07).
select throws_ok(
  $$delete from public.lessons where id = '30000000-0000-4000-8000-000000000001'$$,
  '23503', null,
  '[FR-ADM-09] a lesson with completions cannot be deleted');
select lives_ok(
  $$update public.lessons set status = 'archived'
    where id = '30000000-0000-4000-8000-000000000001'$$,
  '[FR-ADM-09] a lesson with completions can be archived');
reset role;
select is(
  (select xp from public.completions
   where user_id = '00000000-0000-4000-8000-000000000003'
     and lesson_id = '30000000-0000-4000-8000-000000000001'),
  20,
  '[FR-PRG-07] an archived lesson''s completion and its XP remain, whatever the lesson''s XP now'
);
set local role authenticated;
select throws_ok(
  $$delete from public.chapters where id = '20000000-0000-4000-8000-000000000001'$$,
  '23503', null,
  '[FR-ADM-09] a chapter with lessons cannot be deleted');
select throws_ok(
  $$insert into public.lessons (course_id, chapter_id, slug, title)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'stray', 'Stray')$$,
  '23503', null,
  'a lesson''s chapter must belong to its course');
select throws_ok(
  $$insert into public.lessons (course_id, chapter_id, slug, title, tests)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'bad', 'Bad',
            '[{"id":"t1","name":"Prints hi","expected":"hi","secret":"x"}]')$$,
  '23514', null,
  'a test case with an unknown field is refused');
reset role;

select * from finish();
rollback;
