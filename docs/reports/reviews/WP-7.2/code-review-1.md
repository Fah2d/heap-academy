# WP-7.2 code review 1

Of a15f858..1e95ee3 (part 1: the admin gallery's axe checks, the course details save, Stop's focus, the renamed chapter's heading). The reviewer was a fresh-context subagent and read-only. The implementer saved this report and wrote the answers.

## Code review 1 (`code-reviewer`): CHANGES REQUIRED, 1 BLOCKER, 6 MINOR

Found sound:
- Both halves of the course details fix. The domain test fails without its fix.
- The chapter heading test and the `data-pending` test both fail when their fix is removed.
- No skip, retry, timeout or suppression comment was added. The commits carry no attribution.
- One axe run per state is an equal or stronger check of each state's first render.
- The transition wait is sound: it never passes quietly, and a looping animation cannot hold it.
- `pnpm verify`: exit 0.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | BLOCKER | States the spec reaches by clicking or typing lose their axe check when the spec moves to the next state. The old whole-page axe call saw them (setup unavailable, refused course status and stale save, new course invalid, saved course, saved lesson, pending save, failed save, taken address, opened test case, just published). | Fixed. `openState` runs axe on the state it leaves, and `afterEach` runs it on the state a test ends on. This found two more cases of the Stop defect: a pending course or lesson status button leaves the page once the status changes, and React Aria's announcement names it after it has gone (`role-img-alt`). The `Button` primitive now removes that spent announcement when it unmounts (React Aria drops it after 7 s anyway). A primitive test fails without the fix. |
| 2 | MINOR | The "only if focus was lost" guard after Stop has no test. | Fixed. New test: focus moved to another element stays there. It fails with the guard removed. |
| 3 | MINOR | The focus fix runs in `useEffect`, so the page can paint with focus on `body`; and `querySelector("button")` depends on button order. | Fixed. It is `useLayoutEffect` now, and the selector is `[data-validate]` on Validate. |
| 4 | MINOR | Stop can be pressed again while stopping. | No change. The reviewer confirmed it is harmless: `controller.stop()` does nothing once the runtime is restarting. The controller's tests cover that path. |
| 5 | MINOR | All 34 gallery views wrap a single child in a fragment. | Fixed. The fragments are gone. |
| 6 | MINOR | The chapter's number and heading are written in both branches. | Fixed. They are written once. Only the summary hides while the chapter is renamed. The Delivery Gate report in `docs/reports/pull-requests/WP-7.2.md` covers this. |
| 7 | MINOR | Any schema failure in `checkCourseFields` is still reported as "outcome index 5" (already there before). | No change. With only the four fields parsed, a sixth outcome line is the only failure left. Logged for WP-7.5. |

## After the fixes

- `pnpm verify`: exit 0, `Test Files  130 passed (130)`, `Tests  2326 passed (2326)`.
- Chromium, one test per process: `admin-gallery.spec.ts` 46 of 46 and `workspace-runtime.spec.ts` 17 of 17 (the `Button` change is shared).
