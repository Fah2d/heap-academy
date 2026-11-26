# WP-5.4 code review 4 and security review 1

Both on bab29d3 (part 4: the invitation to save progress), each a fresh-context subagent. Speed mode: one round each.

## Code review 4 (`code-reviewer`): CHANGES REQUIRED, 1 MAJOR, 4 MINOR

Found sound: the decisions (first completion per device, no card in memory, focus to the host), the server/client boundary (the layout passes a client element to a client provider), the cached `viewer`, the words in `src/messages`, logical CSS.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | MAJOR | Nothing tested the layout's signed-in branch; the workspace test only fed `null` into a mock. | Fixed: the choice is `guestInvitation()` in `src/features/auth/server/guest-invitation.tsx`, tested for a guest (the card) and a signed-in learner (nothing), with `pageIdentity` mocked. The layout calls it. |
| 2 | MINOR | Where session storage is refused, hiding lasted only as long as the component; React Aria remounts the tests tab. | Fixed: a module-level flag keeps it for the page. The test now draws the card again after hiding. |
| 3 | MINOR | After Hide, focus landed on an empty host with no name and no ring. | Fixed: the host passes focus on to the tests' summary heading, which has a visible ring and is read out. The journey checks the summary has focus. |
| 4 | MINOR | `data-invitation` was unused. | Removed. |
| 5 | MINOR | "Sign in to keep it on every device" is true only once WP-6.1 merges progress at sign-in. | No change, as the reviewer advised (the sign-in page's intro makes the same promise); said in the description. |

## Security review 1 (`security-reviewer`): APPROVED, 2 MINOR

Checked: identity still only from verified claims, failing open as before; React `cache` holds one result per server request; the only per-visitor difference is a client reference or null; the return path is checked by `safeReturnPath` wherever it is used; no secret reaches the client; no check weakened.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | MINOR | No test that the layout sends nothing to a signed-in visitor. | Fixed with code review item 1, and `viewer.test.ts` tests `isSignedIn` both ways. |
| 2 | MINOR | When the auth service is down, a signed-in learner counts as a guest and sees the card. | Expected: the same fail-open rule as the header (`02-architecture.md` section 11.1). No change. |
