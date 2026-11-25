# WP-6.4 security review 1

Reviewer: `security-reviewer`, on 87d8ee6. Verdict: **APPROVED**. No blocker, no major, 4 minor.

## Holds

- Admin only (T-20, T-23): both actions use `defineAction` with `access: "admin"`; a guest, a learner and an admin at aal1 get `not_found` with no database call (`transfer-actions.test.ts`). Reads and writes use the admin's session, so row level security decides again.
- No publish, no validation (T-22, T-23): the insert sets only course, chapter, title, slug and position, so the status is `draft` and `validated_at` is null; `save_lesson` gets `p_validated: false`. The database refuses `validated_at` outside `save_lesson`, and refuses publishing without validation.
- Nothing from the file runs (T-23): no worker, no `eval`, no Markdown rendering on the import path; file text shows only as React text. The component test stubs `Worker` and checks that none is built.
- Size: export input 1024 bytes; import `MAX_SAVE_LESSON_BYTES` (736,704), under Next's default 1 MB action body.
- Solutions (T-21): `course-export.ts` is `server-only`; the browser module holds only the schema.
- Errors: fixed codes only.

## Minor

1. `lesson-store.ts`: the cleanup `delete` ignores its result, so a failed fill and a failed delete leave an empty draft. Admin only and unpublished. Fix: check and log it.
2. `course-transfer.tsx` against `transfer-actions.ts`: the browser accepts 1 MB, the server about 737 KB; such a file gets `invalid_input` and "Choose the file again." Fix: measure the parsed lesson against the server's limit and show `fileTooLarge`.
3. `lesson-file.ts`: an unknown key is shown at any length. Text only, no XSS. Fix: cut it to about 60 characters.
4. `course-transfer.tsx`: `revokeObjectURL` straight after `click()` may cancel the download in some browsers; not checked in a browser or under the CSP. Fix: revoke after a timeout; add an e2e download check.

## Run by the reviewer

- `vitest run` on the four touched test files: 74 passed.
- `pnpm verify` (with `verify-deps-before-run=false`): 1955 of 1956; `chapter-list.test.tsx:180` failed once and passed 10 of 10 alone (untouched by this change).
- Not run: `pnpm test:db`, the canary, e2e, the download in real browsers.
