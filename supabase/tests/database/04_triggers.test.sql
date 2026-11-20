-- Each trigger and save_lesson, tried against the rule it enforces
-- (FR-GRD-01, FR-GRD-05, FR-ADM-03, FR-ADM-07, FR-ADM-09, FR-ADM-10,
-- FR-PRG-07, FR-PRF-02; T-20, T-22).
begin;
create extension if not exists pgtap with schema extensions;
select plan(50);

delete from public.lessons;
delete from public.chapters;
delete from public.courses;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'learner@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000002', 'admin@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000003', 'other@example.test', '{"full_name":"  Sara Ahmed  "}');
insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000002');

alter table public.courses disable trigger courses_before_write;
alter table public.lessons disable trigger lessons_before_write;
alter table public.lesson_solutions disable trigger lesson_solutions_after_write;
insert into public.courses (id, slug, title, summary, status) values
  ('10000000-0000-4000-8000-000000000001', 'published-course', 'Published course', 'Published.', 'published'),
  ('10000000-0000-4000-8000-000000000002', 'draft-course', 'Draft course', 'Draft.', 'draft'),
  ('10000000-0000-4000-8000-000000000003', 'empty-course', 'Empty course', 'Empty.', 'draft'),
  ('10000000-0000-4000-8000-000000000004', 'drafts-only-course', 'Drafts only', 'Drafts.', 'draft');
insert into public.chapters (id, course_id, title) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Chapter one'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Chapter two'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'Chapter four');
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
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour'),
  -- Validated, then its starter changed while it was a draft.
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', 'changed-after-validation', 'Changed after validation', 10,
   'Print hi.', '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'draft',
   now() - interval '1 hour', now() - interval '2 hours', null),
  ('30000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000004',
   '20000000-0000-4000-8000-000000000004', 'only-draft', 'Only a draft', 10,
   '', '[]', 'draft', now() - interval '2 hours', null, null);
insert into public.lesson_solutions (lesson_id, solution_code) values
  ('30000000-0000-4000-8000-000000000001', 'print("hi")');
alter table public.courses enable trigger courses_before_write;
alter table public.lessons enable trigger lessons_before_write;
alter table public.lesson_solutions enable trigger lesson_solutions_after_write;

insert into public.completions (user_id, lesson_id) values
  ('00000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001');

-- New user (section 8.3).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000005', 'long@example.test',
   '{"full_name":"A name that is much longer than forty characters in all"}'),
  ('00000000-0000-4000-8000-000000000006', 'blank@example.test', '{"full_name":"   "}'),
  ('00000000-0000-4000-8000-000000000007', null, '{}');
select is(
  (select display_name from public.profiles where user_id = '00000000-0000-4000-8000-000000000003'),
  'Sara Ahmed',
  '[FR-PRF-02] a new user gets a profile named from the sign-in provider, trimmed');
select is(
  (select display_name from public.profiles where user_id = '00000000-0000-4000-8000-000000000002'),
  'admin',
  '[FR-PRF-02] a new user with no name is named from the email');
select is(
  (select display_name from public.profiles where user_id = '00000000-0000-4000-8000-000000000005'),
  'A name that is much longer than forty ch',
  '[FR-PRF-02] a name longer than 40 characters is cut to 40');
select is(
  (select display_name from public.profiles where user_id = '00000000-0000-4000-8000-000000000006'),
  'blank',
  '[FR-PRF-02] a blank name falls back to the email');
select is(
  (select display_name from public.profiles where user_id = '00000000-0000-4000-8000-000000000007'),
  '00000000-0000-4000-8000-000000000007',
  '[FR-PRF-02] a user with no name and no email is named by their ID');

-- save_lesson as callers who are not admins: nothing changes (T-20).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok(
  $$select public.save_lesson(
      '30000000-0000-4000-8000-000000000001', now(),
      '20000000-0000-4000-8000-000000000001', 'published-lesson', 'Taken', 0, 50,
      'Taken.', '[]', 'print("taken")',
      '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'print("taken")', '[]', true)$$,
  'P0001', 'lesson_not_found',
  '[T-20] a learner cannot save a lesson');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok(
  $$select public.save_lesson(
      '30000000-0000-4000-8000-000000000001', now(),
      '20000000-0000-4000-8000-000000000001', 'published-lesson', 'Taken', 0, 50,
      'Taken.', '[]', 'print("taken")',
      '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'print("taken")', '[]', true)$$,
  'P0001', 'lesson_not_found',
  '[T-20] an admin at aal1 cannot save a lesson');
reset role;
select results_eq(
  $$select l.title, l.xp, l.starter_code, s.solution_code
    from public.lessons as l join public.lesson_solutions as s on s.lesson_id = l.id
    where l.id = '30000000-0000-4000-8000-000000000001'$$,
  $$values ('Published lesson'::text, 20, ''::text, 'print("hi")'::text)$$,
  '[T-20] the lesson and its solution are unchanged after both attempts');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

-- The publish rule (section 7.2).
select throws_ok(
  $$update public.lessons set starter_code = 'print("hi")'
    where id = '30000000-0000-4000-8000-000000000001'$$,
  'P0001', 'lesson_not_validated',
  '[FR-ADM-07] a published lesson''s starter cannot change without a validation');
select throws_ok(
  $$update public.lessons set tests = '[{"id":"t2","name":"Prints bye","expected":"bye"}]'
    where id = '30000000-0000-4000-8000-000000000001'$$,
  'P0001', 'lesson_not_validated',
  '[FR-ADM-07] a published lesson''s test cases cannot change without a validation');
select throws_ok(
  $$update public.lesson_solutions set solution_code = 'print("bye")'
    where lesson_id = '30000000-0000-4000-8000-000000000001'$$,
  'P0001', 'lesson_not_validated',
  '[FR-ADM-07] a published lesson''s solution cannot change without a validation');
select throws_ok(
  $$update public.lesson_solutions set wrong_answers = '[{"label":"Prints nothing","code":"pass"}]'
    where lesson_id = '30000000-0000-4000-8000-000000000001'$$,
  'P0001', 'lesson_not_validated',
  '[FR-ADM-07] a published lesson''s wrong answers cannot change without a validation');
select throws_ok(
  $$delete from public.lesson_solutions where lesson_id = '30000000-0000-4000-8000-000000000001'$$,
  'P0001', 'lesson_not_validated',
  '[FR-ADM-07] a published lesson''s solution cannot be removed without a validation');
select throws_ok(
  $$insert into public.lesson_solutions (lesson_id, solution_code)
    values ('30000000-0000-4000-8000-000000000003', 'print("hi")')$$,
  'P0001', 'lesson_not_validated',
  '[FR-ADM-07] a published lesson cannot gain a solution without a validation');
select throws_ok(
  $$update public.lessons set status = 'published'
    where id = '30000000-0000-4000-8000-000000000002'$$,
  'P0001', 'lesson_not_validated',
  '[T-22] a lesson that was never validated cannot be published');
select throws_ok(
  $$update public.lessons set status = 'published'
    where id = '30000000-0000-4000-8000-000000000004'$$,
  'P0001', 'lesson_not_validated',
  '[T-22] a lesson changed after its validation cannot be published');
select throws_ok(
  $$insert into public.lessons (course_id, chapter_id, slug, title, status)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
            'born-published', 'Born published', 'published')$$,
  'P0001', 'lesson_not_validated',
  '[T-22] a lesson cannot be inserted as published');
select throws_ok(
  $$insert into public.lessons (course_id, chapter_id, slug, title, validated_at)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
            'born-validated', 'Born validated', now())$$,
  'P0001', 'validated_at_set_outside_save_lesson',
  '[T-22] a lesson cannot be inserted as validated');
select throws_ok(
  $$update public.lessons set validated_at = now()
    where id = '30000000-0000-4000-8000-000000000002'$$,
  'P0001', 'validated_at_set_outside_save_lesson',
  '[T-22] validated_at is set only by save_lesson');
select set_config('heap.validated_lesson', '30000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$update public.lessons set validated_at = now()
    where id = '30000000-0000-4000-8000-000000000002'$$,
  'P0001', 'validated_at_set_outside_save_lesson',
  '[T-22] a validation of one lesson does not validate another');
select set_config('heap.validated_lesson', '30000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$update public.lessons set validated_at = '2099-01-01'
    where id = '30000000-0000-4000-8000-000000000002'$$,
  'P0001', 'validated_at_set_outside_save_lesson',
  '[T-22] validated_at cannot be set to a later time');
select set_config('heap.validated_lesson', '', true);
select lives_ok(
  $$update public.lessons set gradable_changed_at = now() - interval '1 day'
    where id = '30000000-0000-4000-8000-000000000001'$$,
  '[T-22] a caller asks to move gradable_changed_at back');
select ok(
  (select gradable_changed_at > now() - interval '3 hours' from public.lessons
   where id = '30000000-0000-4000-8000-000000000001'),
  '[T-22] gradable_changed_at never moves back');
select lives_ok(
  $$update public.lessons set title = 'Renamed', instructions_md = 'Print hi, please.', xp = 25
    where id = '30000000-0000-4000-8000-000000000001'$$,
  '[FR-ADM-07] a published lesson''s title, instructions and XP change at once');

-- save_lesson (sections 7.1 and 8.3).
select throws_ok(
  $$select public.save_lesson(
      '30000000-0000-4000-8000-000000000001', now() - interval '1 day',
      '20000000-0000-4000-8000-000000000001', 'published-lesson', 'Renamed', 0, 25,
      'Print hi, please.', '[]', '',
      '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'print("hi")', '[]', true)$$,
  'P0001', 'lesson_changed_since_loaded',
  '[FR-ADM-10] save_lesson refuses a copy older than the stored lesson');
select lives_ok(
  $$select public.save_lesson(
      '30000000-0000-4000-8000-000000000001',
      (select updated_at from public.lessons where id = '30000000-0000-4000-8000-000000000001'),
      '20000000-0000-4000-8000-000000000001', 'published-lesson', 'Renamed again', 0, 30,
      'Print hi, please.', '[]', '',
      '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'print("hi")', '[]', false)$$,
  '[FR-ADM-07] save_lesson saves a published lesson''s title and XP with no validation');
select results_eq(
  $$select status, title, xp from public.lessons where id = '30000000-0000-4000-8000-000000000001'$$,
  $$values ('published'::text, 'Renamed again'::text, 30)$$,
  '[FR-ADM-07] the lesson stays published with its new title and XP');
select throws_ok(
  $$select public.save_lesson(
      '30000000-0000-4000-8000-000000000001',
      (select updated_at from public.lessons where id = '30000000-0000-4000-8000-000000000001'),
      '20000000-0000-4000-8000-000000000001', 'published-lesson', 'Renamed again', 0, 30,
      'Print hi, please.', '[]', 'print("start")',
      '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'print("hi")', '[]', false)$$,
  'P0001', 'lesson_not_validated',
  '[FR-GRD-05] save_lesson refuses a gradable change to a published lesson without a validation');
select lives_ok(
  $$select public.save_lesson(
      '30000000-0000-4000-8000-000000000001',
      (select updated_at from public.lessons where id = '30000000-0000-4000-8000-000000000001'),
      '20000000-0000-4000-8000-000000000001', 'published-lesson', 'Renamed again', 0, 30,
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
  '[FR-GRD-05] save_lesson writes the solution in the same call');
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
  '[FR-ADM-07] save_lesson saves a draft that has not passed validation');

-- Courses (section 8.3).
select throws_ok(
  $$update public.courses set status = 'published'
    where id = '10000000-0000-4000-8000-000000000003'$$,
  'P0001', 'course_has_no_published_lesson',
  '[FR-ADM-03] a course with no lesson cannot be published');
select throws_ok(
  $$update public.courses set status = 'published'
    where id = '10000000-0000-4000-8000-000000000004'$$,
  'P0001', 'course_has_no_published_lesson',
  '[FR-ADM-03] a course whose only lesson is a draft cannot be published');
select throws_ok(
  $$insert into public.courses (slug, title, summary, status)
    values ('born-published', 'Born published', 'Born.', 'published')$$,
  'P0001', 'course_has_no_published_lesson',
  '[FR-ADM-03] a course cannot be inserted as published');
select lives_ok(
  $$update public.courses set status = 'published'
    where id = '10000000-0000-4000-8000-000000000002'$$,
  '[FR-ADM-03] a course with a published lesson can be published');

-- Deletion and archiving (FR-ADM-09, FR-PRG-07).
select throws_ok(
  $$delete from public.lessons where id = '30000000-0000-4000-8000-000000000001'$$,
  '23503', null,
  '[FR-ADM-09] a lesson with completions cannot be deleted');
select lives_ok(
  $$update public.lessons set status = 'archived'
    where id = '30000000-0000-4000-8000-000000000001'$$,
  '[FR-ADM-09] a lesson with completions can be archived');
select throws_ok(
  $$delete from public.chapters where id = '20000000-0000-4000-8000-000000000001'$$,
  '23503', null,
  '[FR-ADM-09] a chapter with lessons cannot be deleted');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select results_eq(
  $$select lesson_id, xp from public.completions$$,
  $$values ('30000000-0000-4000-8000-000000000001'::uuid, 20)$$,
  '[FR-PRG-07] a learner still sees their completion of an archived lesson, with the XP it had');
reset role;

-- Shapes (FR-GRD-01).
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.lessons (course_id, chapter_id, slug, title)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'stray', 'Stray')$$,
  '23503', null,
  '[FR-ADM-04] a lesson''s chapter must belong to its course');
select throws_ok(
  $$insert into public.lessons (course_id, chapter_id, slug, title, tests)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'bad', 'Bad',
            '[{"id":"t1","name":"Prints hi","expected":"hi","secret":"x"}]')$$,
  '23514', null,
  '[FR-GRD-01] a test case with an unknown field is refused');
select throws_ok(
  $$insert into public.lessons (course_id, chapter_id, slug, title, tests)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'bad', 'Bad',
            '[{"id":"t1","expected":"hi"}]')$$,
  '23514', null,
  '[FR-GRD-01] a test case with no name is refused');
select throws_ok(
  $$insert into public.lessons (course_id, chapter_id, slug, title, tests)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'bad', 'Bad',
            '[{"id":"t1","name":"Prints hi"}]')$$,
  '23514', null,
  '[FR-GRD-01] a test case with no expected output is refused');
select throws_ok(
  $$insert into public.lessons (course_id, chapter_id, slug, title, tests)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'bad', 'Bad',
            '[{"id":"t1","name":"Prints hi","expected":"hi","match":null}]')$$,
  '23514', null,
  '[FR-GRD-01] a test case whose comparison mode is null is refused');
select throws_ok(
  $$insert into public.lessons (course_id, chapter_id, slug, title, tests)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'bad', 'Bad',
            '{"id":"t1","name":"Prints hi","expected":"hi"}')$$,
  '23514', null,
  '[FR-GRD-01] test cases that are not a list are refused');
select throws_ok(
  $$insert into public.lessons (course_id, chapter_id, slug, title, tests)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'bad', 'Bad',
            '[{"id":"t1","name":"A","expected":"a"},{"id":"t1","name":"B","expected":"b"}]')$$,
  '23514', null,
  '[FR-GRD-01] two test cases with the same id are refused');
select throws_ok(
  $$update public.lesson_solutions set wrong_answers = '[{"code":"pass"}]'
    where lesson_id = '30000000-0000-4000-8000-000000000002'$$,
  '23514', null,
  '[FR-ADM-04] a wrong answer with no label is refused');
select throws_ok(
  $$update public.lesson_solutions set wrong_answers = '["pass"]'
    where lesson_id = '30000000-0000-4000-8000-000000000002'$$,
  '23514', null,
  '[FR-ADM-04] a wrong answer that is not a label and code is refused');
reset role;

select * from finish();
rollback;
