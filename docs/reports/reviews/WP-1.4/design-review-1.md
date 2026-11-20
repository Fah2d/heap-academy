# Design review 1, WP-1.4

Reviewer: `design-reviewer`, fresh context. Range `ef7276c..7bf3939`. 2026-11-16.

Verdict: **CHANGES REQUIRED**. antislop active: during (global preference).

This is a source review, not a screen review. There are no screenshots, so it cannot be an approval. Nothing has run in a browser: the e2e and axe suites in `e2e/` have never run. Any Delivery Gate line marking R-03, R-25 (live), R-35 or "axe clean" as PASS would be a BLOCKER, because nothing was measured. No BLOCKER was found in the source itself.

Tokens match `DESIGN.md` 4.1 to 7 value for value. The three tiers, the semantic-only components, the 44 px minimum heights, the focus ring, reduced motion, React Aria behavior and messages kept out of components are correct. In the compiled production CSS the disabled, invalid and pressed overrides win as intended, and the skip link positions correctly. The Next 16.4 `retry` prop on `error.tsx` is correct for this version.

## MAJOR

1. **Every "home" link leads to a 404 that points at itself.** `site-shell.tsx:22`, `not-found-view.tsx:9`, `error-view.tsx:28`. No page exists at `/` on this branch or on `main`, so the wordmark and the only next step on both system pages lead to "We could not find this page", which offers "Go to the home page" again. Production shows this from Day 1 until WP-5.1. In substance this fails R-24, R-26, `CLAUDE.md` rule 3, and FR-SYS-01's "a way forward". Owner decision before merge: either WP-1.3's "one real page" is `/`, or he accepts the loop knowingly, and the Gate says so.
2. **The error page asks the learner to do something they cannot do.** `system.ts:13`, `error-view.tsx:31`. "Quote the reference below when you tell us about it" shows even with no reference, and no contact route exists. Fix: move the sentence into the reference block, and name a real route or drop "when you tell us about it".
3. **The missing footer and nav are right in substance, but the decision is not recorded and the plan loses the nav.** `site-shell.tsx:5-9`; `08-delivery-plan.md:79` and `:207`; `03-experience.md` section 4. WP-6.3 adds "the footer links" but not the footer element; WP-5.1 never mentions adding Courses to the header. Fix: the owner's explicit acceptance in the PR, recorded on the Gate's R-39 line, and a `spec-change` PR so WP-6.3 builds the footer and WP-5.1 the header nav.
4. **The progress track is pill-shaped.** `progress.tsx:28`: 8 px tall with a 4 px radius. `DESIGN.md` section 6: "Nothing is pill-shaped".
5. **The nav link can be narrower than 44 px.** `link.tsx:28`: minimum height but no minimum width; "Links" in the gallery is about 38 px wide (estimated, not measured). Breaks NFR-A11Y-06.

## MINOR

6. Tailwind scans `scripts/` and `docs/`, so the build ships classes such as `md:hover:bg-[#fff]`, `rounded-[6px]`, `gap-[3px]`, `uppercase`, `italic`, `-left-3`, `ml-4`. Fix in `src/ui/styles.css:4`.
7. A read-only field reacts to hover (`text-field.tsx:23`).
8. Forced-colors mode may paint every tab's transparent marker border (`tabs.tsx:21`, `link.tsx:28`). Verify with a forced-colors screenshot.
9. The dialog may not fit a phone with the keyboard open (`dialog.tsx:31-33`). Needs a 375 px screenshot with an input focused.
10. A 64-character reference has no break opportunity and can overflow at 375 px (`error-view.tsx:33`).
11. The mono fallback is not metric-matched, which the signed `DESIGN.md` section 5 asks for (`fonts.ts:33`). Owner sign-off or fix.
12. The gallery shows no button with an icon and no full-width button, though its comment says every state (`primitive-gallery.tsx:28`).
13. Gallery wording: "moving ... the keyboard over them" (`gallery.ts:6`); "9.8 MB" matches nothing in `09-evidence.md` (`gallery.ts:71-73`): an invented number.
14. The selected tab's weight 600 widens it, so neighbors shift (`tabs.tsx:21`); an invalid field without `errorMessage` shows a lone icon (`text-field.tsx:41-46`); a live region inserted with its content is often not announced (`notice.tsx:30`).
15. NFR-A11Y-05 is about 320 px, but the overflow tests use 375, 768 and 1280 (`shell.spec.ts:75`, `gallery.spec.ts:59`).

## What needs the screenshots

Whether it reads as a template or too close to IBM's Carbon system (`DESIGN.md` section 9); whether the header chrome recedes; the amber focus ring around the amber primary button; all 375 px layouts, including the dialog with the keyboard open; forced colors; hover, press and focus; the tab bar on its hairline; the font swap; then axe at all three widths.

Once 2, 4, 5, 6 and 7 are fixed and the owner has decided 1, 3 and 11, this becomes "approve pending screenshots". Final approval needs the 375, 768 and 1280 px set and a clean axe run.

## Outcome

| # | Outcome |
|---|---|
| 1, 3, 11 | For the owner. Listed in the pull request. |
| 2, 10 | Fixed in 8f85981. |
| 4, 5, 6, 7, 13 | Fixed in 201b41b. |
| 8, 9, 12, 14, 15 | Not fixed in this pass. 8 and 9 need screenshots; the rest are listed in the pull request. |
