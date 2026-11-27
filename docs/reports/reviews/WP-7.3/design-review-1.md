# WP-7.3 part 1, design review 1

- Reviewer: `design-reviewer`, of `origin/main..7845ed8` on `wp/7.3-operations`.
- antislop active: during (session override).
- Verdict: **CHANGES REQUIRED**.
- The reviewer is read-only; the implementer saved this report from its answer.

This review is based on the code and the copy only. Its standard says a review without screenshots is not a review, so it cannot approve this change.

## Findings

**BLOCKER: the new state has no screenshots and no axe run, and no development page can produce it.**
- Files: `docs/reports/screens/WP-7.3/` (missing), `src/app/dev/error/page.dev.tsx`, `e2e/gallery.spec.ts`.
- What is wrong: no screenshot shows the error page with a 36-character request ID at 320, 768 or 1280 px, or with the phone set at 360, 375 and 412 px. Axe has not run on that state (NFR-A11Y-02). The existing development page throws on the server, so its error always carries a digest (the WP-1.4 screenshots show `Reference 72104186`). Even once Chromium can launch, the browser-error state cannot be photographed.
- Fix: add a development-only page that throws inside a client component after hydration, so the error has no digest, and let `/api/client-error` answer in development; extend `e2e/gallery.spec.ts` to wait for the reference, photograph it and run axe at every width; photograph the failed-report state too (route `/api/client-error` to a 503 with `page.route` and confirm the block is absent); run it outside the sandbox and add the images to `docs/reports/screens/WP-7.3/`.

**MINOR: at 320 and 375 px the request ID is likely to break mid-group, leaving a short tail on its own line.** A prediction from measurements, not something seen.
- File: `src/features/shell/components/error-view.tsx` (`<code className="break-all text-text select-all">`).
- Measurements: in `error-320.png` the value starts at about x=83, and 8 mono digits take 67 px, so about 8.4 px per character at 14 px; a UUID is about 302 px wide. At 320 px about 26 characters fit on the first line and about 10 move to a second, split at an arbitrary character. At 375 px about 32 fit, and four characters sit alone on the second line. At 412 px and wider it should fit on one line.
- Nothing overflows, and `select-all` copies the whole value, but a learner who copies it from a screenshot could lose or misread the tail.
- Fix: break only after the hyphens (split on `-`, a `<wbr />` after each hyphen) and replace `break-all` with `[overflow-wrap:anywhere]` as the fallback for a 64-character ID with no hyphens. The copied text and the test's `textContent` assertion do not change. Confirm on the 320 and 375 screenshots once they exist.

**MINOR: the spec text is out of date with the behaviour.**
- Files: `docs/spec/01-requirements.md` (FR-SYS-01, NFR-OBS-01), `docs/spec/03-experience.md` section 5.6.
- All three still say a browser error shows no reference "until `/api/client-error` exists", and none says what the reference becomes: the request ID of the stored report, shown only after it is stored and absent while it is pending or if it fails.
- Fix: a `spec-change` pull request for the owner to approve. When the workspace's `crashed` error (section 6.5) gets its reference, it should reuse this block.

## Questions raised: judged, no finding

- Delayed appearance and layout shift: the block is added after the last control, with nothing below it (`main` is `flex-1`, no footer on `main` yet), so nothing on screen moves. Check again when the footer of WP-6.3 arrives, at 320 px and 200% zoom.
- Announcing it: leave it unannounced. The reference is extra information, not the result of an action; a polite live region would interrupt the heading with a UUID read character by character.
- Hint wording: "If it keeps happening, keep this reference." works for a browser error too. A browser error gets a new request ID each time, while a server digest probably stays the same for the same failure (not checked against Next.js); each ID still leads to a stored log line. The heading and body ("while we prepared this page") read a little off for an error thrown after the page loaded, but that copy was already there.
- Direction, tokens, words: no new strings, styles, accent use, motion, icons or assets. The hint and label stay hidden unless a reference exists. No em dashes, buzzwords or invented numbers.

## What cannot be judged without screenshots

How the UUID wraps at 320 and 375 px, and the block at 360, 412, 768 and 1280 px; whether the browser-error state matches the server-digest state in practice; axe on the new state; contrast and focus in the rendered page (tokens unchanged: text on background 16.94, muted 7.86); the Delivery Gate report.

## Screenshots looked at

None exist for WP-7.3. As a baseline, the server-digest state: `docs/reports/screens/WP-1.4/error-320.png`, `error-375.png`, `error-768.png`, `error-1280.png`.

## Response (implementer)

- BLOCKER: partly fixed. `src/app/dev/client-error/page.dev.tsx` (development only, like `/dev/error`) renders `BrowserErrorTrigger`, which throws in the browser right after hydration, so the error has no digest and the page reports it. `e2e/gallery.spec.ts` now waits for the report, checks that the shown reference equals the response's `x-request-id`, checks for sideways scroll, runs axe and saves `error-browser-<width>.png` at 320, 375, 768 and 1280 px; a second test answers the report with 503 through `page.route`, checks that no reference or hint shows, runs axe and saves `error-browser-unreported-<width>.png`; `e2e/phone.spec.ts` does the same at 412, 375 and 360 px (`phone-error-browser-<width>.png`). The screenshots go to `docs/reports/screens/WP-7.3/` (`saveScreen` takes a folder now). **Not run**: Chromium cannot launch in this sandbox, so the folder does not exist yet; owner action.
- MINOR wrap: fixed. The reference is split after each hyphen with a `<wbr>`, and `break-all` is replaced by Tailwind's `wrap-anywhere` (`overflow-wrap: anywhere`) for a value without hyphens; a unit test checks the markup and that the text is unchanged. Not seen at 320 or 375 px.
- MINOR spec: the `spec-change` text is in the description (owner decision B); no spec file is edited here.
