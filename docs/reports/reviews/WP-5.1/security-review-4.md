# WP-5.1 security review 4

Reviewer: security-reviewer. Scope: the working-tree diff that became the first commit of part 7 (owner action 7, security review 3 MINOR 1): `src/content/published.ts`, `src/infrastructure/db/public-client.ts`, `src/content/warm-cache.test.ts`, `src/infrastructure/db/public-client.test.ts`, on `wp/5.1-catalog` in `/private/tmp/claude-501/night-b`. The reviewer is read-only; its report is saved here as it was given, apart from the heading and this paragraph.

Verdict: APPROVE

The diff closes MINOR 1. The cache key and the client now get the database address from the same value, read once per call. I found no session or wrong-database path, the two readers' cache keys cannot collide, and the new tests fail when the fix is reverted. There is one new MINOR finding, about how the cache keys are now built.

## Does it close MINOR 1

Yes, both halves.
- **The address is read once:** In `src/content/published.ts:153`, `publicDatabaseAddress()` runs once per call. That value goes first in the cache arguments, and at `:149` the same value builds the client (`createPublicClient(database)`).
- **The client uses the address it is given:** `src/infrastructure/db/public-client.ts:17-21` now connects to that address and no longer reads `NEXT_PUBLIC_SUPABASE_URL` itself. A future switch to another address source can no longer make the key name one database while the data comes from another.
- **Future readers are covered:** Every cached reader in `src/content` goes through `cachedReader`, so a new reader cannot leave the address out of its key without dropping the helper. `src` has no other `unstable_cache`, `createPublicClient` or `publicDatabaseAddress` call outside tests.

## T-21: session and wrong database

- **No session:** The client options are unchanged: `persistSession`, `autoRefreshToken` and `detectSessionInUrl` are all false, and the key is the publishable key. The T-21 header test still passes. It checks the publishable key, no cookie, and either no bearer or only the publishable key.
- **The right database:** The only address that reaches `createPublicClient` comes from the environment schema, through `publicDatabaseAddress()`. It is never learner input.
- **The publishable key is still read inside the callback:** It is not part of the key. Review 3 already accepted this, because one address means one project and the same anonymous view.

## Cache key collisions

In `node_modules/next/dist/server/web/spec-extension/unstable-cache.js:54` and `:77`, the key is the callback's source text, then the key parts, then the arguments:
```
fixedKey = `${cb.toString()}-${keyParts.join(',')}`
invocationKey = `${fixedKey}-${JSON.stringify(args)}`
```
`incremental-cache/index.js:199-206` then hashes it with SHA-256.

Both readers now share one callback source, so their source text is identical. Only the key part and the arguments tell them apart. I rebuilt the keys with Next's formula; the endings are:
- `...args)-published-courses-["https://x.supabase.co"]`
- `...args)-published-course-["https://x.supabase.co","one"]`

They differ at the character right after `published-course` (`s` against `-`), so they are never equal (`equal: false`). The list call and the course call also take different numbers of arguments. The slug is the only part a visitor controls. It must match `^[a-z0-9]+(-[a-z0-9]+)*$`, be at most 60 characters, and appear in the cached list. It sits inside `JSON.stringify`, so it cannot break out of the arguments.

## Findings

1. **MINOR (T-21, new with this diff)**, `src/content/published.ts:144-158`.
   - **Problem:** Before this diff, each reader's own source text was in its key, so two readers with the same key part still got different keys. Now the source text is the same for every reader, so the key part and the arguments are the only thing that keeps readers apart.
   - **Attack:** A future reader made with a key part already in use and the same arguments would share cache entries with the older one. For example, a lesson reader by `(slug)` given `"published-course"` would return a course object as a lesson. It would also return a lesson as a course, whichever was cached first. That is the wrong content on a public page.
   - **Not exploitable today:** The two key parts differ, and the two readers take different numbers of arguments.
   - **Fix:** In `cachedReader`, keep a module-level `Set` of key parts and throw when one repeats. Add a unit test that a repeated key part throws. Alternatively, put the reader's name in the key parts as well. This should land with or before the next cached reader, which is likely the lesson pages.

Note, not a finding: `createPublicClient(address: string)` accepts any string. Its only caller passes the address that the environment schema checked. A branded type for that address, or a check that the address matches the environment's, would keep it that way. The boundary rule already limits `public-client` to `src/content`.

## Would the tests fail without the fix

Yes. I copied `src`, `scripts` and the configuration to `$TMPDIR`, linked `node_modules`, changed the copy, and ran the warm-cache and public-client test files on each change:

| Change to the copy | Result |
|---|---|
| Full revert of both files to `HEAD` | 2 failed: "builds the client with the address that formed the cache key" and "reads the database at the address it is given" |
| The callback reads the address again: `createPublicClient(publicDatabaseAddress())` | 1 failed: "builds the client with the address that formed the cache key" |
| `createPublicClient` ignores its argument and uses the environment's address | 1 failed: "reads the database at the address it is given" |
| A fixed value in the key instead of the address | 3 failed: both "two databases apart" tests and the new key-and-client test |
| No change | 9 passed |

The new warm-cache test changes `state.database` with `defineProperty` and puts it back in a `finally` block, so later tests are not affected. One limit: the warm-cache mock keys by key parts and arguments only, without the callback source. That matches the real key now that every reader shares one source. Because of that same shortcut, the tests would not catch the repeated key part in finding 1.

## What I ran

- `git diff` on the four files. I read `published.ts` and `public-client.ts` in full, both test files, `published.test.ts`'s mock, and security review 3.
- I read the Next.js source for how the cache key is built (`unstable-cache.js`, `incremental-cache/index.js`), and rebuilt the two keys with `node -e` using that formula.
- A search of `src`, `scripts` and `e2e` for callers of the cache, the client and the address function.
- `./node_modules/.bin/vitest run src/content src/infrastructure/db/public-client.test.ts`: 3 files, 25 tests passed.
- `./node_modules/.bin/tsc --noEmit -p .`: exit 0.
- `./node_modules/.bin/eslint` on the four changed files: exit 0.
- The changes in the table, run only in the copy in `$TMPDIR`. I deleted the copy afterwards. `git status` shows the same four modified files as before the review.

## What I could not check from here

- `pnpm verify`, `next build`, `check-bundle` and `check-static` on this diff.
- `pnpm test:db`, the e2e journeys (including the server pointed at port 1), CI, `pnpm infra:verify` and the T-21 canary test (WP-7.1).
- Whether Vercel shares its data cache between preview and production deployments. The address in the key makes that safe either way.
