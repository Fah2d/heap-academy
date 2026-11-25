-- Versions of chapters, and moves that keep versions (FR-ADM-10, T-20):
-- a chapter rename over the version the editor loaded is written once, and a
-- second one over the same version changes nothing. Move up and Move down
-- change only positions, so they keep every course's and chapter's
-- updated_at, and an editor open in another tab can still save.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

delete from public.lessons;
delete from public.chapters;
delete from public.courses;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000601', 'learner-sv@example.test'),
  ('00000000-0000-4000-8000-000000000602', 'admin-sv@example.test');
insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000602');
insert into public.courses (id, slug, title, summary, position) values
  ('60000000-0000-4000-8000-000000000001', 'one', 'One', 'One.', 0),
  ('60000000-0000-4000-8000-000000000002', 'two', 'Two', 'Two.', 1),
  ('60000000-0000-4000-8000-000000000003', 'three', 'Three', 'Three.', 2);
insert into public.chapters (id, course_id, title, position, updated_at) values
  ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'A', 0,
   '2020-01-01T00:00:00Z'),
  ('61000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', 'B', 1,
   '2020-01-01T00:00:00Z');

select isnt((select updated_at from public.chapters
  where id = '61000000-0000-4000-8000-000000000001'), '2020-01-01T00:00:00Z'::timestamptz,
  '[FR-ADM-10] a new chapter''s updated_at is the server''s clock, whatever the caller sends');

-- The whole test is one transaction, where now() stands still. Versions are
-- set in the past, as saves in earlier requests would have left them.
alter table public.courses disable trigger courses_before_write;
alter table public.chapters disable trigger chapters_before_write;
update public.courses set updated_at = '2026-01-01T00:00:00Z';
update public.chapters set updated_at = '2026-01-01T00:00:00Z';
alter table public.courses enable trigger courses_before_write;
alter table public.chapters enable trigger chapters_before_write;

-- A learner: the rename matches no row it may change.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000601","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
with changed as (
  update public.chapters set title = 'Learner'
  where id = '61000000-0000-4000-8000-000000000001' and updated_at = '2026-01-01T00:00:00Z'
  returning 1
)
select is((select count(*) from changed), 0::bigint, '[T-20] a learner''s rename changes no chapter');
reset role;

-- The admin at aal2.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000602","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select lives_ok($$select public.reorder_courses(array['60000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000003']::uuid[])$$,
  '[FR-ADM-03] an admin moves a course');
select is((select array_agg(slug order by position) from public.courses),
  array['two', 'one', 'three'], '[FR-ADM-03] the courses are in the new order');
select is((select count(*) from public.courses where updated_at = '2026-01-01T00:00:00Z'), 3::bigint,
  '[FR-ADM-10] moving a course keeps every course''s version');
select lives_ok($$select public.reorder_chapters('60000000-0000-4000-8000-000000000001',
  array['61000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000001']::uuid[])$$,
  '[FR-ADM-03] an admin moves a chapter');
select is((select count(*) from public.chapters where updated_at = '2026-01-01T00:00:00Z'), 2::bigint,
  '[FR-ADM-10] moving a chapter keeps every chapter''s version');

with changed as (
  update public.chapters set title = 'First rename'
  where id = '61000000-0000-4000-8000-000000000001' and updated_at = '2026-01-01T00:00:00Z'
  returning 1
)
select is((select count(*) from changed), 1::bigint,
  '[FR-ADM-10] a rename over the loaded version changes the chapter');
with changed as (
  update public.chapters set title = 'Second rename'
  where id = '61000000-0000-4000-8000-000000000001' and updated_at = '2026-01-01T00:00:00Z'
  returning 1
)
select is((select count(*) from changed), 0::bigint,
  '[FR-ADM-10] a second rename over the same loaded version changes nothing');
select is((select title from public.chapters where id = '61000000-0000-4000-8000-000000000001'),
  'First rename', '[FR-ADM-10] the newer title stays');
-- A caller cannot pin updated_at back to the loaded value.
update public.chapters set updated_at = '2026-01-01T00:00:00Z'
  where id = '61000000-0000-4000-8000-000000000001';
select isnt((select updated_at from public.chapters
  where id = '61000000-0000-4000-8000-000000000001'), '2026-01-01T00:00:00Z'::timestamptz,
  '[FR-ADM-10] a chapter''s updated_at follows the server''s clock, whatever the caller sends');
reset role;

select * from finish();
rollback;
