-- The per-action counters of T-14 (docs/spec/06-security-privacy.md section
-- 4; docs/spec/07-operations.md section 7; ADR-0029). The table is closed to
-- every caller; only public.count_action() writes it, and only when the
-- server's HMAC over the action, the address and the limit checks out
-- against the key in Vault.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- This test's own key, whatever the stack was started with. Rolled back.
do $$
declare
  existing uuid;
begin
  select id into existing from vault.secrets where name = 'action_counter_key';
  if existing is null then
    perform vault.create_secret('test-only-action-counter-key-0123456789', 'action_counter_key');
  else
    perform vault.update_secret(existing, 'test-only-action-counter-key-0123456789');
  end if;
end;
$$;

-- What the server sends: an HMAC over "action\naddress\nlimit".
select set_config('test.sign_a', encode(extensions.hmac(
  convert_to(E'save-name\n203.0.113.7\n2', 'UTF8'),
  convert_to('test-only-action-counter-key-0123456789', 'UTF8'), 'sha256'), 'hex'), true);
select set_config('test.sign_b', encode(extensions.hmac(
  convert_to(E'save-name\n198.51.100.4\n2', 'UTF8'),
  convert_to('test-only-action-counter-key-0123456789', 'UTF8'), 'sha256'), 'hex'), true);
select set_config('test.sign_c', encode(extensions.hmac(
  convert_to(E'request-email-code\n203.0.113.7\n2', 'UTF8'),
  convert_to('test-only-action-counter-key-0123456789', 'UTF8'), 'sha256'), 'hex'), true);
select set_config('test.wrong_key', encode(extensions.hmac(
  convert_to(E'save-name\n192.0.2.1\n100', 'UTF8'),
  convert_to('a-key-chosen-by-the-caller-0123456789', 'UTF8'), 'sha256'), 'hex'), true);
select set_config('test.key_of_a', encode(extensions.hmac(
  convert_to('203.0.113.7', 'UTF8'),
  convert_to('test-only-action-counter-key-0123456789', 'UTF8'), 'sha256'), 'hex'), true);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000001301', 'learner-c@example.test'),
  ('00000000-0000-4000-8000-000000001302', 'admin-c@example.test');
insert into public.admins (user_id) values ('00000000-0000-4000-8000-000000001302');

-- The table: closed by default.
select is(
  (select relrowsecurity from pg_class where oid = 'private.action_counters'::regclass),
  true, '[T-14] row level security is on for the counter table');
select is(
  (select count(*)::int from pg_policies where schemaname = 'private' and tablename = 'action_counters'),
  0, '[T-14] the counter table has no policy, so no session reads or writes it');
select is(
  (select bool_or(has_table_privilege(r, 'private.action_counters', p))
   from unnest(array['anon', 'authenticated', 'service_role']) r,
        unnest(array['select', 'insert', 'update', 'delete']) p),
  false, '[T-14] no API role holds a right on the counter table');

-- The functions.
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc
   where oid = 'private.count_action(text, text, integer, text)'::regprocedure),
  '[T-14] the writer in private is security definer with an empty search path');
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.count_action(text, text, integer, text)'::regprocedure),
  '[T-14] the exposed entry point is security definer with an empty search path');
select is(
  (select bool_or(has_function_privilege(r, 'private.count_action(text, text, integer, text)', 'execute'))
   from unnest(array['anon', 'authenticated', 'service_role']) r),
  false, '[T-14] no API role can call the writer in private directly');
select ok(
  has_function_privilege('anon', 'public.count_action(text, text, integer, text)', 'execute')
  and has_function_privilege('authenticated', 'public.count_action(text, text, integer, text)', 'execute')
  and not has_function_privilege('service_role', 'public.count_action(text, text, integer, text)', 'execute'),
  '[T-14] the entry point is callable by anonymous and signed-in sessions only');

-- Anonymous, through the Data API.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok('select * from private.action_counters', '42501', null,
  '[T-14] anonymous cannot read the counter table');
select throws_ok(
  $$select public.count_action('save-name', '192.0.2.1', 100, current_setting('test.wrong_key'))$$,
  '42501', null,
  '[T-14] anonymous with a chosen address and an HMAC from its own key is refused');
select throws_ok(
  $$select public.count_action('save-name', '192.0.2.1', 2, current_setting('test.sign_a'))$$,
  '42501', null,
  '[T-14] a valid HMAC for one address does not count another address');
select throws_ok(
  $$select public.count_action('save-name', '203.0.113.7', 100, current_setting('test.sign_a'))$$,
  '42501', null,
  '[T-14] a valid HMAC for one limit does not raise the limit');
select throws_ok(
  $$select public.count_action('request-email-code', '203.0.113.7', 2, current_setting('test.sign_a'))$$,
  '42501', null,
  '[T-14] a valid HMAC for one action does not count another action');
reset role;
select is((select count(*)::int from private.action_counters), 0,
  '[T-14] the refused anonymous calls changed no row');

-- A learner, through the Data API.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000001301","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok('select * from private.action_counters', '42501', null,
  '[T-14] a learner cannot read the counter table');
select throws_ok(
  $$insert into private.action_counters values ('save-name', repeat('a', 64), now(), 1)$$,
  '42501', null, '[T-14] a learner cannot write the counter table');
select throws_ok(
  $$select public.count_action('save-name', '192.0.2.1', 100, current_setting('test.wrong_key'))$$,
  '42501', null,
  '[T-14] a learner with a chosen address and an HMAC from its own key is refused');
reset role;
select is((select count(*)::int from private.action_counters), 0,
  '[T-14] the refused learner calls changed no row');

-- The admin, at aal1 and at aal2: the table is closed to the admin too.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000001302","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok('select * from private.action_counters', '42501', null,
  '[T-14] an admin at aal1 cannot read the counter table');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000001302","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok('select * from private.action_counters', '42501', null,
  '[T-14] an admin at aal2 cannot read the counter table');
select throws_ok('delete from private.action_counters', '42501', null,
  '[T-14] an admin at aal2 cannot clear the counter table');
reset role;

-- The server's calls, as an anonymous session (a sign-in action).
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(public.count_action('save-name', '203.0.113.7', 2, current_setting('test.sign_a')), true,
  '[T-14] the first call in a window is allowed');
select is(public.count_action('save-name', '203.0.113.7', 2, current_setting('test.sign_a')), true,
  '[T-14] a call at the limit is allowed');
select is(public.count_action('save-name', '203.0.113.7', 2, current_setting('test.sign_a')), false,
  '[T-14] a call over the limit is refused');
select is(public.count_action('save-name', '198.51.100.4', 2, current_setting('test.sign_b')), true,
  '[T-14] another address has its own count');
select is(public.count_action('request-email-code', '203.0.113.7', 2, current_setting('test.sign_c')), true,
  '[T-14] another action has its own count');
reset role;

select results_eq(
  $$select action, client_key, hits from private.action_counters order by action, hits desc$$,
  $$values ('request-email-code', current_setting('test.key_of_a'), 1),
           ('save-name', current_setting('test.key_of_a'), 3),
           ('save-name', encode(extensions.hmac(convert_to('198.51.100.4', 'UTF8'),
             convert_to('test-only-action-counter-key-0123456789', 'UTF8'), 'sha256'), 'hex'), 1)$$,
  '[T-14] one row per action and client in the window, keyed on an HMAC of the address');
select is(
  (select count(*)::int from private.action_counters where client_key like '%203.0.113.7%'),
  0, '[NFR-PRIV-01] the raw address is stored nowhere');

-- Pruning: a row from an earlier window is removed by the next call.
insert into private.action_counters (action, client_key, window_start, hits)
values ('save-name', repeat('b', 64), now() - interval '2 minutes', 500);
select is(public.count_action('save-name', '198.51.100.4', 2, current_setting('test.sign_b')), true,
  '[T-14] the second call of the other address is allowed');
select is(
  (select count(*)::int from private.action_counters where window_start < now() - interval '1 minute'),
  0, '[T-14] rows of earlier windows are removed, so a flood cannot fill the table');

-- Inputs outside the bounds, and a missing key.
select throws_ok(
  $$select public.count_action('save-name', repeat('9', 257), 2, current_setting('test.sign_a'))$$,
  '22023', null, '[T-14] an address longer than 256 characters is refused');
select throws_ok(
  $$select public.count_action('save-name', '203.0.113.7', 0, current_setting('test.sign_a'))$$,
  '22023', null, '[T-14] a limit below one is refused');
do $$
begin
  perform vault.update_secret(
    (select id from vault.secrets where name = 'action_counter_key'), 'too-short');
end;
$$;
select throws_ok(
  $$select public.count_action('save-name', '203.0.113.7', 2, current_setting('test.sign_a'))$$,
  '55000', null, '[T-14] without a usable key in Vault every call fails, none is counted');

select * from finish();
rollback;
