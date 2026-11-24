APPROVE

Range `e1f1ce9..HEAD` at c5902d0 (commits e51304f, ecbb815, 87af7ec plus docs). No BLOCKER or MAJOR. No way found for a non-admin to change content or read a solution. Every finding from round 1 is fixed at HEAD.

## Round 1 findings at HEAD

- **MAJOR, T-07: fixed.** `src/grader/console-text.ts` removes CSI and OSC escape sequences, any other ESC pair, C0 controls except tab, line feed and carriage return, DEL, the C1 range (so the one-byte 0x9B CSI too), and the bidi marks, embeddings, overrides and isolates. `src/features/admin/validation-view.ts` runs it on `actual` and on Python's error message (`verdictOf`). Fill from solution is offered only when the program ran to its end, the output was not cut, nothing was removed, and the output differs from the expected output. Covered by `console-text.test.ts` (including a property test that cleaning twice changes nothing), `validation-view.test.ts:213` and `test-case-list.test.tsx:381`.
- **MINOR, T-23 (no test that opening runs nothing): fixed.** `lesson-editor.test.tsx` checks that `checkProgram` is not called when a draft or a published lesson opens.
- **MINOR, status cast without parsing: fixed.** `lesson-store.ts:133` uses `storedStatus.safeParse(current.status)`.

## This range

- **Dev gallery.** The only route is `src/app/dev/admin/page.dev.tsx`; `pageExtensions()` adds `dev.tsx` only for `PHASE_DEVELOPMENT_SERVER`, covered by `page-extensions.test.ts`. The existing `.next` production build (17:23, not run by the reviewer) has no `/dev/*` route, and gallery strings appear 0 times in `.next/static`. `fixedResultsRuntime` returns canned results from `src/messages/gallery.ts`; no real solution or wrong answer is involved.
- **Console output.** Nothing new renders output except through `<pre>{text}</pre>`.
- **Limits in admin copy.** Functions of `CHECK_TEST_LIMIT`, `HARNESS_OUTPUT_LIMIT` and `TIME_LIMIT_MS`, formatted with `Intl.NumberFormat`; no user input in a format string.
- **`useFocusAfterCommit` and selectors.** `openTestCase` builds `[data-test-case="${id}"] …`; ids reach the editor only through `parseTestCases` (`TEST_CASE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/`) or `newTestCaseId`, so no selector injection.
- **Lockfile (9538964 / 4148777).** Additions only (135 lines), no tarball or git URLs: the seven CodeMirror and Lezer packages pinned in `package.json` plus `@codemirror/autocomplete`, `@codemirror/streamparser`, `@lezer/common`, `@lezer/lr`, `@marijn/find-cluster-break`, `crelt`, `style-mod`, `w3c-keyname`. `@codemirror/streamparser` is maintained by marijn and is a dependency of `@codemirror/language@6.13.1`, whose lockfile hash matches the registry.
- **Risky patterns.** No `dangerouslySetInnerHTML`, `eval`, `new Function`, `innerHTML`, `process.env`, console logging, privileged client, suppression, or `.skip`/`.only`.

## Findings

**MINOR, `src/grader/console-text.ts:17-28`, T-07.** Invisible and format characters are kept: U+200B to U+200D, U+2060 to U+2064, U+FEFF, U+2028/U+2029 and the soft hyphen. A solution that prints `6​` shows as "6", is not marked as cleaned, and Fill copies the invisible character into an expected output that learners read. Fix: add those code points to `isControl`, and add a test.

**Note (before this range, not counted), T-21 bundle hygiene.** `src/features/workspace/index.ts:6` exports `RuntimeConsole`, a dev tool used only by `page.preview.tsx`. The admin pages import that barrel, so the tool and `EXAMPLE_LESSON` (the public example from `04-content-system.md` section 7, with its solution and wrong answer) end up in a production chunk referenced only by the admin pages. Nothing real leaks, but it contradicts the "no route, no bundle" comment in `next.config.ts`. Fix in its own work package: import `RuntimeConsole` straight from its component file in `page.preview.tsx` and drop it from the barrel.

## What the reviewer ran

Read the full diff, e1f1ce9, `console-text.ts` and its test, `validation-view.ts`, the gallery entry points, `page-extensions.ts`, `next.config.ts`, and T-07, T-21, T-23. `pnpm verify`: exit 0, 98 files, 1837 tests. Lockfile diff check plus npm registry lookups. `grep` over `.next/static` and the client reference manifests.

## Not checked

`pnpm test:db`, `pnpm test:e2e`, the T-21 canary and `pnpm infra:verify` (not built yet), a fresh production build, CI results.
