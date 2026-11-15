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
- Identity motif: a typographic voice. IBM Plex Mono carries every structural label: lesson numbers (`1.3`), test case names in the tests panel, and console prompts. Plex Sans carries everything else. The current item, such as the current lesson in a list, is marked by a 2 px amber bar on its inline-start edge.

## 3. Theme

Dark only (ADR-0015). Components use semantic tokens only, so a second theme stays a token file.

## 4. Color

### 4.1 Primitives

Raw values. Never used in components.

| Token | Value |
|---|---|
| `--gray-950` | `#0E0E10` |
| `--gray-925` | `#121215` |
| `--gray-900` | `#16161A` |
| `--gray-850` | `#1E1E23` |
| `--gray-700` | `#2E2E36` |
| `--gray-500` | `#74747F` |
| `--gray-300` | `#A9A59D` |
| `--gray-50` | `#F2F0EC` |
| `--amber-500` | `#D4A017` |
| `--amber-400` | `#E3B53A` |
| `--green-400` | `#6FD08C` |
| `--red-400` | `#FF7A7A` |

### 4.2 Semantic

| Token | Primitive | Use |
|---|---|---|
| `--color-bg` | `--gray-950` | Page background |
| `--color-surface` | `--gray-900` | Panels, cards, the console |
| `--color-surface-raised` | `--gray-850` | Dialogs, menus, hovered rows |
| `--color-surface-editor` | `--gray-925` | The code editor |
| `--color-text` | `--gray-50` | Body text, headings, the wordmark |
| `--color-text-muted` | `--gray-300` | Secondary text, metadata |
| `--color-border` | `--gray-700` | Hairline dividers between regions. Decorative only. |
| `--color-border-control` | `--gray-500` | The boundary of text fields and other controls |
| `--color-action` | `--amber-500` | Primary button fill, links, progress, the current-item bar |
| `--color-action-hover` | `--amber-400` | Primary button fill on hover and press |
| `--color-on-action` | `--gray-950` | Text and icons on amber. Never white. |
| `--color-focus` | `--amber-500` | The focus ring |
| `--color-pass` | `--green-400` | A passing test case, a completion |
| `--color-fail` | `--red-400` | A failing test case, an error |

Amber is the single accent. It marks the primary action, focus, progress, and the current item, and it is never decoration.

Warning has no hue of its own. Amber owns the warm range, so a second warm hue would read as the accent. A warning is a notice in `--color-text` with the Carbon warning icon and a sentence that says what happened.

Pass, fail, and warning always carry an icon and a word. Color is never the only signal.

### 4.3 Measured contrast

Measured on 2026-11-15 with `.claude/skills/antislop-human/contrast-check.py` (WCAG 2 formula).

| Foreground | `#0E0E10` bg | `#121215` editor | `#16161A` surface | `#1E1E23` raised |
|---|---|---|---|---|
| Text `#F2F0EC` | 16.94 | 16.43 | 15.85 | 14.58 |
| Muted `#A9A59D` | 7.86 | 7.62 | 7.35 | 6.76 |
| Amber `#D4A017` | 8.12 | 7.87 | 7.60 | 6.99 |
| Pass `#6FD08C` | 10.17 | 9.86 | 9.52 | 8.76 |
| Fail `#FF7A7A` | 7.64 | 7.41 | 7.15 | 6.57 |
| Control border `#74747F` | 4.18 | 4.05 | 3.91 | 3.59 |

On amber: `#0E0E10` on `#D4A017` is 8.12, and on `#E3B53A` it is 10.04.

Every text pair passes AA for normal text (4.5). The control border passes the 3 to 1 rule for non-text contrast on every surface. `--color-border` (`#2E2E36`, 1.43 on the background) is decorative only and never the only boundary of a control.

### 4.4 Syntax highlighting

A small palette on `--color-surface-editor` (`#121215`). It is not a stock editor theme. Measured with the same checker.

| Token | Value | Ratio | Applies to |
|---|---|---|---|
| `--syntax-text` | `#F2F0EC` | 16.43 | Names, operators, punctuation |
| `--syntax-keyword` | `#D4A017` | 7.87 | `def`, `if`, `for`, `return`, `import` |
| `--syntax-string` | `#C9D6A3` | 12.14 | Strings |
| `--syntax-number` | `#F0B98D` | 10.71 | Numbers, `True`, `False`, `None` |
| `--syntax-function` | `#9CC5E6` | 10.28 | Function names in definitions and calls |
| `--syntax-builtin` | `#E6C79A` | 11.58 | Built-ins such as `print`, `input`, `len` |
| `--syntax-comment` | `#949088` | 5.88 | Comments |
| `--syntax-error` | `#FF7A7A` | 7.41 | The error underline and gutter marker |

## 5. Type

- IBM Plex Sans for the interface, lesson prose, the wordmark, and the XP and streak numerals. IBM Plex Mono for code, the console, and the structural labels of section 2. Handjet is not used.
- License: SIL Open Font License 1.1. Self-hosted as WOFF2, subset to Latin, with the license file kept beside the fonts. Only the weights in use ship: Sans 400, 500, 600; Mono 400, 600. Only the first view's fonts are preloaded.
- IBM Plex Sans Arabic exists for a future Arabic interface. It is not shipped now.

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
- Radius by role: `--radius-control` 4 px (buttons, fields), `--radius-panel` 6 px (panels, cards), `--radius-dialog` 8 px. Nothing is pill-shaped.
- Depth comes from surface steps and hairline borders. A shadow appears only on elements that float above content (dialogs, menus): `--shadow-float: 0 8px 24px rgb(0 0 0 / 0.5)`.
- Focus ring: 2 px solid `--color-focus`, offset 2 px, on every focusable element. Nothing else glows.

## 7. Motion

- MOTION 1: hover, press, and state changes only. No entrance animations, no scroll effects.
- Duration 120 to 160 ms, ease-out. `--motion-fast` 120 ms, `--motion-base` 160 ms.
- Under `prefers-reduced-motion: reduce`, every transition is off.
- Completion moment: the tests panel shows the pass state, the pass icon, the words that name the lesson as complete, and the XP earned in Plex Sans at `--text-2xl`. Nothing animates beyond the 160 ms state change.

## 8. Icons

- IBM Carbon icons, Apache License 2.0, imported one by one as SVG components and shipped in the bundle. Size 16 or 20 px, `currentColor`.
- Few icons, each naming a real action or state: Run, Stop, Check, Reset code, pass, fail, warning, menu, close, external link. A new icon needs a real action or state.
- An icon-only button has an accessible name from `src/messages`.

## 9. Never

Everything in `docs/spec/03-experience.md` section 10.9, plus:

- No illustration, mascot, or generated imagery of any kind.
- No logo or mark drawn by the implementer. The wordmark is text.
- No burgundy, no CRT effects (scanlines, curvature, flicker, phosphor glow).
- No second accent color, and no amber used as decoration.

## 10. Signature

Owner approval of this direction for the first release:

Signed: Fahad    Date: 2026-11-15
