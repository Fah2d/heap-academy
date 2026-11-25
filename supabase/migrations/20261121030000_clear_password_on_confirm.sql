-- No password survives the confirmation of an address (FR-AUTH-02, T-11).
--
-- The product has no password sign-in, but the auth service still accepts a
-- password sign-up through its public endpoint. Someone could sign up with
-- another person's address and a password of their own. With "Confirm email"
-- on, that account stays unconfirmed until the address's owner signs in with
-- a code or with Google, which confirms it. Auth releases before v2.198.0
-- (the local CLI runs v2.197.0) keep the stranger's password through that
-- confirmation, so the stranger could then sign in with it.
--
-- So whenever an address becomes confirmed, its password is cleared. An empty
-- password never matches, and every code account's random password is
-- useless anyway. A signed-in owner who later sets a password of their own
-- is not affected; nobody else can.

create function private.clear_password_on_confirm()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null
     and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    new.encrypted_password := '';
  end if;
  return new;
end;
$$;

revoke all on function private.clear_password_on_confirm() from public;

create trigger clear_password_on_confirm
  before insert or update of email_confirmed_at on auth.users
  for each row execute function private.clear_password_on_confirm();
