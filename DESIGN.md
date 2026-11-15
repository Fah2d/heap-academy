# DESIGN.md

The visual direction for Heap Academy, first release. The owner wrote it in the WP-1.1 design interview on 2026-11-15, and the implementer transcribed it. It replaces the proposals in `docs/spec/03-experience.md` section 10 wherever the two differ.

Design Read: *Reading this as: a coding practice tool for beginners arriving from short videos, in a formal, clean, professional style, dial ENERGY 1 / RHYTHM 1 / MOTION 1.*

Dial: ENERGY 1 / RHYTHM 1 / MOTION 1

## 1. Identity

- There is no brand kit, and none is coming. The site does not follow the look of Heap's videos. CRT effects and burgundy are not used.
- Wordmark: the words "Heap Academy" set as live text in IBM Plex Sans, weight 600, in the text color. There is no logo, mark, or mascot.
- There are no illustrations anywhere: no empty-state art, no completion art, no not-found art.
- Favicon and app icon: none in this release. The implementer does not make one (`CLAUDE.md` rule 6). The owner may supply one later.

## 2. Character

Formal, clean, and professional. A tool that respects the learner's time. Hierarchy comes from type size, weight, and spacing. There is one accent, and decoration is absent.

- Every screen has one focal point. On the workspace it is the editor. On every other page it is the one primary action.
- Layouts are uniform and predictable (RHYTHM 1). Screens of the same kind share one structure.
- Identity motif: a typographic voice. IBM Plex Mono carries every structural label: lesson numbers (`1.3`), test case names in the tests panel, and console prompts. Plex Sans carries everything else. The current item, such as the current lesson in a list, is marked by a 2 px amber `border-inline-start`, weight 600 text, and `aria-current`. A border, not a pseudo-element background, so it still shows in forced-colors mode. Reason: it marks real state with a cue that is not color alone.

## 3. Theme

Dark only (ADR-0015). Reason: this is a coding tool whose focal point is the editor, and one theme is verified thoroughly. Components use semantic tokens only, so a second theme stays a token file.

## 4. Color

### 4.1 Primitives

Raw values. Never used in components.

| Token | Value |
|---|---|
| `--gray-950` | `#0E0E10` |
| `--gray-925` | `#121215` |
| `--gray-900` | `#16161A` |
| `--gray-850` | `#1E1E23` |
| `--gray-800` | `#26262C` |
| `--gray-700` | `#2E2E36` |
| `--gray-650` | `#34343C` |
| `--gray-500` | `#74747F` |
| `--gray-450` | `#A09C94` |
| `--gray-400` | `#8A877F` |
| `--gray-300` | `#A9A59D` |
| `--gray-50` | `#F2F0EC` |
| `--amber-500` | `#D4A017` |
| `--amber-400` | `#E3B53A` |
| `--amber-600` | `#B8890F` |
| `--green-400` | `#6FD08C` |
| `--red-400` | `#FF7A7A` |
| `--pink-300` | `#E3A8C4` |
| `--teal-300` | `#9FD4C7` |
| `--sage-300` | `#C9D6A3` |
| `--blue-300` | `#9CC5E6` |
| `--black-a60` | `rgb(0 0 0 / 0.6)` |

Gray temperature, on purpose: the surfaces are cool neutral grays, and the text grays are warm, so long reading feels less clinical.

### 4.2 Semantic

Components use only these tokens.

| Token | Primitive | Use |
|---|---|---|
| `--color-bg` | `--gray-950` | Page background |
| `--color-surface` | `--gray-900` | Panels, cards, the console |
| `--color-surface-raised` | `--gray-850` | Dialogs, menus, hover on `--color-bg` and `--color-surface` |
| `--color-surface-hover` | `--gray-700` | Hover on `--color-surface-raised`, press fills, the progress track |
| `--color-surface-editor` | `--gray-925` | The code editor |
| `--color-text` | `--gray-50` | Body text, headings, the wordmark |
| `--color-text-muted` | `--gray-300` | Secondary text, metadata |
| `--color-text-subtle` | `--gray-400` | Placeholder text (never the only label), line numbers |
| `--color-border` | `--gray-700` | Hairline dividers, the borders of disabled and read-only controls. Never the only boundary of an enabled control. |
| `--color-border-control` | `--gray-500` | The boundary of text fields and secondary buttons |
| `--color-action` | `--amber-500` | Primary button fill, links, progress, the current-item marker |
| `--color-action-hover` | `--amber-400` | Primary button fill on hover |
| `--color-action-press` | `--amber-600` | Primary button fill while pressed |
| `--color-on-action` | `--gray-950` | Text and icons on amber. Never white. |
| `--color-focus` | `--amber-500` | The focus ring |
| `--color-pass` | `--green-400` | A passing test case, a completion |
| `--color-fail` | `--red-400` | A failing test case, an error, an invalid field's border, destructive actions |
| `--color-selection` | `--gray-800` | `::selection` outside the editor |
| `--color-selection-editor` | `--gray-650` | Selected text in the editor |
| `--color-backdrop` | `--black-a60` | Behind a dialog |

Amber is the single accent. It marks the primary action, focus, progress, and the current item, and it is never decoration.

Warning has no hue of its own. Amber owns the warm range, so a second warm hue would read as the accent. A warning is a notice in `--color-text` with the Carbon warning icon and a sentence that says what happened.

Pass, fail, and warning always carry an icon and a word. Color is never the only signal.

Links in running text are always underlined (`text-underline-offset: 0.15em`), because amber on the text color measures only 2.09 to 1 against the surrounding text. On hover the underline thickens from 1 px to 2 px. Visited links look the same as unvisited ones.

Header navigation links are `--color-text-muted` and not underlined; on hover they turn `--color-text`. The current one is `--color-text`, weight 600, with a 2 px `--color-action` bar on its block-end edge and `aria-current="page"`, the same marker as a selected tab. The inline-start bar of section 2 is for items in vertical lists.

### 4.3 Measured contrast

Measured on 2026-11-15 with `.claude/skills/antislop-human/contrast-check.py` (WCAG 2 formula). Every pair in use is listed here or in section 4.4.

Text on surfaces:

| Foreground | `#0E0E10` bg | `#121215` editor | `#16161A` surface | `#1E1E23` raised | `#2E2E36` hover | `#26262C` selection |
|---|---|---|---|---|---|---|
| Text `#F2F0EC` | 16.94 | 16.43 | 15.85 | 14.58 | 11.83 | 13.22 |
| Muted `#A9A59D` | 7.86 | 7.62 | 7.35 | 6.76 | 5.48 | 6.13 |
| Subtle `#8A877F` (placeholder, line numbers) | 5.37 | 5.21 | 5.03 | not used | not used | not used |
| Amber `#D4A017` | 8.12 | 7.87 | 7.60 | 6.99 | 5.67 | 6.33 |
| Pass `#6FD08C` | 10.17 | 9.86 | 9.52 | 8.76 | 7.10 | 7.93 |
| Fail `#FF7A7A` | 7.64 | 7.41 | 7.15 | 6.57 | 5.33 | 5.96 |

Text on amber: `#0E0E10` on `#D4A017` (rest) 8.12, on `#E3B53A` (hover) 10.04, on `#B8890F` (press) 6.08.

Non-text, against the 3 to 1 rule:

| Element | Against | Ratio |
|---|---|---|
| Control border `#74747F` | bg, editor, surface, raised | 4.18, 4.05, 3.91, 3.59 |
| Field hover border `#A9A59D` | bg | 7.86 |
| Focus ring `#D4A017` | bg, surface, raised, hover, editor, editor selection `#34343C` | 8.12, 7.60, 6.99, 5.67, 7.87, 5.19 |
| Progress fill `#D4A017` | track `#2E2E36` | 5.67 |
| Bracket and search outline `#A9A59D` | editor, editor selection `#34343C` | 7.62, 5.03 |

Every text pair passes AA for normal text (4.5). Every non-text pair passes 3 to 1. A disabled control is exempt from contrast rules, but it still keeps a visible 1 px `--color-border` outline so its shape shows.

### 4.4 Syntax highlighting and the editor

A small palette on `--color-surface-editor` (`#121215`). It is not a stock editor theme. Amber is not used in the editor, so the accent stays for action and focus, and no syntax color sits in amber's warm range. Keywords are set apart by weight, not hue. Comments are not italic, because Plex Mono italic is not shipped.

| Token | Points to | Value | On editor `#121215` | On selection `#34343C` | Applies to |
|---|---|---|---|---|---|
| `--syntax-text` | `--color-text` | `#F2F0EC` | 16.43 | 10.84 | Names, operators, punctuation |
| `--syntax-keyword` | `--color-text`, weight 600 | `#F2F0EC` | 16.43 | 10.84 | `def`, `if`, `for`, `return`, `import` |
| `--syntax-string` | `--sage-300` | `#C9D6A3` | 12.14 | 8.01 | Strings |
| `--syntax-number` | `--pink-300` | `#E3A8C4` | 9.50 | 6.26 | Numbers, `True`, `False`, `None` |
| `--syntax-function` | `--blue-300` | `#9CC5E6` | 10.28 | 6.78 | Function names in definitions and calls |
| `--syntax-builtin` | `--teal-300` | `#9FD4C7` | 11.32 | 7.47 | Built-ins such as `print`, `input`, `len` |
| `--syntax-comment` | `--gray-450` | `#A09C94` | 6.84 | 4.51 | Comments |
| `--syntax-error` | `--color-fail` | `#FF7A7A` | 7.41 | 4.89 | The error underline and gutter marker |

Syntax tokens are component tokens, the third tier, so they may point at primitives.

Editor chrome:

| Token | Points to | Use |
|---|---|---|
| `--editor-selection` | `--color-selection-editor` | Selected text. 1.52 against the editor background, so a selection is easy to see. |
| `--editor-caret` | `--color-text` | The caret, 2 px wide |
| `--editor-gutter-text` | `--color-text-subtle` | Line numbers |
| `--editor-gutter-active` | `--color-text` | The line number of the line with the caret |
| `--editor-bracket-match` | 1 px `--color-text-muted` outline | The matching bracket |
| `--editor-search-match` | `--color-selection-editor` fill and a 1 px `--color-text-muted` outline | Search results |

The line with the caret has no background. CodeMirror draws the selection behind the text, and its documentation recommends that content backgrounds be translucent so they do not hide the selection. A translucent active line over the selection still lowered comments to 4.12, so the caret's line is marked in the gutter instead. Check this against current CodeMirror documentation and in a browser in WP-4.2, where the code editor component is built (`CLAUDE.md` rule 13).

### 4.5 Component states

Hover is one step above the surface a control sits on: on `--color-bg` or `--color-surface` it is `--color-surface-raised`, and on `--color-surface-raised` (dialogs, menus) it is `--color-surface-hover`.

| Component | Rest | Hover | Press | Disabled | Other |
|---|---|---|---|---|---|
| Primary button | `--color-action` fill, `--color-on-action` text | `--color-action-hover` | `--color-action-press` and a 1 px downward shift | No fill, 1 px `--color-border`, text `--color-text-muted`, no hover, `cursor: not-allowed` | One per screen. In the workspace it is Check, then Next once the lesson is complete (`03-experience.md` section 6.6). |
| Secondary button | `--color-surface` fill, `--color-border-control` border, `--color-text` text | One step above its surface | `--color-surface-hover` and a 1 px downward shift | As primary | Run, Stop, Reset code, Show a hint, Retry, Fill from solution |
| Destructive button | Transparent fill, `--color-fail` border and text | One step above its surface | `--color-surface-hover` and a 1 px downward shift | As primary | Delete my account, Delete test case, Archive. Never a red fill. |
| Text field | Fill `--color-bg`, border `--color-border-control`, text `--color-text`, placeholder `--color-text-subtle`, height 44 px | Border `--color-text-muted` | | Fill `--color-surface`, 1 px `--color-border`, text `--color-text-muted` | Invalid: border `--color-fail` plus an error sentence below. Read-only: fill `--color-surface`, 1 px `--color-border`. |
| Tabs | Text `--color-text-muted` | Text `--color-text` | | | Selected: text `--color-text`, weight 600, and a 2 px `--color-action` bar on the block-end edge |
| Dialog | Fill `--color-surface-raised`, 1 px `--color-border`, `--radius-dialog`, `--shadow-float`, `--color-backdrop` behind | | | | |
| Menu item | Fill `--color-surface-raised`, text `--color-text` | Fill `--color-surface-hover` | | Text `--color-text-muted` | |
| Progress | Track `--color-surface-hover`, fill `--color-action` | | | | Always with a text value |
| Notice | Fill `--color-surface`, 1 px `--color-border-control` border, text `--color-text`, icon and sentence | | | | Kind shown by icon and words, not by fill |
| Disclosure | Text `--color-text-muted`, Carbon `ChevronRight`, which turns to point down when open | Text `--color-text` | | | `aria-expanded` |
| Test case state | Pass: `--color-pass`, Carbon `CheckmarkFilled`, "Passed". Fail: `--color-fail`, `ErrorFilled`, "Failed". | | | | Not run: `--color-text-muted`, Carbon `CircleDash`, "Not run" |

Focus: the 2 px ring of section 6 appears on every state above. Inside an overflow container (the console, the tests panel, the editor), the ring is inset (`outline-offset: -2px`) so it is not clipped.

## 5. Type

- IBM Plex Sans for the interface, lesson prose, the wordmark, and the XP and streak numerals. IBM Plex Mono for code, the console, and the structural labels of section 2. Handjet is not used. Reason: IBM's typeface for technical interfaces, with a monospace companion and an Arabic companion.
- `--font-sans`: `"IBM Plex Sans"`, then a metric-matched fallback of the system sans, generated with `size-adjust` so the swap does not shift layout. `--font-mono`: `"IBM Plex Mono"`, then a metric-matched `ui-monospace` fallback.
- XP and streak numerals use `font-variant-numeric: tabular-nums`.
- License: SIL Open Font License 1.1. Self-hosted as WOFF2, subset to Latin, with the license file kept beside the fonts. Only the weights in use ship: Sans 400, 500, 600; Mono 400, 600. Only the first view's fonts are preloaded.
- IBM Plex Sans Arabic exists for a future Arabic interface. It is not shipped now.

Sizes below are in px for reading. The tokens are written in rem (16 px = 1rem; 13 px = 0.8125rem), so text follows the browser's zoom and font size.

| Token | Size / line height | Use |
|---|---|---|
| `--text-xs` | 13 / 1.45 | Metadata. Never lesson prose. |
| `--text-sm` | 14 / 1.5 | Dashboard tables, the tests panel |
| `--text-base` | 16 / 1.6 | Interface text |
| `--text-prose` | 17 / 1.6 | Lesson instructions |
| `--text-lg` | 20 / 1.4 | Section headings |
| `--text-xl` | 24 / 1.3 | Page headings |
| `--text-2xl` | 30 / 1.25 | The home page heading, XP and streak numerals |
| `--text-code` | 14 / 1.55 at 768 px and wider; 16 / 1.55 below | Editor and console |

- Lesson prose measure: 60 to 75 characters (`max-inline-size: 68ch`).
- Weights: 400 for text, 500 for labels and buttons, 600 for headings and the wordmark. No uppercase labels with wide tracking.

## 6. Space, shape, depth

- Spacing scale on a 4 px base: `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-5` 24, `--space-6` 32, `--space-7` 48, `--space-8` 64 px.
- Phone side gutter: 16 px. Touch targets at least 44 by 44 px.
- Radius by role: `--radius-control` 4 px (buttons, fields), `--radius-panel` 6 px (panels, cards), `--radius-dialog` 8 px. Nothing is pill-shaped. Reason: small radii read as precise and formal; they rise with the size of the element.
- Depth comes from surface steps and hairline borders. A shadow appears only on elements that float above content (dialogs, menus): `--shadow-float: 0 8px 24px rgb(0 0 0 / 0.5)`.
- Focus ring: 2 px solid `--color-focus`, offset 2 px, on every focusable element; inset inside overflow containers (section 4.5). Nothing else glows.

## 7. Motion

- MOTION 1: hover, press, and state changes only. No entrance animations, no scroll effects.
- Duration 120 to 160 ms, ease-out. `--motion-fast` 120 ms, `--motion-base` 160 ms.
- Under `prefers-reduced-motion: reduce`, every transition is off.
- Completion moment: the tests panel shows the pass state, the pass icon, the words that name the lesson as complete, and the XP earned in Plex Sans at `--text-2xl`. Nothing animates beyond the 160 ms state change.

## 8. Icons

- IBM Carbon icons, Apache License 2.0, imported one by one as SVG components and shipped in the bundle. Size 16 or 20 px, `currentColor`.
- Few icons, each naming a real action or state: Run, Stop, Check, Reset code, pass, fail, warning, menu, close, external link. A new icon needs a real action or state.
- An icon-only button has an accessible name from `src/messages`.
- The one exception is the Google sign-in button. It uses Google's official "G" mark and Google's dark button style, unaltered, as Google's branding rules require. It is a third-party mark, not a Heap asset, so `CLAUDE.md` rule 6 does not apply to it.

## 9. Distinct from IBM's own design system

IBM Plex, Carbon icons, and dark neutral grays together sit close to IBM's Carbon design system. Amber, the Plex Mono label motif, and the radii above keep it distinct. Components do not copy Carbon's look: no square tabs with a filled selected tab, no 0-radius fields, no Carbon component styles. The WP-1.4 screenshot review checks this.

## 10. Never

Everything in `docs/spec/03-experience.md` section 10.9, plus:

- No illustration, mascot, or generated imagery of any kind.
- No logo or mark drawn by the implementer. The wordmark is text.
- No burgundy, no CRT effects (scanlines, curvature, flicker, phosphor glow).
- No second accent color, and no amber used as decoration.

## 11. Signature

Owner approval of this direction for the first release:

Signed: Fahad    Date: 2026-11-15 (first version)

Revision 1 after the first design review on 2026-11-15: component states (4.5), link underlines, the editor palette without amber, editor chrome, font tokens, the inset focus ring, the Google button, and reasons for the main choices.

Signed: Fahad    Date: 2026-11-15 (revision 1)

Revision 2 after the second design review on 2026-11-15: a more visible editor selection (`#34343C`), comments raised to `#A09C94`, no active-line background, hover one step above its surface, disabled and read-only outlines, header link states, and the complete contrast record (4.3).

Signed: Fahad    Date: 2026-11-15 (revision 2)
