-- Deleting the auth user erases every row of theirs, in every table that
-- names a user, and nothing of anyone else's (FR-PRF-03, J-10, T-17).
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

delete from public.lessons;
delete from public.chapters;
delete from public.courses;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'leaving@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'staying@example.test');
insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000001');

alter table public.courses disable trigger courses_before_write;
alter table public.lessons disable trigger lessons_before_write;
insert into public.courses (id, slug, title, summary, status) values
  ('10000000-0000-4000-8000-000000000001', 'course', 'Course', 'Course.', 'published');
insert into public.chapters (id, course_id, title) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Chapter');
insert into public.lessons
  (id, course_id, chapter_id, slug, title, instructions_md, tests, status,
   gradable_changed_at, validated_at, published_at)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', 'lesson', 'Lesson', 'Print hi.',
   '[{"id":"t1","name":"Prints hi","expected":"hi"}]', 'published',
   now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour');
alter table public.courses enable trigger courses_before_write;
alter table public.lessons enable trigger lessons_before_write;

insert into public.completions (user_id, lesson_id, xp, code) values
  ('00000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 10, 'print("hi")'),
  ('00000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 10, 'print("hi")');

-- A new table that names a user must be added here, with its cascade.
select is(
  (select string_agg(c.relname::text, ',' order by c.relname)
   from pg_attribute a join pg_class c on c.oid = a.attrelid
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
     and a.attname = 'user_id' and not a.attisdropped),
  'admins,completions,profiles',
  'the tables that name a user are the ones inspected below'
);
select is(
  (select count(*)::int from pg_constraint
   where contype = 'f' and confrelid = 'auth.users'::regclass
     and connamespace = 'public'::regnamespace and confdeltype <> 'c'),
  0,
  'every reference to a user from public cascades'
);

select lives_ok(
  $$ delete from auth.users where id = '00000000-0000-4000-8000-000000000001' $$,
  'a user with a profile, a completion and an admin row can be deleted'
);

select is_empty(
  $$ select 1 from public.profiles where user_id = '00000000-0000-4000-8000-000000000001' $$,
  'the profile is gone'
);
select is_empty(
  $$ select 1 from public.completions where user_id = '00000000-0000-4000-8000-000000000001' $$,
  'the completions and their code are gone'
);
select is_empty(
  $$ select 1 from public.admins where user_id = '00000000-0000-4000-8000-000000000001' $$,
  'the admin row is gone'
);
select isnt_empty(
  $$ select 1 from public.profiles where user_id = '00000000-0000-4000-8000-000000000002' $$,
  'another profile stays'
);
select isnt_empty(
  $$ select 1 from public.completions where user_id = '00000000-0000-4000-8000-000000000002' $$,
  'another completion stays'
);
select isnt_empty($$ select 1 from public.courses $$, 'the course stays');
select isnt_empty($$ select 1 from public.chapters $$, 'the chapter stays');
select isnt_empty($$ select 1 from public.lessons $$, 'the lesson stays');

select * from finish();
rollback;
