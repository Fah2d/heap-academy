<!-- No AI attribution in this description or in any commit (CLAUDE.md rule 15). -->

**Base: `wp/3.4-statechart` (WP-3.1 to WP-3.4), which carries `main` at 032246c (WP-4.1 to WP-5.1).** Merges after WP-3.x and WP-5.1 (decision 10). Until then this pull request also shows their commits. On 2026-11-25 `main` at dffe1a8 came in through af95dc4 (one conflict, `src/ui/primitives/button.tsx`: this branch's `aria-keyshortcuts` effect and `main`'s announcement cleanup both kept) and `wp/3.4-statechart` at fd7b9dc through eaac0d7 (this branch's side kept in `playwright.config.ts`, `module-boundaries.mjs` and the workspace's `index.ts`, which already held both sides). On eaac0d7: `pnpm verify` exit 0, `Test Files  106 passed (106)`, `Tests  1951 passed (1951)`; `pnpm build` with CI's fake public values, `check-bundle` and `check-static` exit 0. The browser tests were not run again. The full history of parts 1 to 3 is in git and in `docs/reports/local-build-progress.md`.


## Up to date with main and WP-3.4

On 2026-11-26 `wp/3.4-statechart` came in twice: at 6f48e94, which carries `main` at 032246c (#18 and #19, so WP-4.3 and WP-5.1), in 5d6549b, and at 356520e in 485b103. Six files conflicted in 5d6549b:

- `src/content/published.ts`: `main`'s `cachedReader`, whose cache key holds the database address, now also builds the lesson reader (`cachedReader("published-lesson", readPublishedLesson)`); this branch's `PublishedLesson`, `readPublishedLesson`, `isSlug` and `publishedLesson` kept.
- `src/features/catalog/index.ts`: both sides' exports (the catalog's pages and this branch's `LessonPage`, `lessonMetadata` and `WorkspaceGallery`).
- `src/features/workspace/index.ts`: this branch's copy, which holds `main`'s exports and adds `Workspace` and `learnPath`.
- `src/infrastructure/logging/route.ts` and `src/messages/gallery.ts`: both sides kept.
- `docs/reports/local-build-progress.md`: both sides kept.

WP-5.1's checks then failed on this branch's lesson page, and 08df7cc answers them as `wp/5.4-progress-preview` already does: `src/app/indexing.test.ts` gives `/learn/[course]/[lesson]` its row as indexed (`03-experience.md` section 3), and `src/features/catalog/reads-only-content.test.ts` lets the lesson page and the development workspace page import exactly the workspace's index and the request nonce, and counts the lesson page among the readers of `@/content`.

On 08df7cc: `pnpm verify` exit 0 (`Test Files  122 passed (122)`, `Tests  2221 passed (2221)`). The e2e job of CI ran here against the local stack, freshly reset before each run (`supabase db reset`), with `CI=1` and the stack's publishable key: `pnpm test:e2e --project=chromium --project=stack --project=gallery`. First run: `119 passed`, `1 failed`, `1 skipped`; the failure was the second sign-in of `[FR-ADM-01] [FR-ADM-02] [NFR-SEC-06] [T-19] an admin passes setup, then verify in a new session`, where Cloudflare's Turnstile test widget left `cf-turnstile-response` empty for 15 s (`e2e/sign-in-helpers.ts:38`). No sign-in, header, proxy or journey file differs from `wp/3.4-statechart`, where the same journey passed. Second run, unchanged: `120 passed`, `1 skipped` (`[T-19] repeated wrong codes are limited`, a `test.fixme` that `main` has too), exit 0. Not run: Firefox, WebKit, and the `runtime-*` projects that hold this package's workspace journeys, which CI does not run on a pull request.

## What

WP-5.2, the lesson workspace on a laptop: `/learn/[course]/[lesson]` with instructions, the editor, Run, Check and Stop, the console with its input line and batch field, the tests panel, an error view for every kind, hints, Python's status, reset with undo, previous and next, shortcuts, the unsupported-browser message, and saved code on the device. The page's server part reads published content through `src/content` with no session (no solution columns). `/dev/workspace` shows the spec's example lesson with no database, for the browser tests.

Part 4 (this run): a journey for Python restarting after output over the limit; the console below 768 px now scrolls inside a 24 rem ceiling (before, 64,000 printed characters made the 375 px page 50,737 px tall, with the error card at the bottom); decision 14's spec change written; this description shortened (speed mode).

## How it was verified

- `pnpm verify` on part 4: exit 0, `Test Files  104 passed (104)`, `Tests  1942 passed (1942)`. `pnpm build` with the fake public values: exit 0. `check-bundle`: `No server variable (RESEND_API_KEY, HEAP_RELEASE) in 24 files under .next/static.` `check-static`: exit 0. Part 4 is 8c2a19f.
- `e2e/workspace-runtime.spec.ts`, Chromium, 15 of 15 passed, one test per process, against `next dev --webpack` on port 3264 with the fake public values. Covered: J-2, J-3, J-4; keyboard in and out of the editor; T-07 markup printed as text; source limit refused; NFR-PERF-03 (Python's files held: the lesson reads, the editor takes typing); failed load and Retry; syntax error and Go to line; reset and Undo; saved code after reload; no `Worker` (FR-SYS-02); a long program reachable by keyboard; output over the limit, Python restarting, the next Run works. Axe on each state.
- The new console-height assertion failed without the fix (`Received: 49207`, expected at most 384) and passes with it.
- Screens of 13 states at 1280, 768 and 375 px in `docs/reports/screens/WP-5.2/`.
- Not run: Firefox and WebKit (speed mode: Chromium only), `pnpm test:db` (no database change), the real route with seeded data.

## Reviews

One round, as speed mode asks. Code review 1 and security review 1 on b386309: both CHANGES REQUIRED; both blockers, the security major and the code majors fixed in bd36501 (MAJOR 4 is decision 10). Reports in `docs/reports/reviews/WP-5.2/`. No design review (speed mode).

## antislop Delivery Gate report

antislop active: during (session override, CLAUDE.md rule 5). Dials from `DESIGN.md`: ENERGY 1 / RHYTHM 1 / MOTION 1.

- Block 1: PASS. R-02: no em dash in `src/messages/workspace.ts` or the workspace components (grep). R-03: 375 px screens of all 13 states, no horizontal page overflow; the console ceiling fixed the one broken state. R-17/R-36/R-38: the only numbers are real limits and real download bytes. R-23/R-24: no asset added; Back and Previous/Next point at real routes (Back needs WP-5.1, decision 10). R-25/R-39: axe passed on every state. R-26/R-35: every control driven by the journeys. R-27: loading, failed, restarting, empty console, refused, and error states exist. R-32: keyboard journey and focus kept on unavailable buttons (decision 11). R-40: no media; Python loads after the page.
- Block 2: PASS. No gradient, glow or shadow. Carbon icons only where they name the action (Run, Check, Stop, Reset).
- Block 3: PASS. Focal point: Check (amber, the one accent) until the lesson passes, then Next. Identity motif: Plex Mono for the code, the console and the shortcut keys.
- Block 4: PASS. No template layout; the panes follow `03-experience.md` section 6.1.

## Decisions (safe defaults; 1 to 9 approved 2026-11-24; 10 to 18 taken under the owner's standing approval of recommended defaults, restated at this run's start)

1. Base as above; `wp/4.3-validate-publish` not merged (not a dependency).
2. WP-3.1's later run fixes arrive only through `wp/3.4-statechart`.
3. Shortcuts: Cmd or Ctrl + Enter on Apple systems, Ctrl elsewhere; Shift adds Check.
4. The published-lesson read returns stored test cases; the workspace parses them with the grader's schema.
5. FR-WSP-23 (a Should) left out.
6. No caret under the column (the protocol has no column); written in `03-experience.md` section 6.5.
7. The lesson page's server part lives in `src/features/catalog`.
8. A failed read ends on the shared error page with status 500.
9. The lesson page joins the sitemap with whichever of WP-5.1 and WP-5.2 merges second.
10. WP-5.1 merges before WP-5.2 (the Back link goes to its course page).
11. Run, Check, Stop and Reset stay focusable while unavailable (`aria-disabled`).
12. The input line takes focus back after each answer.
13. Saved code is not capped; an over-limit program is refused when run.
14. `04-content-system.md` section 7's example now uses a fenced `python` block, marked approved by the owner on 2026-11-24.
15. Sizes off the spacing scale are component tokens in `src/ui/tokens/components.css`.
16. The editor's text area has `tabindex="0"` for axe's `scrollable-region-focusable`.
17. The wait before axe and screens ignores endless animations.
18. Below 768 px the console scrolls inside `--workspace-console-max` (24 rem). WP-5.3's phone views may replace it.

## Left for later

WP-5.4: saving off for the admin preview, `onversionchange`, the memory-fallback notice, J-2's completion line and XP. WP-5.3: the phone layout. WP-7.4: Firefox and WebKit.

## Risks and rollback

`src/content/published.ts` also changes on `wp/5.1-catalog`; the merge adds both sides. Unmerged branch; nothing to roll back.
