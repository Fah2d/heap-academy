-- public.is_on_admin_list(), which the /admin guard asks to tell an admin
-- before the second step from everyone else (docs/spec/02-architecture.md
-- section 11.2; FR-ADM-01, NFR-SEC-06). It answers for the caller only and
-- opens nothing: an admin at aal1 is still refused by every policy.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000301', 'learner-l@example.test'),
  ('00000000-0000-4000-8000-000000000302', 'admin-l@example.test');
insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000302');

select is(
  (select prosecdef from pg_proc where oid = 'private.is_on_admin_list()'::regprocedure),
  true,
  '[NFR-SEC-06] the list check reads admins with the owner''s rights');
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'private.is_on_admin_list()'::regprocedure),
  '[T-20] the list check pins an empty search path');
select is(
  (select prosecdef from pg_proc where oid = 'public.is_on_admin_list()'::regprocedure),
  false,
  '[NFR-SEC-06] the public wrapper runs with the caller''s rights');
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.is_on_admin_list()'::regprocedure),
  '[T-20] the public wrapper pins an empty search path');
select is(has_function_privilege('anon', 'public.is_on_admin_list()', 'execute'), false,
  '[FR-ADM-01] anonymous cannot call the wrapper');
select is(has_function_privilege('anon', 'private.is_on_admin_list()', 'execute'), false,
  '[FR-ADM-01] anonymous cannot call the list check');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok('select public.is_on_admin_list()', '42501', null,
  '[FR-ADM-01] a call as anonymous is refused');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000301","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(public.is_on_admin_list(), false, '[FR-ADM-01] a learner at aal2 is not on the list');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000301","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is(public.is_on_admin_list(), false, '[FR-ADM-01] a learner at aal1 is not on the list');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000302","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(public.is_on_admin_list(), true, '[FR-ADM-01] an admin at aal2 is on the list');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000302","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is(public.is_on_admin_list(), true,
  '[FR-ADM-02] an admin at aal1 is on the list, so the guard can send them to the second step');
select is(public.is_admin(), false,
  '[T-19] being on the list at aal1 is still not being an admin');
select throws_ok('select * from public.admins', '42501', null,
  '[NFR-SEC-06] the list check opens nothing: admins stays closed');
select throws_ok(
  $$insert into public.courses (slug, title, summary) values ('gate', 'Gate', 'Gate')$$,
  '42501', null,
  '[T-19] an admin at aal1 cannot write content');
reset role;

select * from finish();
rollback;
