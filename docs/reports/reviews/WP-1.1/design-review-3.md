# design-reviewer, pass 3 (WP-1.1)

Range: `b7e222c..6e4d8ac`. Result: **APPROVE**. No BLOCKER, no MAJOR, 3 MINOR.

All three MAJOR findings from pass 2 are fixed. The reviewer re-ran 27 pairs with `contrast-check.py`, and every value matched the document. Every `DESIGN.md` section number cited in the spec still points to the right section after the renumbering.

## MINOR, left open for WP-1.4

These would change the signed `DESIGN.md`, so they are listed for the owner instead of being edited here.

1. `DESIGN.md:44, 139`: `--gray-450` (`#A09C94`) is lighter than `--gray-400`, which breaks the scale's order. Rename it `--gray-350`. The value does not change.
2. `DESIGN.md:159, 164, 165`: inside dialogs and menus, hover and press on secondary and destructive buttons share one fill, and only the 1 px shift tells them apart. Add `--color-surface-press` (`--gray-650`) for raised surfaces, or say that the shift is the only press cue there.
3. `DESIGN.md:125`: the disabled and read-only outline (`--color-border`) measures 1.23 to 1.43. That is fine for disabled controls, which are exempt from contrast rules. A read-only field needs 3:1 under WCAG 1.4.11, so it should use `--color-border-control` (3.91 on the surface), or the read-only state should be dropped until a screen needs it. No screen in the spec uses one yet.

Still open from pass 2: at the WP-1.4 screenshot review, check that string `#C9D6A3` does not read as yellow next to the amber Check button.
