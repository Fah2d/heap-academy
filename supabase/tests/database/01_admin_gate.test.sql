-- The admin gate and the allow-list, as five callers: anonymous, a learner,
-- a learner at aal2 who is not on the list, an admin at aal1 and an admin at
-- aal2 (NFR-SEC-03, NFR-SEC-06; ADR-0025).
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'learner@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'admin@example.test'),
  ('00000000-0000-4000-8000-000000000004', 'second-step@example.test');
insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000002');

select ok(
  (select bool_and(c.relrowsecurity)
   from pg_class as c join pg_namespace as n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'),
  '[NFR-SEC-03] row level security is enabled on every table in public'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'admins'),
  0,
  '[NFR-SEC-06] admins has no policy at all'
);
select is(
  (select prosecdef from pg_proc where oid = 'private.is_admin()'::regprocedure),
  true,
  '[NFR-SEC-06] is_admin is security definer'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'private.is_admin()'::regprocedure),
  '[NFR-SEC-06] is_admin pins an empty search path'
);
select is(
  has_schema_privilege('anon', 'private', 'usage'),
  false,
  '[NFR-SEC-06] anonymous has no access to the private schema'
);

select set_eq(
  $$select n.nspname || '.' || p.proname from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef$$,
  array['private.is_admin', 'private.is_on_admin_list', 'private.create_profile',
        'public.lesson_completion_counts'],
  '[T-20] only is_admin, is_on_admin_list, create_profile and lesson_completion_counts run with the owner''s rights'
);
select ok(
  (select bool_and(p.proconfig @> array['search_path=""']) from pg_proc as p
   join pg_namespace as n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef),
  '[T-20] every function with the owner''s rights pins an empty search path'
);

-- An admin whose session carries no assurance level is at aal1.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(private.is_admin(), false,
  '[NFR-SEC-06] an admin whose session has no assurance level is not an admin');
reset role;

-- Anonymous.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok('select private.is_admin()', '42501', null,
  '[NFR-SEC-06] anonymous cannot call is_admin');
select throws_ok('select * from public.admins', '42501', null,
  '[NFR-SEC-06] anonymous cannot select admins');
select throws_ok(
  $$insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000001')$$,
  '42501', null, '[NFR-SEC-06] anonymous cannot insert into admins');
select throws_ok('update public.admins set created_at = now()', '42501', null,
  '[NFR-SEC-06] anonymous cannot update admins');
select throws_ok('delete from public.admins', '42501', null,
  '[NFR-SEC-06] anonymous cannot delete from admins');
reset role;

-- A learner.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is(private.is_admin(), false, '[NFR-SEC-06] a learner is not an admin');
select throws_ok('select * from public.admins', '42501', null,
  '[NFR-SEC-06] a learner cannot select admins');
select throws_ok(
  $$insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000001')$$,
  '42501', null, '[NFR-SEC-06] a learner cannot add themselves to admins');
select throws_ok('update public.admins set created_at = now()', '42501', null,
  '[NFR-SEC-06] a learner cannot update admins');
select throws_ok('delete from public.admins', '42501', null,
  '[NFR-SEC-06] a learner cannot delete from admins');
reset role;

-- A learner who passed a second step but is not on the list. Any learner can
-- enroll an authenticator app, so aal2 alone must never make an admin.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(private.is_admin(), false,
  '[NFR-SEC-06] a learner at aal2 who is not on the list is not an admin');
select throws_ok('select * from public.admins', '42501', null,
  '[NFR-SEC-06] a learner at aal2 cannot select admins');
select throws_ok(
  $$insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000004')$$,
  '42501', null, '[NFR-SEC-06] a learner at aal2 cannot add themselves to admins');
select throws_ok('update public.admins set created_at = now()', '42501', null,
  '[NFR-SEC-06] a learner at aal2 cannot update admins');
select throws_ok('delete from public.admins', '42501', null,
  '[NFR-SEC-06] a learner at aal2 cannot delete from admins');
reset role;

-- An admin at aal1, before the second step.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is(private.is_admin(), false, '[NFR-SEC-06] an admin at aal1 is not an admin');
select throws_ok('select * from public.admins', '42501', null,
  '[NFR-SEC-06] an admin at aal1 cannot select admins');
select throws_ok(
  $$insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000001')$$,
  '42501', null, '[NFR-SEC-06] an admin at aal1 cannot insert into admins');
select throws_ok('update public.admins set created_at = now()', '42501', null,
  '[NFR-SEC-06] an admin at aal1 cannot update admins');
select throws_ok('delete from public.admins', '42501', null,
  '[NFR-SEC-06] an admin at aal1 cannot delete from admins');
reset role;

-- An admin at aal2.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(private.is_admin(), true, '[NFR-SEC-06] an admin at aal2 is an admin');
select throws_ok('select * from public.admins', '42501', null,
  '[NFR-SEC-06] an admin at aal2 cannot select admins');
select throws_ok(
  $$insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000000001')$$,
  '42501', null, '[NFR-SEC-06] an admin at aal2 cannot insert into admins');
select throws_ok('update public.admins set created_at = now()', '42501', null,
  '[NFR-SEC-06] an admin at aal2 cannot update admins');
select throws_ok('delete from public.admins', '42501', null,
  '[NFR-SEC-06] an admin at aal2 cannot delete from admins');
reset role;

select * from finish();
rollback;
