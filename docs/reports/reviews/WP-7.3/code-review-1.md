# WP-7.3 part 1, code review 1

- Reviewer: `code-reviewer`, of `origin/main..7845ed8` on `wp/7.3-operations`.
- Verdict: **CHANGES REQUIRED**.
- The reviewer is read-only; the implementer saved this report from its answer. The response is at the end.

## Findings

**BLOCKER: the release on the log line is the server's, but the spec says the client sends it.** `src/features/system/server/client-error.ts:17-20`, `src/features/shell/client/report-client-error.ts:24`
- `docs/spec/07-operations.md:89`: "Client errors are sent to `/api/client-error` with the release version, the route, and a short error code." The reporter sends `{ code, route }` only, so the logger stamps the server's `HEAP_RELEASE`.
- A tab opened before a deploy keeps running the old bundle, but its report reaches the new deployment. The Hobby plan has no skew protection, so the error is logged under the new release, at the moment the owner decides whether to roll back.
- The implementer's reason is real but comes from a lower source: `.env.example` marks `HEAP_RELEASE` as server only, and `scripts/check-bundle.mjs` searches the browser bundle for its name and value. The spec outranks those files, so the right step was to stop and ask.
- Fix, which needs the owner: (a) publish the commit SHA, already public because the repository is: for example `NEXT_PUBLIC_HEAP_RELEASE` from the same parsed value in `next.config.ts`, a `release` field (40 hex characters or `local`) in the strict schema, and the client's release on the line; this touches `.env.example` and the bundle check, so it is the owner's call. (b) Or a `spec-change` pull request rewording 07-operations section 4.2 and NFR-OBS-02 to "the server's release", accepting the stale-tab mislabel. The reviewer recommends (a).

**MAJOR: the error reporter port cannot be reached by the code that must send the other two codes.** `src/features/shell/client/report-client-error.ts:16,40`, `src/features/shell/index.ts`
- `ErrorReporter` and `reportClientError` live in `features/shell/client`, and the shell index does not export them. `runtime` may import only `grader` and `domain`, and another feature may import shell only through its index. So `runtime-load-failed` and `worker-crashed` have no lawful sender, and the workspace's `crashed` state (`03-experience.md:157`) needs the reference too.
- Fix: the `ErrorReporter` type in `src/domain/client-error.ts`; the adapter exported from `@/features/shell` so the workspace can inject it into the runtime.

**MAJOR: the 8 kB cap and the declared-length branch are not tested by any test that has run.** `client-error.test.ts:107`, `read-capped.ts:10`
- The test title says "declared or streamed", but both cases stream: Node's `Request` sets no `content-length` for a string body. Coverage lists `read-capped.ts` lines 10-11 as uncovered.
- Mutants that stayed green: removing `if (declared > limit) return undefined;` (27/27 pass); `size > limit` to `size >= limit - 1` (27/27); `MAX_CLIENT_ERROR_BYTES = 8000000` (9/9, because the test builds its body from the constant).
- Only `e2e/client-error.spec.ts` pins 8 kB, the declared branch and `connect-src`, and it has never run.
- Fix: pin the cap (`=== 8000` or a literal 8001-byte body); a case with an explicit `content-length` and a body that does not stream; a body of exactly 8000 bytes accepted; run the e2e before merge.

**MAJOR: the reference for a browser error is decided in code, not in the spec.** `01-requirements.md:157,229`, `03-experience.md:90`, `07-operations.md:85`
- These lines still say a browser error "shows no reference until `/api/client-error` exists"; NFR-OBS-01 says "the error page shows the digest only". None says what the reference becomes. Decision (2), the report's request ID, is sound, but the owner made the original call on pull request #3 and should approve this one.
- Fix: a `spec-change` pull request.

**MINOR: the server's route-length limit is not tied to the client's.** `client-error.ts:29`. The mutant `.max(MAX_REPORTED_ROUTE_LENGTH - 1)` passed. Fix: a test that a route of exactly `MAX_REPORTED_ROUTE_LENGTH` characters is accepted.

**MINOR: wrong requirement ID in test titles.** `client-error.test.ts:107,124,129`, `e2e/client-error.spec.ts:29` cite `[NFR-SEC-02]`, the content security policy requirement. Cite T-16 where it applies, or name the section.

**MINOR: the request ID pattern is copied rather than shared.** `report-client-error.ts:13`. Both `infrastructure` and client code may import `domain`. Fix: the pattern and `REQUEST_ID_HEADER` in `src/domain`, imported by `src/infrastructure/http/request-id.ts` and by the reporter.

**MINOR: the log line claims a GET that did not happen.** `client-error.ts:54`. `logRoute("GET", path)` labels the page pattern as a GET while the line belongs to `POST /api/client-error`. Fix: say in the comment that the route is the reported page's pattern, or carry the page in a named form.

**MINOR, to track: no per-address limit on report endpoints yet.** Anyone can write error-level lines and inflate the morning count of client error reports (07-operations section 5). Section 7 puts the counter in WP-7.1; csp-report has the same gap.

**Decisions checked:** (1) rejected, see the BLOCKER; (2) sound but needs the spec change; (3) accepted, matches `.claude/rules/server.md`, and the mutant that turned off the strict check failed; (4) see the request ID MINOR.

## What the reviewer ran

- `git log --format=fuller origin/main..7845ed8`: one commit, author and committer Fahad. No AI credit, TODO, suppression, `.skip` or `.only` in the diff.
- `pnpm verify`: exit 0, 30 files, 718 tests.
- Mutants caught: the strict schema off, the server path split, the reporter's `response.ok`, `credentials: "omit"`, the report-once and stale-reference guards, the route slice in the domain. Not caught: the four above.
- Not checked: e2e, a server, `next build`, `check-bundle`, `check-static`, screenshots, the Next.js documentation for the `error.tsx` prop name.

## Response (implementer)

- BLOCKER: **not fixed; owner decision A in the description.** Option (a) changes `.env.example`, the deploy workflow's build and the classification the bundle check relies on, and changing a check to let a value through is the owner's call (CLAUDE.md rule 2). The default until he decides: the server's release, with the stale-tab mislabel stated. The spec change for either option is drafted in the description.
- MAJOR port: fixed. `ErrorReporter` is in `src/domain/client-error.ts`; `reportClientError` is exported from `@/features/shell`.
- MAJOR cap tests: fixed. `MAX_CLIENT_ERROR_BYTES` pinned to 8000; a body of exactly 8000 bytes is accepted and 8001 refused; a declared `content-length: 9000` is refused without the body being pulled. The reviewer's three mutants and the route mutant each now fail a test (1, 2, 2 and 1 failures).
- MAJOR spec: the `spec-change` text is in the description as owner decision B; no spec file is edited in this branch (rule 11).
- MINOR route length: fixed, a route of exactly 2048 characters is accepted.
- MINOR IDs: `[NFR-SEC-02]` replaced by `[T-14]` (oversized payloads) in the cap and content type tests.
- MINOR pattern: fixed. `src/domain/request-id.ts` holds the header name, the type and `parseRequestId`; `src/infrastructure/http/request-id.ts` re-exports them and keeps `createRequestId`.
- MINOR GET: the comment now says the route is the reported page, as the GET that loaded it, and that proxy.ts logged the POST under the same ID.
- MINOR rate limit: listed for WP-7.1 in the description.
