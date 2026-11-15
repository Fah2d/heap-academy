# Brand kit

Put the Heap brand files here before Day 1. The implementer never draws, generates, or edits a brand asset (`CLAUDE.md` rule 6). WP-1.1 lists anything missing for you to supply.

| Path | What | Format |
|---|---|---|
| `logo/` | The full logo | SVG, plus PNG at 2x if you have it |
| `mark/` | The seven-block heap mark on its own | SVG |
| `wordmark/` | The wordmark | SVG |
| `mascot/` | The mascot, every pose and outfit you have | SVG, or PNG with transparency |
| `fonts/` | Handjet and any other brand fonts, each with its license file | WOFF2 or TTF |
| `icons/` | The favicon and app icon, or a note saying the mark may be used for them | SVG and PNG |
| `brand-book.pdf` | Colors, type, spacing, and usage rules | PDF |
| `colors.md` | The exact color values, if the brand book does not list them | Text |

What happens with them:

- WP-1.1: `DESIGN.md` is written from your answers, with these files as the source of truth for identity. The brand book wins wherever `docs/spec/03-experience.md` section 10 differs from it.
- WP-1.4: the design tokens and fonts are built from them.
- In the product, the only illustrations (empty states, the completion moment, the not-found page) come from the mascot files here.

Only include fonts and files you are allowed to self-host on a commercial site.
