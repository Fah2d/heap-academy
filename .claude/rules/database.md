---
paths:
  - "supabase/**"
  - "src/infrastructure/db/**"
---

# Database

The data model and its policies are in `docs/spec/02-architecture.md` section 8. Check the current Supabase documentation before using an auth or policy feature (E-20).

## Migrations

- Forward-only. Never edit an applied migration. One concern per migration.
- Every new table, in the same pull request: row level security enabled, its policies, its constraints, its indexes, and its tests in `supabase/tests/`. A table with no policies denies everything; it still needs a test that proves it.
- Expand, then contract (`docs/spec/07-operations.md` section 3.1). State in the pull request whether the previous app version still works.
- Size limits are `check` constraints that match the limits in `docs/spec/04-content-system.md` section 1.
- Regenerate the database types after every schema change and commit them.

## Policies

- One policy per operation and role. Name it for what it allows: `learners insert own completion for published lesson`.
- Wrap auth calls in a subquery so they are evaluated once per statement: `(select auth.uid())`, `(select auth.jwt()->>'aal')`.
- Admin means `private.is_admin()` and nothing else. Never check an email, a metadata field, or any claim the user can influence.
- Public reads of content check `status = 'published'` on the row and on its course.
- `lesson_solutions` and `admins` are readable exactly as section 8.2 says. No exception for convenience.

## Functions and triggers

- `security definer` only when it is needed. Then `set search_path = ''`, fully qualified names, and the function lives in the `private` schema unless the API must call it.
- `security invoker` for functions the app calls, so policies apply.
- Triggers enforce the rules in section 8.3. Each has a test that tries to break it.

## Clients

- `src/infrastructure/db` creates three clients: the session client for server code, the anonymous client with no session for `src/content`, and the privileged client in `privileged.ts`.
- The privileged client is imported only by the account deletion use case. Lint enforces it.
- Nothing is run against the production project from a working machine. Production migrations run in the deploy workflow.
- Seed data is for local and staging only.
