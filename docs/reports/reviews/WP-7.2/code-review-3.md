# WP-7.2 code review 3

Of 4aa6d03 (part 3: keyboard walkthroughs of the catalog, sign-in, not-found and admin pages, and the phone views). The reviewer was a fresh-context subagent and read-only. The implementer saved this report and wrote the answers. One round (speed mode). No security review: the one configuration change, `allowedDevOrigins` in `next.config.ts`, applies to the development server only and names only the loopback address.

## Code review 3 (`code-reviewer`): CHANGES REQUIRED, 2 MAJOR, 6 MINOR

Found sound: the walk fails on a missed, extra, reordered or lost stop; starting from any control and dropping only the stops on the page or the development indicator at the end is correct; no check weakened; no attribution in the commit.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | MAJOR | The admin walks start before the code editors exist (they are built in an effect), so a walk could pass without the editors or fail when one appears. | Fixed in 9b49a74. Each admin state waits until it has one built editor per editor hint, and every walk counts the controls again afterwards and fails if the list changed. Rerunning at 127.0.0.1 then showed the editors never appear there: see the finding below. |
| 2 | MAJOR | The ring check read only the outline's style and width, so a transparent ring, a see-through control, or one off screen passed. | Fixed in 9b49a74. The ring must be solid, 2 px, the colour of `--color-focus` with that colour fully opaque, offset 2 px or -2 px, on a control that is shown, not see-through, and in the viewport. It is read after the control's 160 ms colour transition, which the stronger rule exposed. Mutations: the base outline set to `none`, and `--color-focus: transparent`, each fail a walk. |
| 3 | MINOR | The comment said "reading order", but the walk checks document order. | Fixed: the comment says document order, and that the workspace's walk checks its regions by name. |
| 4 | MINOR | The radio-group branch never runs; no radio exists. | Fixed: removed; the comment says what a radio group would do to the count. |
| 5 | MINOR | After "Show Google", assert the Google button has focus. | Fixed. |
| 6 | MINOR | The part 2 walk duplicates the ring rule. | Fixed: it uses `focused` and `tab` from `e2e/keyboard.ts`, so it gets the full rule too. Two of its tests then read the ring mid-transition, and now press Tab through `tab`. |
| 7 | MINOR | The shared error page, the admin preview, the sign-in code step and the admin confirm dialogs are not walked. | The error page (`e2e/catalog-outage.spec.ts`, 1280 and 375 px) and the preview (`e2e/workspace-preview-runtime.spec.ts`) are now walked. The code step needs the auth service (stack, no Docker here) and the admin dialogs are opened by the J-12 and J-13 journeys (stack); both are listed as not walked in `day-7-quality.md`. |
| 8 | MINOR | `day-7-quality.md` still says those pages are not walked, and should name the bot challenge, CI's missing `phone-workspace` run, and the engines. | Fixed in the report. |

## Found while fixing

On the development server reached as `127.0.0.1`, which is how `playwright.config.ts` opens it for the `gallery`, `runtime-*` and `phone*` projects, Next.js 16.4.6 refuses its development files to that origin (`Blocked cross-origin request to Next.js dev resource /_next/hmr from "127.0.0.1"`). The pages were never hydrated there: the admin states' editors did not appear (`Expected: 3, Received: 0`), and "Show Google" did nothing. The admin gallery's other interactive checks in CI run there too. 9b49a74 adds `allowedDevOrigins: ["127.0.0.1"]` for the development phase only, the setting the server's own message names, with a test in `scripts/next-config.test.ts`. After it: 44 of 44 walks at 127.0.0.1, with the editors built.
