# design-reviewer, pass 2 (WP-1.1)

Range: `9ec972d..b7e222c`. Result: **CHANGES REQUIRED**. No BLOCKER, 3 MAJOR, 8 MINOR.

All 14 findings from pass 1 are resolved. The reviewer re-ran all 24 syntax values, and every value matched.

## MAJOR

1. `03-experience.md:289` still described the syntax palette as built around amber. **Fixed.**
2. Section 4.3 claimed to list every pair in use, and it did not. **Fixed**: new hover and selection columns, the placeholder, text on the press state, and a table of non-text pairs.
3. The editor selection measured 1.24 against the editor, and an opaque active line could hide it. **Fixed**, and signed by the owner as revision 2: the selection is `#34343C` (1.52), comments are raised to `#A09C94` (4.51 on the selection), the active line has no background, and the gutter marks the caret's line. CodeMirror's documentation recommends translucent content backgrounds. The browser check happens in WP-4.2.

## MINOR

1. Hover disappeared inside dialogs. **Fixed**: hover is one step above the surface the control sits on.
2. Disabled buttons showed no shape. **Fixed**: a 1 px `--color-border` outline.
3. Read-only fields were invisible inside a panel. **Fixed**: a 1 px `--color-border` outline.
4. Menu items and the disclosure had no text color at rest. **Fixed.**
5. The primary action is Check, then Next once the lesson is complete. **Fixed.**
6. Header link states. **Fixed**: a block-end bar and `aria-current`.
7. Token tiers were inconsistent. **Fixed**: added primitives, and the editor tokens now point at semantic tokens.
8. Section numbering. **Fixed.**

Noted for the WP-1.4 screenshot review: string `#C9D6A3` must not read as yellow next to the amber Check button.
