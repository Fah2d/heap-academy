# design-reviewer, pass 1 (WP-1.1)

Range: `main..9ec972d`. Result: **CHANGES REQUIRED**. No BLOCKER, 5 MAJOR, 9 MINOR.

The reviewer re-ran the contrast checker on all 24 pairs of the first contrast table, and every value matched.

## MAJOR

1. `DESIGN.md:61-63`. Hover and press shared one fill. Secondary, destructive, and disabled buttons had no values, and the primary action in the workspace was not named. **Fixed**: section 4.5, and Check is the primary action.
2. `DESIGN.md:61`. Amber links against text measure 2.09:1, below the 3:1 that WCAG 1.4.1 needs. **Fixed**: links in running text are always underlined, and the hover state is specified.
3. `DESIGN.md:98-102`. Keywords used amber, and built-ins and numbers sat in amber's warm range, which broke the single-accent rule. **Fixed**, by the owner's choice: no amber in the editor, and keywords are set apart by weight.
4. `DESIGN.md:91-104`. No selection, caret, active line, gutter, bracket, or search tokens. A guessed selection color, `#2E2E36`, would drop comments to 4.23:1. **Fixed**: editor chrome tokens, and every syntax color measured on the editor, the active line, and the selection (lowest 4.73).
5. `DESIGN.md:54-66, 132`. Text field, tabs, dialog, menu hover, progress track, notice, disclosure, and the tests panel's "not run" state had no values. **Fixed**: section 4.5.

## MINOR

6. Four lines of the spec disagreed with `DESIGN.md`: 03:286, 03:315, 03:161, and 03:3. **Fixed.**
7. ADR-0015 cited ADR-0031 and E-19 for the dark-only choice. **Fixed**: it now cites the decision sheet and `DESIGN.md` 4.3.
8. The font reason was inaccurate ("terminal-era"), and `DESIGN.md` gave no reasons for its main choices. **Fixed.**
9. The current-item bar needed `aria-current`, a cue that is not color, and visibility in forced-colors mode. **Fixed.**
10. The focus ring would be clipped inside scroll areas. **Fixed**: an inset variant.
11. No rem units, font-family tokens, or tabular numerals. **Fixed.**
12. The Google sign-in button was not covered. **Fixed**: Google's official mark, unaltered.
13. The look sits close to IBM's Carbon design system. **Recorded** in `DESIGN.md` 8a, to be checked at the WP-1.4 screenshot review.
14. `CLAUDE.md:84` described `brand/` as a brand kit. **Fixed** in this pull request.
