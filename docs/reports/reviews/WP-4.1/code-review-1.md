# WP-4.1 code review 1 (condensed)

Reviewer: code-reviewer, of a039c64. Verdict: CHANGES REQUIRED. Course details hold up: a stale details save or status change is refused, the publish refusal shows its reason, learner sessions are refused by the wrapper and the database.

- BLOCKER 1 (FR-ADM-10): the chapter forms (add, rename) have no leave warning; typed text is lost on "All courses" or Back.
- BLOCKER 2 (FR-ADM-10): a chapter rename from a stale tab overwrites the newer one; `chapters` has no version. Add `chapters.updated_at` set by a trigger, send it as `loadedAt`, refuse `stale`, test it like `10_course_versions`.
- SHOULD FIX 3: a course reorder sets a new `updated_at` on every course (PGlite probe: all three changed), so an editor open in another tab is refused as stale. Keep `updated_at` when only `position` changed, and test it.
- SHOULD FIX 4: `settle` in `src/content/published.ts` catches database and parse failures without a log line (section 13: no silent catch). Log an error with an outcome code.
- SHOULD FIX 5: screenshots, design review, e2e run and the Delivery Gate report are unmet or unverified; the description must say so.
- NIT 6: every `23503` maps to `chapter_has_lessons`; adding a chapter to a deleted course says the wrong thing.
- NIT 7: no tiebreaker in the chapter order; two concurrent adds can share a position.
- NIT 8: course and chapter IDs are plain strings, not branded.
- NIT 9: `chapter-list.tsx` repeats the 60 and 140 limits; `types.ts` duplicates `ContentStatus`.
- NIT 10: `09_reorder`'s refusals happen at the count check, never at row level security; no "leaves a course out" case.
- NIT 11: no test that the editor keeps the course version after a status change.
- NIT 12: the second e2e test depends on the first one's course and leaves the seed reordered on failure.
- NIT 13: FR-ADM-03 says chapters are published and archived; the schema gives chapters no status. Raise a `spec-change`.

Ran: `pnpm verify` (1038 tests), PGlite (323 assertions), a PGlite probe for finding 3, Next.js 16.4.6 source (`updateTag` expires `unstable_cache` tags). Not run: e2e, axe, `supabase test db`, real PostgREST.
