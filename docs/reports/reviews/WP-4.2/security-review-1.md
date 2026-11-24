CHANGES REQUIRED

WP-4.2 (the lesson editor), range `origin/wp/4.1-courses-chapters...be24f80`, focused on 7ac42e4..be24f80. I found no blocker: no path lets a non-admin change content or read a solution, wrong answer or draft. Two majors stop approval. One is the editor's nonce on in-app navigation; the other is that the new packages were never installed by pnpm.

## MAJOR 1. The code editor's styles will likely be blocked when it is reached by in-app navigation (NFR-SEC-02, T-15, WP done criterion "the editor's styles load with no policy violation")

- **Where:**
  - `src/features/admin/components/lesson-editor-page.tsx:52` passes `nonce={await requestNonce()}`.
  - `src/infrastructure/http/nonce.ts:12` reads that nonce from the request.
  - `src/features/workspace/components/code-editor-extensions.ts:160` gives it to CodeMirror (`EditorView.cspNonce.of(nonce)`).
- **The problem:** the browser checks style nonces against the policy of the page load that built the document. When the editor is reached by an in-app link, the page data comes from a new request, and `proxy.ts` gives that request a new nonce. The matcher only skips `_next/static`, `_next/image` and `favicon.ico`. So the editor stamps its style element with a nonce the document's policy does not contain, and the styles are refused.
- **How it is reached:** "Add lesson" uses `router.push` (`lesson-rows.tsx:177`) and the lesson title is a Next `Link` (`lesson-rows.tsx:97`). Both are in-app navigations. This is exactly the path `e2e/lesson-editor-journey.spec.ts` takes before it asserts `violations == []`, and that test was not run.
- **Evidence:** CodeMirror's style library (`node_modules/style-mod/src/style-mod.js:119-126`) uses a `<style>` element with `setAttribute("nonce", …)` whenever the document has a `head`. Later editors reuse that element. I could not confirm this in a browser: headless Chromium crashes in this sandbox (SIGTRAP).
- **Attack:** none directly. The risk is a broken control with an unrun test, and the easy "fix" would be to loosen `style-src`. The same problem will reach the learner workspace in WP-5.2.
- **Fix:**
  - On the client, use the nonce of the document that is actually loaded. Either read it once from the page's own scripts (`document.querySelector("script[nonce]")?.nonce`), or provide it through a client context in the root layout, which does not re-render on in-app navigation.
  - Run the journey on a machine with a working browser: `pnpm test:e2e e2e/lesson-editor-journey.spec.ts`.
  - Add a check that first reaches the editor through a `Link`, then asserts there are no `style-src-elem` violations.
  - `.claude/rules/react-next.md` says to "read it from the request headers on the server and pass it down". That rule needs a `spec-change` once the fix is chosen.

## MAJOR 2. The new dependencies were copied in from an npm install, with no pnpm lockfile (supply chain)

- **Where:** `package.json:28-34`. `pnpm-lock.yaml` has no `codemirror` entry (`grep -c` gives 0).
- **Evidence:**
  - `node_modules/@codemirror/*`, `node_modules/@lezer/*`, `style-mod`, `crelt`, `w3c-keyname` and `@marijn` are plain folders dated Nov 23 00:39, outside `node_modules/.pnpm`.
  - They are byte-identical (`diff -rq`) to the npm install in `/tmp/claude-501/cm-side`, whose `package.json` uses caret ranges.
  - The transitive packages are not pinned anywhere in the repository: `@codemirror/autocomplete` 6.20.4, `@codemirror/streamparser` 6.0.0, `@lezer/common` 1.5.6, `@lezer/lr` 1.4.12, `style-mod` 4.1.5, `crelt` 1.0.7, `w3c-keyname` 2.2.8, `@marijn/find-cluster-break` 1.0.4. All resolved from registry.npmjs.org with sha512 integrity in the side lockfile.
  - CI runs `pnpm install --frozen-lockfile` (`.github/workflows/ci.yml:113,135,162,210`, `deploy.yml:83`), so CI will fail.
- **Effect:** the `pnpm verify`, `next build` and bundle-check results describe a dependency tree that pnpm never resolved and that nothing in the repository records. A later `pnpm install` may pick different transitive versions than the ones tested.
- **The choice itself is fine:** CodeMirror 6 is ADR-0013, and the direct versions are pinned exactly.
- **Fix:** the owner runs `pnpm install` outside the sandbox and commits `pnpm-lock.yaml` in this pull request. The pull request lists the resolved transitive versions against the ones above. Then rerun `pnpm verify`, `next build`, `check-static` and `check-bundle` on the locked tree.

## MINOR

1. **Zod's eval probe in the admin client bundle (NFR-SEC-02, T-15).**
   - **Evidence:** `.next/static/chunks/0xmtsiie60xmj.js` contains Zod 4.6.7's `allowsEval`: `try{return Function(""),!0}catch…`. It runs when the first `z.object` schema is built. `jitless` is not set anywhere in `src`.
   - **Who loads it:** only the `/admin/*` routes, per the client reference manifests.
   - **Likely effect:** with no `unsafe-eval`, browsers report a `script-src` eval violation even when the error is caught. That would add noise to `/api/csp-report` and fail the journey's `violations == []` check. Not verified in a browser.
   - **Probably not new:** the course editor's `courseDetails.safeParse` from WP-4.1 already constructs object schemas on the client.
   - **Fix:** call `z.config({ jitless: true })` in a client module that loads before any schema. Never add `unsafe-eval`.
2. **A move during a save can be overwritten (FR-ADM-10).**
   - **Where:** `src/features/admin/server/lesson-store.ts:63-87`. `saveLesson` reads `position`, then calls `save_lesson` with it.
   - **The gap:** a move now keeps `updated_at`, so the stale check does not cover position. A Move up or Move down that lands between the read and the RPC is silently undone. That can leave two lessons at the same position, and nothing in the schema makes positions unique.
   - **Not a security issue:** only admins at `aal2` can do this. It is an integrity issue.
   - **Fix:** keep the position in SQL unless the chapter changes. For example, a null `p_position` means "keep", or the position is derived inside `save_lesson`.
3. **No test tries to break the new trigger rule** (`.claude/rules/database.md`: each trigger has a test that tries to break it).
   - **Where:** `supabase/migrations/20261122010000_lesson_order.sql:51-59`, the `to_jsonb` comparison that lets a move keep `updated_at`.
   - **What is missing:** `supabase/tests/database/12_lesson_order.test.sql` never tries to supply `updated_at`. Two cases are untested: `set position = 1, updated_at = now() - interval '1 day'` and `set updated_at = …` alone. By reading the code, both keep the old value, which is correct, but nothing locks that in.
   - **Also untested:** a save with no changes now keeps its version, which is a change from before.

## Checked and found sound

- **Admin gate:** `/admin/lessons/[id]` runs `requireAdminStage("allow")` after the layout's `requireAdminList()`. A malformed or unreadable ID gets `notFound()`. `proxy.ts` sends `cache-control: private, no-store` for every `/admin/*` path. The editor reads through the session client, so row level security returns the solution only to an admin at `aal2`.
- **Server actions:** `saveLesson`, `createLesson`, `renderInstructionsPreview` and the lesson `reorder` all use `defineAction` with `access: "admin"`, strict schemas and byte caps. Tests refuse a guest, a learner at `aal1` and `aal2`, and an admin at `aal1`, before any database call. The draft schema rejects `status` and `tests` (strict object), and `p_validated` is always `false`. A chapter from another course is stopped by the composite foreign key. Database error text is mapped to typed codes and never sent to the client.
- **`reorder_lessons`:** `security invoker`, `search_path = ''`, qualified names, and `execute` revoked from `public` and `anon`. It is tested as anonymous (privilege check), a learner, an admin at `aal1` (both refused, nothing changed) and an admin at `aal2` (partial, foreign, repeated and null orders refused). The trigger rewrite is identical to the original apart from the `updated_at` rule. The publish rule still runs last.
- **Lesson content (T-06):** no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function` in `src`. The highlighter returns text runs and React renders each as a text node. Links go through `ExternalLink` with `rel="noopener noreferrer"`. The preview and the learner view are the same `LessonContent` component, and the 27 malicious fixtures are asserted inert in the rendered DOM.
- **Part-1 findings:** the memory major is fixed. `MAX_TABLE_COLUMNS = 20`, and my probe at 20,000 characters gave JSON at most 15.8 times the input, in 3 ms or less. Python highlighting at its 10,000-character cap took 16 ms or less and gave back the code exactly. Hostile inputs rendered as text, or were dropped.
- **Nonce plumbing:** `proxy.ts` always overwrites the request's `content-security-policy`, so a client cannot choose the nonce that `requestNonce()` reads.
- **Bundles:** no solution or column names (`solution_code`, `lesson_solutions`) in `.next/static`. No server variables found.

## What I ran

- `pnpm verify`: exit 0. 67 files, 1247 tests passed.
- The PGlite pgTAP runner in `/tmp/claude-501/harness`, with and without `SEED=1`: all 12 files pass, 356 assertions, 18 of them in `12_lesson_order`.
- `node scripts/check-static.mjs .next` and `node scripts/check-bundle.mjs .next/static`: both clean. This was on the existing `.next` (built Nov 23 00:40), not a fresh build.
- Probes kept outside the repository, in `$TMPDIR/probe42`: renderer output size and timing, highlighter timing and round trip, hostile inputs.
- Scans of the client chunks for `Function(`, `eval` and solution field names, and the route-to-chunk mapping.
- The provenance of the new packages: `diff -rq` against `/tmp/claude-501/cm-side` and its lockfile.

## What I could not check from here

- Browser behavior. Playwright's Chromium is installed but crashes in the sandbox, so MAJOR 1 and MINOR 1 come from reading the code, not from a browser run.
- `pnpm test:db` against real Supabase (Docker is unavailable) and `pnpm infra:verify`.
- The T-21 canary test, which does not exist yet.
- The deployed headers.
- Registry provenance beyond the integrity hashes in the side npm lockfile.
