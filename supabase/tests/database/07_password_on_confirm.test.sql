-- A password set before an address was confirmed does not survive the
-- confirmation (FR-AUTH-02, T-11).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- A stranger's sign-up with a password: unconfirmed.
insert into auth.users (id, email, encrypted_password)
values ('00000000-0000-4000-8000-000000000301', 'victim@example.test',
        '$2a$10$strangerstrangerstrangerstrangerstrangerstrangerstran');

select is(
  (select encrypted_password from auth.users where id = '00000000-0000-4000-8000-000000000301'),
  '$2a$10$strangerstrangerstrangerstrangerstrangerstrangerstran',
  '[T-11] an unconfirmed sign-up keeps its password until confirmation');

-- The owner signs in with a code, which confirms the address.
update auth.users set email_confirmed_at = now()
where id = '00000000-0000-4000-8000-000000000301';
select is(
  (select encrypted_password from auth.users where id = '00000000-0000-4000-8000-000000000301'),
  '',
  '[FR-AUTH-02] [T-11] confirming the address clears the stranger''s password');

-- Later changes to a confirmed account leave its password alone.
update auth.users set encrypted_password = '$2a$10$ownerownerownerownerownerownerownerownerownerownerow'
where id = '00000000-0000-4000-8000-000000000301';
update auth.users set email_confirmed_at = now(), email = 'victim2@example.test'
where id = '00000000-0000-4000-8000-000000000301';
select is(
  (select encrypted_password from auth.users where id = '00000000-0000-4000-8000-000000000301'),
  '$2a$10$ownerownerownerownerownerownerownerownerownerownerow',
  '[FR-AUTH-02] a confirmed owner''s own later change is not undone');

-- An account created already confirmed carries no password.
insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values ('00000000-0000-4000-8000-000000000302', 'google@example.test', 'x', now());
select is(
  (select encrypted_password from auth.users where id = '00000000-0000-4000-8000-000000000302'),
  '',
  '[T-11] an account created confirmed has no password');

-- An unconfirmed account that stays unconfirmed is not touched.
insert into auth.users (id, email, encrypted_password)
values ('00000000-0000-4000-8000-000000000303', 'pending@example.test', 'random');
update auth.users set email = 'pending2@example.test'
where id = '00000000-0000-4000-8000-000000000303';
select is(
  (select encrypted_password from auth.users where id = '00000000-0000-4000-8000-000000000303'),
  'random',
  '[FR-AUTH-02] an unconfirmed account is not changed by other updates');

select is(
  (select prosecdef from pg_proc where oid = 'private.clear_password_on_confirm()'::regprocedure),
  false,
  '[T-20] the trigger function runs with no owner''s rights');

select * from finish();
rollback;
