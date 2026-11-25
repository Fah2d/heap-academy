# WP-5.1 code review 3

Reviewer: code-reviewer, of `621d4aa` and `c820910` on `wp/5.1-catalog`, in the checkout at `/private/tmp/claude-501/night-b`. Verdict: **CHANGES REQUIRED**.

**What holds up:**

- **Server order.** Playwright 1.65.1 starts the web servers one at a time. Each one's setup waits for its port before the next starts (`runner/index.js:6425`, `createPluginSetupTasks`). So the outage server only starts after `pnpm build` has finished and port 3100 is open.
- **The port-1 address takes effect.** The server reads `NEXT_PUBLIC_SUPABASE_URL` when it runs, not when it is built. `grep -rl "127.0.0.1:54321" .next/server` finds nothing, and the server chunks read `all.NEXT_PUBLIC_SUPABASE_URL` from the parsed object. Playwright's `env` overrides the workflow's value.
- **The spacing changes are logical properties.** In the built CSS: `.-my-2{margin-block:calc(var(--spacing-2) * -1)}`, `.py-2{padding-block:var(--spacing-2)}`, `last\:pbe-0:last-child{padding-block-end:var(--spacing-0)}`.
- **No user-facing literals.** Both specs take their strings from `src/messages`.
- **No weakened check.** No skip, retry, timeout change or suppression.
- **Attribution.** Both commits are authored and committed by Fahad, with nothing else in them.

**Round 3 design findings:**

- 2: answered, but the spec does not hold up once the local stack has run (finding 1).
- 3: answered.
- 6: answered at `text-lg`; about 2.4 px is left at `text-base` (finding 3).
- 7: answered.
- 10: answered.

## Findings

1. **MAJOR**, `playwright.config.ts:76-81` together with `src/content/published.ts:135-145`. **The outage server can serve the real catalog with a 200 from the cache it shares with the server on port 3100.**
   - **How the cache is shared.** Both production servers serve the same `.next` folder. `unstable_cache` stores its answers in `.next/cache/fetch-cache/<key>`. Next.js 16.4.6 reads that file whenever an answer is not in the process's own memory (`file-system-cache.js:168-178`). The key is built from the function's source, the key parts and the arguments (`unstable-cache.js:54,77`, `generateSimpleCacheKey`). It contains neither the build ID nor the database address, so both processes use the same key.
   - **Why an expired answer still comes back.** An answer older than 60 s is returned with `isStale` set (`incremental-cache/index.js:404-419`). `unstable_cache` then hands back the old value at once and re-reads in the background. When that re-read fails, it logs the error and keeps the old value (`unstable-cache.js:175-210`).
   - **Why expiring the tag does not help.** The tag record is a `Map` held in each process's memory (`tags-manifest.external.js`). When the journey expires the tag on 3100, the outage process never learns of it.
   - **Why it survives a new build.** `next build` keeps `.next/cache` (`build/index.js:626`, it keeps `'cache'`).
   - **Result in CI.** `catalog-journey.spec.ts` (`stack` project, port 3100, local stack running) visits `/` and `/courses` (lines 221, 247, 268). From then on, `/` and `/courses` on 3102 answer 200 with the cached list. `/courses/python-basics` answers 404, because that slug is not in the seed. All three outage tests would then fail. Today the outage file probably runs first only because of project and file order, and nothing enforces that order.
   - **Result locally.** After any run in which 3100 read the local stack, every later outage run fails, with no time limit.
   - **Why the sandbox run did not show it.** There was no stack in the sandbox, so 3100's reads also failed and nothing was cached: `.next/cache/fetch-cache` does not exist there. The "also in CI" claim was reasoned, not observed.
   - **Fix, recommended:** put the database address into the cache key, e.g. key parts `["published-courses", url]`, read lazily, with a unit test. That is also correct in production: a persisted cache should never serve content from a different database.
   - **Alternatives:** a separate build for the outage server, or not writing the cache to disk for that server only. Then run the outage spec once with the stack up and the journey run first.

2. **MINOR**, `e2e/catalog-outage.spec.ts:27`. **The 30 s default timeout holds, but a fixed 14 s wait inside each test is not recorded.**
   - **Where the 14 s comes from.** postgrest-js 2.119.2 retries a rejected fetch 3 times, waiting 1, 2 and 4 s (`DEFAULT_MAX_RETRIES = 3`, `getRetryDelay`). That is 7 s per read. Each failed view reads twice (round 2, finding 3), so `load` arrives at about 14 s.
   - **Why it is safe today.** Those waits are timers, so a slow CI runner adds only the axe and screenshot time. With about 15 s measured per test, the margin is roughly 15 s.
   - **What would break it.** A third read, or a change to the library's retry policy, would time the test out with no clear message. `test.slow()` is not an option: it would raise a timeout.
   - **Fix:** say in the spec comment why each test takes 14 s. Better, use an outage address that fails without retries, e.g. one that answers a status other than 503 or 520 at once. That keeps the test short whatever the library's retry policy.

3. **MINOR**, `src/ui/primitives/link.tsx:33-36`. **The comment claims a one-line title takes exactly the room of its line; that is true only at `text-lg`.**
   - **Arithmetic** (border-box, 44 px minimum, 8 px padding each side): the margin box is 44 − 16 = 28 px.
   - **At `text-lg`** (20 px × 1.4 = 28 px, course list titles) that matches the line exactly.
   - **At `text-base`** (16 × 1.6 = 25.6 px, home page titles at `h3`) a one-line title still takes 28 px, which is 2.4 px more than its line. A wrapped title takes 2 × 25.6 px.
   - **Fix:** padding of `(44 px − 1lh) / 2` with the matching negative margin, or a corrected comment that records the residue.

4. **MINOR**, `src/ui/primitives/primitives.test.tsx:117-129`. **The new unit test checks class names, not layout.**
   - It passes for any class string that contains `py-2` and `-my-2`, whatever the line height. It cannot see the residue in finding 3.
   - The e2e height check (`box.height >= 44`) still passes if `py-2` and `-my-2` are both removed, because `min-block-target` alone gives 44 px.
   - Nothing measures "a one-line title is as tall as its line".
   - **Fix:** a gallery e2e check that a one-line title's heading box height equals its computed `line-height`.

5. **NIT**, `e2e/catalog-gallery.spec.ts:11-13`. The header comment still says a failed read is checked only at `/dev/error`. It should now point to `e2e/catalog-outage.spec.ts`.

6. **NIT**, `e2e/catalog-outage.spec.ts:12`. Port 3102 is written in the spec and again as `outagePort` in the config. Export it once, or say in a comment that the two must match.

**Asked to check: can the `-my-2` margin clip or overlap anything?** It does not clip. The row has `p-5` (20 px). No `overflow`, `truncate` or `line-clamp` appears in `src/features/catalog` or `src/features/shell`. `variant="heading"` is used only in `course-rows.tsx:34` and the development-only primitive gallery. The link's lower padding ends exactly at the summary (`gap-2`, 8 px). The 2 px focus ring with its 2 px offset reaches about 4 px into the summary's line spacing, not into its letters. In `catalog-focus-course-title-375.png` the ring clears the summary's capitals.

**Focus tests.** The four tests would fail without the global `:focus-visible` ring, and also fail if a link drops out of the Tab order. The 375 px focus screens differ: different hashes, with the ring on the course title and on Courses.

## What I ran

- `pnpm verify`: exit 0, 67 files, 1210 tests. The only warning was a pnpm install-lock warning caused by the sandbox.
- `git show` and `git log --format=fuller` on both commits.
- Read the Next.js 16.4.6 cache code: `file-system-cache.js`, `incremental-cache/index.js`, `unstable-cache.js`, `tags-manifest.external.js`, and the clean step in `build/index.js`.
- Read Playwright 1.65.1's web server start-up code and postgrest-js 2.119.2's retry code.
- Built CSS: `-my-2`, `py-2`, `last:pbe-0`, `min-block-target`, and the spacing tokens.
- Grepped `.next/server` for an inlined database address.
- Looked at the 375 px focus screens and compared the hashes of all four focus screens.

## What I did not run

- No e2e spec, as asked, so finding 1 comes from the source code and was not reproduced.
- `pnpm test:db`.
- The outage spec with the local stack up.
- Firefox and WebKit.
- The design review of the new screens, beyond the two focus screens.

The reviewer is read-only; the implementer saved this report verbatim from its answer.
