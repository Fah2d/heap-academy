-- Shape checks for the JSON columns of the content tables, matching
-- docs/spec/04-content-system.md sections 1 and 2.1 and src/grader's test
-- case parser. Lengths are char_length, which counts characters as a reader
-- does, like the parser's characterCount. Each check is false, never null,
-- when a key is missing or null: a null would let a check constraint pass.

create function private.valid_text_list(list jsonb, max_items integer, max_length integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(list) = 'array' then coalesce(
    jsonb_array_length(list) <= max_items
      and not exists (
        select 1
        from jsonb_array_elements(list) as item
        where not coalesce(
          case when jsonb_typeof(item) = 'string'
            then char_length(item #>> '{}') between 1 and max_length
            else false end,
          false
        )
      ),
    false
  ) else false end;
$$;

-- One test case: id, name and expected required; stdin, afterCode and hint
-- optional; match one of the three modes; no other field.
create function private.valid_test_case(test_case jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(test_case) = 'object' then coalesce(
    not exists (
        select 1
        from jsonb_object_keys(test_case) as key
        where key not in ('id', 'name', 'stdin', 'afterCode', 'expected', 'match', 'hint')
      )
      and jsonb_typeof(test_case -> 'id') = 'string'
      and (test_case ->> 'id') ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'
      and jsonb_typeof(test_case -> 'name') = 'string'
      and char_length(test_case ->> 'name') <= 80
      and btrim(test_case ->> 'name') <> ''
      and jsonb_typeof(test_case -> 'expected') = 'string'
      and char_length(test_case ->> 'expected') <= 5000
      and (not test_case ? 'stdin'
        or (jsonb_typeof(test_case -> 'stdin') = 'string'
          and char_length(test_case ->> 'stdin') <= 2000))
      and (not test_case ? 'afterCode'
        or (jsonb_typeof(test_case -> 'afterCode') = 'string'
          and char_length(test_case ->> 'afterCode') <= 2000))
      and (not test_case ? 'hint'
        or (jsonb_typeof(test_case -> 'hint') = 'string'
          and char_length(test_case ->> 'hint') <= 200))
      and (not test_case ? 'match'
        or (jsonb_typeof(test_case -> 'match') = 'string'
          and (test_case ->> 'match') in ('normalized', 'exact', 'contains'))),
    false
  ) else false end;
$$;

-- Up to 12 test cases, each valid, with no repeated id. A draft may have none;
-- publishing needs a validation, and validation needs at least one.
create function private.valid_test_cases(test_cases jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(test_cases) = 'array' then coalesce(
    jsonb_array_length(test_cases) <= 12
      and not exists (
        select 1 from jsonb_array_elements(test_cases) as item
        where not coalesce(private.valid_test_case(item), false)
      )
      and (
        select count(distinct item ->> 'id') = count(*)
        from jsonb_array_elements(test_cases) as item
      ),
    false
  ) else false end;
$$;

-- Up to three wrong answers, each a label and code. The code limit is the
-- solution's; the label limit is a test case name's.
create function private.valid_wrong_answers(answers jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(answers) = 'array' then coalesce(
    jsonb_array_length(answers) <= 3
      and not exists (
        select 1
        from jsonb_array_elements(answers) as item
        where not coalesce(
          case when jsonb_typeof(item) = 'object' then
            not exists (
              select 1 from jsonb_object_keys(item) as key where key not in ('label', 'code')
            )
            and jsonb_typeof(item -> 'label') = 'string'
            and char_length(item ->> 'label') between 1 and 80
            and jsonb_typeof(item -> 'code') = 'string'
            and char_length(item ->> 'code') <= 10000
          else false end,
          false
        )
      ),
    false
  ) else false end;
$$;

revoke all on function private.valid_text_list(jsonb, integer, integer) from public;
revoke all on function private.valid_test_case(jsonb) from public;
revoke all on function private.valid_test_cases(jsonb) from public;
revoke all on function private.valid_wrong_answers(jsonb) from public;

-- The check constraints call these as the writing role. They read nothing.
grant execute on function private.valid_text_list(jsonb, integer, integer) to authenticated;
grant execute on function private.valid_test_case(jsonb) to authenticated;
grant execute on function private.valid_test_cases(jsonb) to authenticated;
grant execute on function private.valid_wrong_answers(jsonb) to authenticated;

-- Keeps updated_at with the server's clock, whatever the caller sent.
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public;
