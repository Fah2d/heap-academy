# WP-4.1 security review 1 (condensed)

Reviewer: security-reviewer, of a039c64. Verdict: CHANGES REQUIRED. The database blocks every traced attack: a learner or an admin at `aal1` cannot write a course or chapter through the actions, the Data API, or the reorder functions, and no draft or solution reaches a public query. Two controls lack a test that proves them.

- MAJOR 1 (T-20, T-19): `09_reorder.test.sql`'s learner and `aal1` calls fail the count check before row level security is reached (the fixture courses are drafts, invisible to them; the learner's `reorder_courses` passes an empty array). A policy of `using (true)` would still pass them. Publish a course in the fixture, call both functions with its full visible order as a learner and as an admin at `aal1`, expect `P0001` and unchanged positions; add the pinned `search_path` assertion for `reorder_courses`.
- MAJOR 2 (T-21, cache poisoning): nothing enforces that `src/content` uses a client with no session. A session client used inside `unstable_cache` while the owner loads a page would cache drafts for every guest. Add a boundary rule (from `infrastructure`, `src/content` may import only `db/public-client` and `env`, never `next/headers`) with a test, and a unit test that `createPublicClient` sends no cookie and no user token. Optional: an explicit published filter.
- MINOR 3 (T-14, T-25): `publishedCourse(slug)` takes any string as cache key and query. Check the slug pattern and length before the cache.
- MINOR 4 (T-20): the learner refusal of the structure actions is shown only through fakes. Add an e2e step posting a structure action as a learner.
- Note: chapters have no status, so a published course's chapter titles are public even when every lesson in them is a draft (by design, `02-architecture.md` section 8.2).

Not run by the reviewer: `pnpm test:db` (no Docker), e2e, CI (`gh` TLS error), `infra:verify`.
