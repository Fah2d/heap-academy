-- The version check of the course editor (FR-ADM-10, T-20): the dashboard
-- updates a course only where `updated_at` is still the value it loaded.
-- Every update moves `updated_at` on, so a second save over the same loaded
-- value changes nothing. A learner's update changes nothing at all.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

delete from public.lessons;
delete from public.chapters;
delete from public.courses;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000501', 'learner-v@example.test'),
  ('00000000-0000-4000-8000-000000000502', 'admin-v@example.test');
insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000502');
insert into public.courses (id, slug, title, summary) values
  ('50000000-0000-4000-8000-000000000001', 'one', 'One', 'One.');
-- The whole test is one transaction, where now() stands still. The loaded
-- version is set in the past, as a save in an earlier request would have.
alter table public.courses disable trigger courses_before_write;
update public.courses set updated_at = '2026-01-01T00:00:00Z'
  where id = '50000000-0000-4000-8000-000000000001';
alter table public.courses enable trigger courses_before_write;

create temporary table loaded on commit drop as
  select updated_at from public.courses where id = '50000000-0000-4000-8000-000000000001';
grant select on loaded to authenticated;

-- A learner: the update matches no row it may change.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000501","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
with changed as (
  update public.courses set title = 'Learner'
  where id = '50000000-0000-4000-8000-000000000001'
    and updated_at = (select updated_at from loaded)
  returning 1
)
select is((select count(*) from changed), 0::bigint, '[T-20] a learner''s update changes no course');
reset role;

-- The admin at aal2, saving over the version loaded.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000502","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
with changed as (
  update public.courses set title = 'First save'
  where id = '50000000-0000-4000-8000-000000000001'
    and updated_at = (select updated_at from loaded)
  returning 1
)
select is((select count(*) from changed), 1::bigint,
  '[FR-ADM-10] a save over the loaded version changes the course');
select isnt((select updated_at from public.courses
  where id = '50000000-0000-4000-8000-000000000001'), (select updated_at from loaded),
  '[FR-ADM-10] the save moved updated_at on');
with changed as (
  update public.courses set title = 'Second save'
  where id = '50000000-0000-4000-8000-000000000001'
    and updated_at = (select updated_at from loaded)
  returning 1
)
select is((select count(*) from changed), 0::bigint,
  '[FR-ADM-10] a second save over the same loaded version changes nothing');
select is((select title from public.courses where id = '50000000-0000-4000-8000-000000000001'),
  'First save', '[FR-ADM-10] the newer title stays');
-- A caller cannot pin updated_at back to the loaded value.
update public.courses set updated_at = (select updated_at from loaded)
  where id = '50000000-0000-4000-8000-000000000001';
select isnt((select updated_at from public.courses
  where id = '50000000-0000-4000-8000-000000000001'), (select updated_at from loaded),
  '[FR-ADM-10] updated_at follows the server''s clock, whatever the caller sends');
reset role;

select * from finish();
rollback;
