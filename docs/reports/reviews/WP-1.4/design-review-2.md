# Design review 2, WP-1.4

Reviewer: `design-reviewer`, fresh context. Range `ef7276c..8c99179`. 2026-11-16.

Verdict: **CHANGES REQUIRED**. antislop active: during (global preference).

The reviewer is read-only, so the implementer saved this report as the reviewer returned it.

This time it is a screen review. I opened all 16 screenshots. I cropped the phone shots to full resolution and measured pixel colors where a judgment depended on them. The direction holds:

- It does not read as a template or as Carbon.
- The header recedes.
- 320 and 375 px are designed single-column layouts with 16 px gutters.
- The tab bar sits on its hairline.
- Disabled, invalid, read-only, progress and test case states match `DESIGN.md` 4.5.

There are two problems:

- One primitive state does not render: the current nav link.
- The Delivery Gate in the pull request was written before any screenshot existed, and a screenshot now contradicts one of its lines.

The owner reported 38 passed. That matches the test count in the spec files (gallery: 4 widths × 5 + 2 motion = 22; shell: 4 + 4 × 3 = 16). The raw output is not in the repository, so the count is taken as reported.

## BLOCKER

1. **The Delivery Gate is stale, and a screenshot contradicts it.** `docs/reports/pull-requests/WP-1.4.md:58-65`, `:71`, `:82`, `:95`, `:99`.
   - Block 3 says "The identity motif is Plex Mono labels with the amber current-item border: yes". The one current-item marker built in this package, the nav link's amber bar, does not render (finding 2; `gallery-*.png`).
   - The same file still says "No screenshots exist yet" and "The browser checks have not run". It lists R-03 NOT VERIFIED, R-35 FAIL, R-30 NOT VERIFIED and C-4 NOT VERIFIED.
   - Fix: rewrite the Gate against these screenshots and this review, line by line:
     - R-03 and R-30 from what is seen here.
     - R-35 from the owner's run, saying the raw output is not committed.
     - Block 3 after finding 2 is fixed.
     - Lines this review could not verify (below) stay NOT VERIFIED.

## MAJOR

2. **The current nav link shows no amber bar and no text color. Only its weight marks it.** `src/ui/primitives/link.tsx:28` and `:37`; `gallery-320/375/768/1280.png` and the dialog set, under "Links".
   - What the screenshots show: "Buttons" (current) paints `#a9a59d`, the muted color, with zero amber pixels below it. "Links" (not current) paints the same `#a9a59d`. The selected tab, for comparison, paints `#f2f0ec` with a 2 px `#d4a017` bar.
   - Cause: `cx()` appends `border-action font-semibold text-text` after `border-transparent text-text-muted`. Tailwind orders utilities in the stylesheet, not in the class attribute. In `.next/static/chunks/3n4di3gpdn6zd.css`, `.border-transparent` sits at byte 9896 after `.border-action` at 9692, and `.text-text-muted` at 11828 after `.text-text` at 11793. The rest classes win.
   - This breaks `DESIGN.md` 4.2 (current: `--color-text`, 600, 2 px `--color-action` bar on the block-end edge). It also breaks "state shown by more than color": the only cue left is weight.
   - Fix:
     - Make the two sets exclusive: `isCurrent ? "border-action font-semibold text-text" : "border-transparent text-text-muted hover:text-text"`. Or use `aria-[current=page]:` variants.
     - Add an e2e assertion on the computed `color` and `border-block-end-color` of the current nav link in `e2e/gallery.spec.ts`. jsdom does not compute Tailwind, so a unit test cannot catch this.
     - I found the same unprefixed same-property pattern nowhere else in `src/ui/primitives`.

## MINOR

3. **At 320 px the dialog's actions wrap raggedly.** `gallery-dialog-320.png`; `primitive-gallery.tsx:134`. "Keep my code" sits right-aligned, with "Reset code" right-aligned below it at a different width. At 375 px they fit on one row. The workspace Reset dialog will copy this pattern. Fix: give `Dialog` an actions region that stacks full-width buttons when the row does not fit (for example, a single-column grid below a container width, with `block` buttons).
4. **The dialog trigger stretches the full content width, 1120 px at 1280.** `gallery-*.png` "Dialog"; `primitive-gallery.tsx:129-130`. The `Section` is `flex flex-col`, so it stretches the trigger by default. This is not the `block` variant. Fix: wrap the trigger in `Example`, or add `items-start` to the section.
5. **The system pages do not share the header's left edge at 768 and 1280 px.** `not-found-768/1280.png`, `error-768/1280.png`; `system-page.tsx:18`. The wordmark sits at x 16 / 80, but the heading sits at x 74 / 330, because the section is a centered `max-w-prose`. The gallery aligns with the header, so screens of one kind do not share one structure (RHYTHM 1). Fix: an outer `mx-auto max-w-page px-gutter`, with the `max-w-prose` column inside it, left-aligned.
6. **The not-found page has no primary action.** `not-found-*.png`; `not-found-view.tsx:9`. Its only step is a standalone text link, while the error page leads with an amber button. `DESIGN.md` section 2 makes the one primary action the focal point of every page except the workspace. Fix with WP-5.1, when `/` exists: make the next step the primary action (a link styled as the primary button).
7. **At 320 px the not-found heading leaves "page" alone on its last line.** `not-found-320.png`; `system-page.tsx:19`. Fix: `text-balance` on the `h1`.
8. **Gallery labels repeat what they label.** `primitive-gallery.tsx:67-69` and `:194`; `gallery.ts:19`, `:76`.
   - The mono label "Go to the notices" repeats the link text below it.
   - "Test case states" repeats its own `h2`.
   - The nav example has no label at all.
   - Fix: label the variant ("Standalone link", "Navigation, first one current") and drop the duplicate status label.
9. **The screenshots hide or distort part of what they show.** `e2e/screens.ts:13`, `e2e/gallery.spec.ts:14-22`, `playwright.config.ts` projects.
   - The Next.js development indicator ("N") covers content: the "Text fields" heading in `gallery-375`, the standalone link in `gallery-320`, the first field in `gallery-768`, and the dialog set.
   - `fullPage: true` paints the fixed backdrop as a 900 px band in the middle of the page.
   - The 320 and 375 px shots use the "Desktop Chrome" device resized, not a phone: no touch, scale 1, `isMobile` false.
   - Fix:
     - Turn off `devIndicators` for the e2e development server, or remove its portal before capture, as is already done for the error overlay.
     - Capture the dialog state viewport-only.
     - Add a phone device project for the narrow shots in a later pass.

## What the screenshots settle

- **Template or Carbon: not a template, not a Carbon clone.** The differences from Carbon:
  - Fields are outlined with a 4 px radius on `--color-bg`. Carbon's are filled, 0 radius, bottom border only.
  - Notices use a neutral fill and a full border, with the kind in the icon and word. Carbon uses a tinted fill and a colored left stripe.
  - Buttons are radius 4 with centered labels. Carbon's are square with left-aligned labels.
  - Tabs are line tabs with an amber bar, not Carbon's contained tabs, which `DESIGN.md` 9 forbids.
  - Amber and the Plex Mono labels (confirmed as Plex Mono at 5× zoom) carry the identity. ENERGY 1 is honored, not sterile.
- **Header chrome: recedes.** The wordmark is 20 px / 600 in `--color-text` on a hairline, 68 px tall, with no nav (accepted).
- **320 and 375 px: designed.** One column, 16 px gutters, full-width fields. Buttons wrap to a new row, not off-screen. No horizontal overflow in any of the 16 screenshots, and the overflow tests passed as reported. The exception is finding 3.
- **Tab bar:** the bar's lower row is the hairline row (`#d4a017` at y 1276-1277 under "Lesson"; `#2e2e36` hairline at y 1277 elsewhere). It sits on the hairline.
- **Spacing and hierarchy:**
  - Spacing: 48 px between sections, 16 px within them.
  - Type: `h1` 24 / 600, `h2` 20 / 600, mono 13 muted labels, 16 px body.
  - One focal point per system page. The error page's amber link beside the amber button is allowed by `DESIGN.md` 4.2 and stays visibly secondary.
- **States:**
  - Disabled buttons: no fill, hairline, muted text.
  - Invalid field: `--color-fail` border, icon and sentence.
  - Read-only field: surface fill, hairline, no hover.
  - Progress: square ends, text value always shown. "5.5 MB" traces to E-02's 5.46 MB.
  - Status: icon and word each.
  - The dialog fits within 375 px with 16 px margins.
- **Colors:** pixel colors match the tokens (`#0e0e10`, `#f2f0ec`, `#a9a59d`, `#d4a017`). `contrast.md` has 52 text and 15 non-text lines, as it claims.
- **Words:** no em dashes. The error hint now reads "If it keeps happening, keep this reference." and asks for nothing the learner cannot do.

## Not verified

No screenshot shows these:

- The focus ring, so the amber ring around the amber primary button is still unseen.
- Hover and press.
- Forced colors (review 1 item 8).
- The dialog with the keyboard open at 375 px (item 9).
- The font swap and layout shift.
- A long reference wrapping. Only an 8-character digest was captured; the source has `break-all`.
- Whether the selected tab's weight shifts its neighbors.
- The skip link's appearance.
- Firefox and WebKit.
- Real phone emulation.

## Outcome

| #                           | Outcome                                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Review 1: 1, 3, 11          | Accepted by the owner (1 until WP-5.1; 3 via a later `spec-change`; 11 for a follow-up). Record on the Gate's R-24 and R-39 lines.             |
| Review 1: 2, 4, 5, 6, 7, 13 | Fixed, and confirmed in the screenshots where visible (2, 4, 5, 13).                                                                           |
| Review 1: 10                | Fixed in source; a long reference is not captured.                                                                                             |
| Review 1: 15                | Fixed in de50547 (320 px added).                                                                                                               |
| Review 1: 8, 9              | Still open; need screenshots.                                                                                                                  |
| Review 1: 12, 14            | Still open, listed in the pull request.                                                                                                        |
| This review: 1, 2           | Open. Must be fixed before approval. Finding 2 needs one rerun of the gallery screenshots to close.                                            |
| This review: 3-9            | Open, MINOR. 6 belongs with WP-5.1.                                                                                                            |

When 1 and 2 are fixed and a fresh gallery screenshot shows the current nav marker, this becomes APPROVE WITH NOTES, the notes being the "Not verified" list and the MINORs.
