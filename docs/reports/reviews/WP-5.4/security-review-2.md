APPROVE

Commit a0e14ab (WP-5.4 part 5, FR-ADM-08, `docs/spec/03-experience.md` section 7.7). No BLOCKER or MAJOR. No way found for a non-admin, or an admin at aal1, to read a draft, a solution or a wrong answer through this route, and no way to change content through it. (Security review 1 of part 4 was reported in the description and not saved as a file.)

## This commit

- **Gate, page (T-19).** `src/app/admin/layout.tsx` runs `requireAdminList()`; `lesson-preview-page.tsx` runs `await requireAdminStage("allow")` before parsing the ID or reading. A stranger gets `notFound()`; an admin at aal1 is redirected to `/admin/verify` or `/admin/setup` before the read. `guard-coverage.test.ts` checks the file.
- **Gate, metadata.** `generateMetadata` calls `adminMetadata`, which gives a stranger the not-found title and reads no lesson data.
- **Database (T-19, T-20, T-21).** The read uses `createSessionClient("read-only")`. `"admins select lessons"` requires `private.is_admin()`, which requires aal2; others see only published lessons of published courses. The select names only `id, title, slug, xp, instructions_md, hints, starter_code, tests, courses(slug, title)`, the learner read's columns; `lesson-preview.test.ts` asserts it names no solution or wrong answer. `lesson-preview.ts` imports `server-only`.
- **What reaches the browser.** The lesson fields above, instructions rendered on the server by the allowlist renderer (T-06), the nonce, and a back link built on the server.
- **Device stores.** In preview `createCodeStore` gets `undefined`, so IndexedDB is never opened; `deviceProgress()` is never called; no invitation, storage warning or lesson navigation. No `localStorage`, `sessionStorage` or cookies in the workspace subtree.
- **Headers and CSP (T-15, section 5.2).** `isAdminPath` matches the prefix, so the route gets `private, no-store` and the same nonce policy as learner pages.
- **Logs (T-16).** `preview` added to `ROUTE_SEGMENTS`; the lesson UUID is still logged as `:param`.
- **Risky patterns.** None in the diff.

## Findings

- **MINOR, `workspace.test.tsx`, FR-ADM-08.** "keeps code in memory only" passed without the preview guard, because jsdom has no `indexedDB`. Fix: stub `indexedDB` before rendering the preview.
- **MINOR, `e2e/admin-gate.spec.ts`, `e2e/admin-gate-journey.spec.ts`, T-19.** Neither list of admin addresses includes `/admin/lessons/<uuid>` or its preview. Fix: add both.
- **Note (by design, not counted), T-22, T-23.** The preview's Check does not use a fresh worker, so an earlier Run can change what a later Check reports. Publishing still requires Validate, which uses a fresh worker and is enforced by `validated_at`. The preview's pass is not evidence that a lesson is valid.

## Not checked

The route in a browser and against the database (no Docker), the CSP report stream at run time, a production bundle grep for draft text, `pnpm infra:verify`, CI.

## Answers (implementer)

- MINOR 1: fixed. The test stubs `indexedDB`; with `previewing ||` removed from the workspace it fails (`× keeps code in memory only, so a learner's saved code is never read or replaced`), and passes with it.
- MINOR 2: fixed. Both lists now hold `/admin/lessons/00000000-0000-4000-8000-000000000000` and its `/preview`. The J-8 journey also checks that a guest gets 404 and the not-found heading at the preview of a real lesson.
- Note: agreed; the banner says nothing is recorded and does not call the pass a validation.
