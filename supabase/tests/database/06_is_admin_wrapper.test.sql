-- public.is_admin(), the wrapper the data API reaches (docs/spec/02-architecture.md
-- section 9.1; NFR-SEC-06, ADR-0025). It answers as private.is_admin() does,
-- for the caller's own session, and has no rights of its own.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000201', 'learner-w@example.test'),
  ('00000000-0000-4000-8000-000000000202', 'admin-w@example.test');
insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000202');

select is(
  (select prosecdef from pg_proc where oid = 'public.is_admin()'::regprocedure),
  false,
  '[NFR-SEC-06] the wrapper runs with the caller''s rights');
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.is_admin()'::regprocedure),
  '[T-20] the wrapper pins an empty search path');
select is(has_function_privilege('anon', 'public.is_admin()', 'execute'), false,
  '[NFR-SEC-06] anonymous cannot call the wrapper');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok('select public.is_admin()', '42501', null,
  '[NFR-SEC-06] a call as anonymous is refused');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000201","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(public.is_admin(), false, '[NFR-SEC-06] a learner at aal2 is not an admin');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000202","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is(public.is_admin(), false, '[NFR-SEC-06] an admin at aal1 is not an admin yet');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000202","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(public.is_admin(), true, '[NFR-SEC-06] an admin at aal2 is an admin');
select throws_ok('select * from public.admins', '42501', null,
  '[NFR-SEC-06] the wrapper opens nothing: admins stays closed to the admin''s session');
reset role;

select * from finish();
rollback;
