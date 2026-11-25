# WP-5.1 security review 3

Reviewer: security-reviewer. Scope: `621d4aa`, `c820910`, `9268830` ("fix(content): key the content cache by the database address") and `b911903` ("test(e2e): check a one-line course title's height..."), on `wp/5.1-catalog` in `/private/tmp/claude-501/night-b`.

Verdict: APPROVE, with one minor finding and one note.

The fix closes the problem that code review 3 found. Both cached readers now take the database address as their first argument:

- the course list, called at `src/content/published.ts:179`
- one course, called at `src/content/published.ts:195`

So the address is part of the key that Next.js 16.4.6 builds. In `node_modules/next/dist/server/web/spec-extension/unstable-cache.js:54,77` the key is the function's source, the key parts, and `JSON.stringify(args)`. `incremental-cache/index.js:199-206` then turns that into a SHA-256 hash. The address never appears in a cache file name. It is also not stored in the entry: the two entries on disk in `.next/cache/fetch-cache` hold only `{"kind":"FETCH","data":{"headers":{},"body":"[]","status":200,"url":""},"revalidate":60,"tags":["content"]}`.

A server pointed at another database, such as a preview pointed at staging, can no longer serve answers cached from the first database, and the first cannot serve its answers. Before the fix it could, which could have shown courses published in one database on a site reading a database where they are drafts (T-21). The compiled server chunk has the fix: `M(){return I("published-courses",()=>N(E()))}`. Here `E` parses `process.env` when the server runs, so the address is not inlined at build. That fits the reported test where the port-1 server answers 500.

## Checks against the questions asked

- **Can the address leak to a visitor?**
  - **Responses:** The address is not in any response. `ContentResult` carries only the parsed course fields, and a failed read returns `{ ok: false }`.
  - **Logs:**
    - `settle` (`published.ts:158-173`) logs fixed fields only: level, `requestId: "none"`, route and outcome. It never logs the error.
    - `publicDatabaseAddress()` runs inside the closure that `settle` wraps, so a bad environment value is also caught there. Even when it is not caught, `EnvironmentError` names the variable and the reason, never the value (`src/infrastructure/env/schema.ts:98-110`).
    - Next.js's own debug metric label (`fetchUrl`) uses the hashed key, because both callbacks are anonymous.
  - **Client bundles:** Both `published.ts` and `public-client.ts` start with `import "server-only"`. A search of `.next/static` found no database address at all and no `published-courses`, `_database` or `publicDatabaseAddress`. Today the address is not in any client bundle; this change does not add it there. It is a `NEXT_PUBLIC_` value, so it would be publishable anyway.
- **Does anything private enter the key or the cache?** No. The key holds the function source, `published-courses` or `published-course`, the address, and the slug. The slug must match `SLUG_PATTERN`, be at most 60 characters, and appear in the cached list. The cached values are still anonymous reads made under row level security with the publishable key. No session, cookie, header, user ID or key enters the cache. The publishable key is not in the cache key, which is correct: the same address with any publishable key means the same project and the same anonymous view.
- **Rule 8:** Unchanged. Every read uses the sessionless client, so row level security decides. The privileged client is not touched or imported.
- **Rule 9:** `src/content` still imports only `infrastructure/db/public-client`, `env` and `logging`. The new export lives in the module that the boundary rule already allows (`scripts/eslint/module-boundaries.mjs:55-56`). Nothing outside `src/content` imports `public-client`. These are still the only two `unstable_cache` calls in `src`. There is no `use cache`, `cacheTag` or `force-cache`.
- **Rule 10:**
  - No secret is added anywhere.
  - The third Playwright server (`playwright.config.ts:76-81`) gets the same environment as the others, with `NEXT_PUBLIC_SUPABASE_URL` set to `http://127.0.0.1:1`. The schema's local-host rule accepts that value. `RESEND_API_KEY` falls back to the fake `re_example_not_a_real_key`.
  - No `.env` file was read.
- **Module boundaries (section 4.1):** ESLint exits 0 on every changed file. `src/content` depends only on `domain` and the allowed `infrastructure` modules.
- **The other commits:**
  - `621d4aa` changes only class names: the heading link's `-my-2 py-2` and the section gaps. It adds no HTML sink, no string, and no new prop that carries data.
  - `c820910` and `b911903` change only tests and comments. The outage spec reads only `src/messages/system` and stores only screenshots.
  - No lockfile, `package.json`, workflow, proxy, header, `next.config`, migration or policy file changed in `4c41f93..HEAD`.

## Findings

1. **MINOR (T-21, a weakness in the design of the fix)**, `src/content/published.ts:143-153`, `179` and `195`.
   - **Problem 1:** The address in the key and the address the client reads are found separately. `publicDatabaseAddress()` runs in the caller, and `createPublicClient()` runs inside the callback. Each parses `process.env` on its own, so today they agree. But if `createPublicClient` ever moves to a different source, such as a server-only internal address, the key would describe one database while the data comes from another, and the bug would come back without any test failing.
   - **Problem 2:** Every future cached query must remember to pass the address first. The lesson pages are the next likely place, and a missing address there would bring the same problem back for that page only. The two new warm-cache tests prove the behaviour for the two existing readers only. Their mock keys by key parts and arguments, so the tests would fail without this fix.
   - **Fix:** In `published.ts`, add one local helper that reads the address once, puts it first in the cache arguments, and passes the same value to the client, for example `(database, slug) => readPublishedCourse(createPublicClient(database), slug)`. Every cached reader in `src/content` then goes through that helper. A small unit test can check that the client is built with the address that formed the key.
   - **Timing:** This is not needed for this pull request. It should land with or before the next cached query.

**Note (older than this round, not a finding):** `playwright.config.ts:23-25` says "no test reaches Supabase or Resend". That has been inaccurate since the `stack` project, whose journeys use the local Supabase stack. It now also sits beside a server pointed at port 1. The comment is only a description, and no control depends on it. Correct it the next time the file changes.

**Status of the round 2 findings:** MINOR A (lint does not check a template-literal `import()`), B (the page data check does not prove it got page data) and C (the hand-kept route list in the catalog import test) were not rechecked. None of their files changed in these commits.

## What I ran

- `git show` of the four commits, excluding `docs`. Read in full: `src/content/published.ts`, `src/content/index.ts`, `src/infrastructure/db/public-client.ts`, `src/infrastructure/env/schema.ts`, `playwright.config.ts`, the cache mocks in `published.test.ts` and `warm-cache.test.ts`, and the boundary rule's `src/content` allow-list.
- The Next.js 16.4.6 source for how `unstable_cache` builds its key and what it stores (`unstable-cache.js`, `incremental-cache/index.js`): SHA-256, and stored entries carry `url: ''`.
- `vitest run` on `src/content`, `public-client.test.ts`, `primitives.test.tsx` and `scripts/eslint`: 5 files and 186 tests, all passed. That includes "keeps the answers of two databases apart", "keeps a course page of two databases apart", "publicDatabaseAddress ... read when called" and the heading link test. I ran it through `./node_modules/.bin/vitest`, because `pnpm exec` first tried an install that the sandbox's store lock refused. Nothing changed as a result.
- `eslint` on the eight changed source and e2e files: exit 0.
- Searches of the existing build (`.next`, built 14:18):
  - `.next/static` for database addresses, cache code names, `sb_secret`, `service_role` and the Resend key: none found.
  - `.next/cache/fetch-cache`: two entries, with no address and no secret.
  - The compiled server chunk: it carries the keyed calls.
- A search of `src` for every data cache use: only the two in `published.ts`.
- `git status` before and after. The only change during the review was an untracked `docs/reports/reviews/WP-5.1/code-review-3.md`, which I did not create.

## What I could not check from here

- Every e2e spec, as instructed, including `catalog-outage.spec.ts` and the new focus and height checks.
- The before-and-after test with two servers and a fake PostgREST. I relied on the implementer's report and the compiled code, and did not rerun it.
- `pnpm verify` and `next build`. I took the reported results (exit 0, 1213 tests; build, `check-bundle` and `check-static` exit 0) and did not rerun them.
- `pnpm test:db`, CI, `pnpm infra:verify`, and the T-21 canary test (WP-7.1).
- Whether Vercel shares its data cache between preview and production deployments of one project. The fix makes that safe either way, but I did not confirm how Vercel behaves.

The reviewer is read-only; the implementer saved this report verbatim from its answer.
