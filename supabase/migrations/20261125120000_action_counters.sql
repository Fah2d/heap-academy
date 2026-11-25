-- Per-action rate limits for server actions (T-14 in
-- docs/spec/06-security-privacy.md, docs/spec/07-operations.md section 7,
-- ADR-0029). The action wrapper counts every call before it does any work:
-- one row per action, client and one-minute window.
--
-- The client is the platform's address of the caller. The server sends it
-- with an HMAC made from a server-only key (`ACTION_COUNTER_KEY`); the
-- function checks the HMAC against the same key in Supabase Vault, so a
-- direct call through the Data API with the public key cannot pick a client
-- or write a row. The address itself is never stored: the row holds an HMAC
-- of it, so the table names no one. Each call removes the rows of earlier
-- windows, so the table holds at most one window and a flood cannot fill it.

create table private.action_counters (
  action text not null
    constraint action_counters_action_shape
    check (char_length(action) <= 64 and action ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  client_key text not null
    constraint action_counters_client_key_shape check (client_key ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  hits integer not null constraint action_counters_hits_positive check (hits > 0),
  primary key (action, client_key, window_start)
);

create index action_counters_window_start on private.action_counters (window_start);

-- Denied by default: row level security on, no policy, no grant. Only the
-- function below, which runs as the table's owner, reads or writes it.
alter table private.action_counters enable row level security;
revoke all on table private.action_counters from public, anon, authenticated, service_role;

create function private.count_action(
  action_name text,
  client_address text,
  max_hits integer,
  signature text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  counter_key text;
  window_begins timestamptz := to_timestamp(floor(extract(epoch from now()) / 60) * 60);
  total integer;
begin
  if action_name is null or client_address is null or max_hits is null or signature is null
    or char_length(action_name) > 64
    or char_length(client_address) > 256
    or char_length(signature) <> 64
    or max_hits < 1 or max_hits > 10000 then
    raise exception 'action counter refused' using errcode = '22023';
  end if;

  select decrypted_secret into counter_key
  from vault.decrypted_secrets
  where name = 'action_counter_key';
  if counter_key is null or char_length(counter_key) < 32 then
    raise exception 'action counter key is not set' using errcode = '55000';
  end if;

  if signature <> encode(
    extensions.hmac(
      convert_to(action_name || E'\n' || client_address || E'\n' || max_hits::text, 'UTF8'),
      convert_to(counter_key, 'UTF8'),
      'sha256'
    ),
    'hex'
  ) then
    raise exception 'action counter refused' using errcode = '42501';
  end if;

  delete from private.action_counters where window_start < window_begins;

  insert into private.action_counters as counter (action, client_key, window_start, hits)
  values (
    action_name,
    encode(
      extensions.hmac(convert_to(client_address, 'UTF8'), convert_to(counter_key, 'UTF8'), 'sha256'),
      'hex'
    ),
    window_begins,
    1
  )
  on conflict (action, client_key, window_start)
  do update set hits = least(counter.hits, 2147483646) + 1
  returning counter.hits into total;

  return total <= max_hits;
end;
$$;

revoke all on function private.count_action(text, text, integer, text)
  from public, anon, authenticated, service_role;

-- The Data API reaches only `public`. This entry point runs as its owner so
-- that callers need no rights in `private`; the signature check above is
-- what refuses a caller that does not hold the server's key.
create function public.count_action(
  action_name text,
  client_address text,
  max_hits integer,
  signature text
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.count_action(action_name, client_address, max_hits, signature);
$$;

revoke all on function public.count_action(text, text, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.count_action(text, text, integer, text) to anon, authenticated;
