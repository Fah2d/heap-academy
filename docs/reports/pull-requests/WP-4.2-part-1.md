**Part 1 of WP-4.2.** The Markdown parser only. Branched from `main`.

## What and why

The allowlist of `04-content-system.md` section 5 (NFR-SEC-07, T-06), as a parser from lesson Markdown to a typed tree of allowed nodes. The tree holds only plain text, so there is no HTML string for anything to inject; the renderer of part 2 turns it into elements, and React escapes the text.

## Work package

- Work package: WP-4.2 The lesson editor, part 1.
- Requirements and threats covered: NFR-SEC-07 and T-06, for the parsing half.
- Time box 3.5 hours for the whole package. Part 1 took from 07:35 on 2026-11-20 to the commit, with a usage-limit pause in between, plus the description and review.

## What changed

| Item | Where |
|---|---|
| `parseMarkdown(markdown)`: paragraphs, emphasis and strong emphasis (matched in one pass with a stack of open runs, so `*args and **kwargs` stay as written), inline code, fenced code blocks with an optional language, ordered and unordered lists (nested), GFM tables with alignment, headings of level two and three, block quotes, and `https` links. Raw HTML is dropped: tags, comments, and the content of script-like elements (`script`, `style`, `iframe`, `svg`, `template` and others). A line that starts with an inline tag keeps its paragraph; a line holding only a tag drops its block, as in CommonMark. Images are dropped with their text. A link of any other scheme, or with a user name or password, keeps its text, unlinked. A link's text holds no link. Other heading levels become paragraphs. `snake_case` names and arithmetic like `2 * 3 * 4` stay as written. | `src/content/markdown/parse.ts` |
| `allowedHref`: an address that starts with `https://`, parses as an `https:` URL and has no user name or password, returned in the form the URL parser gives, which is what a browser follows. | `src/content/markdown/parse.ts` |
| Limits: nesting deeper than 8 is kept as text; a table wider than 20 columns stays text, and a row keeps only its own cells; text past the lesson limit of 20,000 characters (code points) is not read. Every pass is linear in the input. | `src/content/markdown/parse.ts` |
| The seeded property testing helper, the same file as on `wp/3.3-grader`. | `scripts/testing/property.ts` |

## How it was verified

`pnpm verify` at the docs commit (the code is that of efc8284 plus one test):

```
 Test Files  9 passed (9)
      Tests  458 passed (458)
```

Coverage of the parser (no gate applies to `src/content`):

```
  parse.ts        |   97.67 |    86.14 |     100 |    98.4 | 171-172,280-282
```

Time to parse at 5k / 10k / 20k characters, on this Mac, for the shapes the reviews found slow: `*a ` 1.1 / 1.2 / 1.0 ms; `*a\n` 0.4 / 0.6 / 1.3 ms; `a*b` 0.5 / 0.9 / 1.4 ms; `<!--` 0.1 / 0.0 / 0.1 ms; a heading of mixed spaces and tabs 0.1 / 0.1 / 0.2 ms (at d7a5f36, 20,000 characters of it took 15.5 minutes).

Six mutants (the depth limits on lists and on emphasis, the inline and block comment rules, the list-interrupt rule, the tag-line rule) each fail at least one test.

pnpm's install check failed on the sandbox's store lock, as on the other part-1 branches.

**Tests added** in `src/content/markdown/parse.test.ts` (76): each allowed construct with its exact tree; an unclosed fence; escapes; code spans keeping markers and tags as text; 27 malicious fixtures, each checked for allowed node kinds only, https links only, no tag or event handler left in visible text, and no `javascript:`, `data:` or `vbscript:` address (script tags and blocks, event handler attributes, `svg`, `iframe`, raw anchors, `javascript:` in several spellings, `data:`, `http:`, protocol-relative, autolinks, images, comments, `style`, HTML nested in emphasis, link labels, table cells, list items and quotes, reference-style links, an unclosed script tag, `template`); text joined across dropped markup staying one text node; a link's text holding no link; https autolinks; emphasis runs; paragraphs that start with a tag; a property test over random input built from Markdown and HTML fragments; the depth limits for quotes, lists and emphasis; the table width; the tree's size at the lesson limit for twelve shapes, at most 40 times the input as JSON; five lines that once backtracked catastrophically; the code-point limit; `allowedHref`, against 23 refused addresses.

## Screens

None.

## Reviews

- Code review 1 (`docs/reports/reviews/WP-4.2-part-1/code-review-1.md`), of d7a5f36: CHANGES REQUIRED, with 1 blocker, 4 majors and 6 minors. All fixed except MAJOR 4 (an owner decision) and the parts of MINOR 5 listed under deviations. The response is at the end of the file.
- Security review 1 (`docs/reports/reviews/WP-4.2-part-1/security-review-1.md`), of d7a5f36: CHANGES REQUIRED, with 1 major (a 20,000-character table became about 525 MB) and 6 minors. All fixed in b5bb9e1.
- The fixes were not reviewed again.

## Owner actions now due

1. Section 7's example lesson uses an indented code block, which section 5 does not allow and the parser shows as a paragraph. Recommended: a `spec-change` that makes it a fenced block.
2. Decide the parser: this hand-written one for the spec's subset, or a library (for example the `micromark` and `mdast` family) with an ADR. Packages could not be installed in the sandbox, so no library was tried.

## Deviations from the plan or the spec

- **Not all of CommonMark.** Only the allowed subset is parsed. Not supported: entities (`&amp;` is shown as written), reference-style links (text), indented code blocks, a table directly after a paragraph line (text), lazy continuation lines in quotes and list items, tab-indented content in list items, and emphasis runs longer than three. A paragraph's lines are joined with a newline, which the page shows as a space. The supported subset belongs in the field help in part 2.
- **An `https` autolink (`<https://…>`) becomes a link with its address as text.** Section 5 does not mention autolinks.

## What is left for part 2

The single lesson-content component that renders the tree (links in a new tab with `rel="noopener noreferrer"`; short table rows filled with empty cells; every text as React text and never through an HTML sink), highlighting on the server, the copy control, the code editor with the nonce, the lesson editor and its preview through the same component, saving through `save_lesson`, the unsaved-changes warning, the stale-save refusal, and the fixtures checked in the rendered output and the preview (the rendered HTML holds `&lt;script` and never `<script`).

## Risks and rollback

Nothing calls the parser yet.

## Definition of Done

- [ ] Every "Done when" line is met. **Not met:** all of them are part 2; this part covers the neutralizing of the malicious fixtures at the parser.
- [x] NFR-SEC-07 and T-06 have passing tests that name their IDs.
- [x] `pnpm verify` passes.
- [x] No stub, dead control, placeholder, or invented number.
- [x] No new tables. No new server actions.
- [ ] Every reviewer blocker is fixed. See Reviews.
- [x] No AI attribution in any commit or in this description.

## Opening this pull request

`gh` cannot reach GitHub from the sandbox. From your terminal in the repository root:

```sh
gh pr create --draft --base main --head wp/4.2-markdown-part-1 \
  --title "feat(content): WP-4.2 part 1 the Markdown parser" \
  --body-file docs/reports/pull-requests/WP-4.2-part-1.md
```
