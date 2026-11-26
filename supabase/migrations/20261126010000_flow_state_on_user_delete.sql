-- Deleting a user erases their sign-in flow records too (FR-PRF-03, J-10, T-17).
--
-- The auth service writes a row to auth.flow_state for every email code
-- request, and verifying the code does not remove it. The row names the user
-- in user_id, which has no foreign key to auth.users, so deleting the user
-- leaves it behind. J-10 found one such row after a deletion (auth v2.197.0,
-- the local CLI's).
--
-- The trigger runs as the role that deletes the user. That is the auth
-- service's own role, which owns auth.flow_state, so no security definer is
-- needed.

create function private.delete_flow_state_of_user()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from auth.flow_state where user_id = old.id;
  return old;
end;
$$;

revoke all on function private.delete_flow_state_of_user() from public;

create trigger delete_flow_state_of_user
  after delete on auth.users
  for each row execute function private.delete_flow_state_of_user();
