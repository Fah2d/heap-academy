<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `wp/4.3-validate-publish` at 84670a3 with `origin/main` at c8ce780 merged in (67b1495).** Open it against `wp/4.3-validate-publish`, or against `main` once 4.3 merges. The only merge conflict was `e2e/admin-gate-journey.spec.ts`, resolved as `wp/7.4-journeys-part-2c` did.

## What and why

WP-6.4, export and import (FR-ADM-12, T-23), a Should package.

- The course editor gains **Export and import**. **Export course** saves the course, every chapter and every lesson (drafts and archived too), with solutions and wrong answers, as `<slug>.json` in the format of `04-content-system.md` section 8. The file holds no IDs and no status.
- **Import a lesson** takes one lesson file and a chapter. The browser parses the file with `src/features/admin/lesson-file.ts` and names the first wrong field as a path (`tests[0].expected`). The server action parses it again with the same parser, then creates a draft at the end of the chapter: an insert, then `save_lesson` with `p_validated: false`. If that fill fails, the row is deleted again. Nothing in the file runs; the draft is published like any lesson, after Validate passes.
- Actions `exportCourse` and `importLesson` (`server/transfer-actions.ts`), admin only through `defineAction`, as `02-architecture.md` section 9.1 lists them. No migration.

## How it was verified

- `pnpm verify`: exit 0, `Test Files  106 passed (106)`, `Tests  1963 passed (1963)`. `pnpm build` with the `.env.example` values: exit 0; `check-bundle` and `check-static`: exit 0.
- Database tests on PGlite (not Supabase), with and without the seed: every file passes; the new `13_import_lesson.test.sql` 9 of 9 (the draft holds the file's fields exactly, is not validated, cannot be published, and no learner sees it).
- Browser, Chromium, against the development server: the new `admin-gallery.spec.ts` test "export and import: every state" 1 passed, axe clean on each example. Screens: `docs/reports/screens/WP-6.4/`.
- Not run: `pnpm test:db` and the stack journeys (no Docker here), Firefox and WebKit (speed mode), a real browser download.

## Reviews

- code-reviewer: CHANGES REQUIRED, 3 MAJOR, 4 MINOR; all fixed in 38870f1. Report: `docs/reports/reviews/WP-6.4/code-review-1.md`.
- security-reviewer: APPROVED, 4 MINOR; all fixed in 38870f1. Report: `security-review-1.md`.

## For the owner

1. The other tests in `e2e/admin-gallery.spec.ts` fail on this base with or without this change (checked by running the spec on 67b1495): the all-in-one gallery page has two `h1`s and duplicate landmarks. `wp/7.2-a11y-perf` already moves the gallery to one state per page; when the two meet, the three transfer examples become states there.
2. React holds every async transition on a page until all end, so while an export is still running, an import's answer shows only after it. Seen in the gallery, where one example never answers.

## Proposed spec change (`spec-change`)

1. `04-content-system.md` section 8: the example's test case gains `"id": "greets-sara"`. Section 2.1 makes `id` part of every test case and the grader's one parser requires it, so a file without it is refused at `tests[0].id`.

## Decisions (safe defaults)

1. Test cases are exported with their `id` and imported only with one (above).
2. A file whose address another lesson of the course uses gets the next free one (`-2`, `-3`), as Add lesson does, and the panel says so. So a lesson imported back into its own course differs only in its address.
3. Import takes one lesson, as section 8 says; a course file is refused at `format`. One lesson can be cut out of a course file and imported.
4. The browser refuses a file over 1 MB before reading it, and a lesson whose input would exceed the action's 700 KB limit (under Next's 1 MB action body) after parsing.
5. An import does not expire the published content cache: a new draft is not on the site.
