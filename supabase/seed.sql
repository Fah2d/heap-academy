-- Seed data for the local and staging databases only, never production
-- (.claude/rules/database.md). One sample course with the example lesson of
-- docs/spec/04-content-system.md section 7, saved through save_lesson as a
-- validated lesson so the publish rule holds.
--
-- The deploy workflow runs it on staging with the migrations
-- (scripts/apply-migrations.sh --include-seed). The CLI records the file's
-- hash and runs it once; when the file changes it only records the new hash.
-- So a change reaches staging only after the sample rows and the file's row
-- in supabase_migrations.seed_files are removed by hand. It also does nothing
-- when the sample course already exists.

do $seed$
begin
  if exists (select 1 from public.courses where id = '5eed0000-0000-4000-8000-000000000001') then
    return;
  end if;

insert into public.courses (id, slug, title, summary) values (
  '5eed0000-0000-4000-8000-000000000001',
  'sample-course',
  'Sample course',
  'A sample course for the local and staging databases.'
);

insert into public.chapters (id, course_id, title) values (
  '5eed0000-0000-4000-8000-000000000002',
  '5eed0000-0000-4000-8000-000000000001',
  'Input and output'
);

insert into public.lessons (id, course_id, chapter_id, slug, title) values (
  '5eed0000-0000-4000-8000-000000000003',
  '5eed0000-0000-4000-8000-000000000001',
  '5eed0000-0000-4000-8000-000000000002',
  'say-hello-by-name',
  'Say hello by name'
);

perform public.save_lesson(
  '5eed0000-0000-4000-8000-000000000003',
  (select updated_at from public.lessons where id = '5eed0000-0000-4000-8000-000000000003'),
  '5eed0000-0000-4000-8000-000000000002',
  'say-hello-by-name',
  'Say hello by name',
  0,
  10,
  $md$## Ask, then answer

`input()` waits for the person to type something, and gives you what they typed.

    name = input("What is your name? ")
    print("Hello, " + name + "!")

## Your task

Ask for a name. Then print a greeting that uses it.
$md$,
  '[]',
  $py$# Ask for a name, then greet that person.
$py$,
  $json$[
    {"id": "greets-sara", "name": "Greets Sara by name", "stdin": "Sara",
     "expected": "What is your name? Hello, Sara!"},
    {"id": "works-for-omar", "name": "Works for a different name", "stdin": "Omar",
     "expected": "What is your name? Hello, Omar!"}
  ]$json$,
  $py$name = input("What is your name? ")
print("Hello, " + name + "!")
$py$,
  $json$[
    {"label": "Prints a fixed name",
     "code": "input(\"What is your name? \")\nprint(\"Hello, Sara!\")\n"}
  ]$json$,
  true
);

update public.lessons set status = 'published'
where id = '5eed0000-0000-4000-8000-000000000003';

update public.courses set status = 'published'
where id = '5eed0000-0000-4000-8000-000000000001';
end;
$seed$;
