# WP-4.2 part 1 security review 1

Range: `main..d7a5f36` (`src/content/markdown/parse.ts`, `src/content/markdown/parse.test.ts`, `scripts/testing/property.ts`). Result: **CHANGES REQUIRED**. 0 BLOCKER, 1 MAJOR, 6 MINOR.

The format follows `docs/reports/reviews/WP-1.2/security-review-2.md`. The file named in the request, `docs/reports/reviews/WP-3.1/security-review-3.md`, does not exist.

The answers to the questions asked are mostly reassuring:
- **Non-https links:** no input found produces a link with any other scheme. This held for 31 probes covering scheme tricks, whitespace, control characters, encoded forms, `https:` without `//`, and backslashes.
- **Nodes outside the allowlist:** none.
- **Script after rendering:** no path to script through text or `href`, as long as part 2 renders text as React text.
- **Recursion:** bounded at 8 levels.
- **Backtracking:** no exponential cases. The worst cases are quadratic.

The one real problem is memory: a 20,000-character table becomes a tree of about 525 MB.

## MAJOR 1. A 20,000-character table becomes 12.5 million cells and about 525 MB of heap (T-14, T-23)

- **Where:** `src/content/markdown/parse.ts:298-306`, specifically line 304: `rows.push(head.map((_, column) => inlines(row[column] ?? "", depth)))`.
- **How it works:** every body row is padded to the width of the header. One line `|a|a|…` of 2,499 columns, a matching delimiter row, then 5,000 lines of `|`.
- **How it is reached:** an imported lesson file (T-23 treats imports as possibly hostile), opened in the dashboard preview, or published. Then the server's parse and render for that lesson, which part 2 will turn into the same number of `<td>` elements.
- **Evidence (Node 26.13.1, measured on this Mac):**
  ```
  table 2499x5000: 320 ms, heapDelta 525 MB, body cells 12495000
  table cols=3000 rows=3998  len=20000 429.4 ms heapDelta=490.9MB json=36.09MB
  table cols=1000 rows=7998  len=20000 302.1 ms heapDelta=332.3MB json=24.04MB
  ```
  The 20,000-character limit does not bound the output: that is about 25,000 bytes of heap per input character. No test checks output size.
- **Fix:**
  - Add a column cap next to `MAX_DEPTH`, for example `MAX_TABLE_COLUMNS`, plus a total-cell cap. Above either cap, keep the table as paragraph text.
  - Do not pad short rows in the tree. The renderer can fill in empty cells within the capped width.
  - Add a test that, for the worst table, list and emphasis shapes at `MARKDOWN_LIMIT`, the size of `JSON.stringify(tree)` stays within a small multiple of the input length.

## MINOR

1. **Quadratic emphasis scan and delimiter regex (T-14).**
   - **Emphasis:** `closing()` at `parse.ts:472-502` scans to the end of the text for every opener that has no closer. `"*a ".repeat(6666)` took 29 ms at 5k characters, 112 ms at 10k and 434 ms at 20k. `_a ` and the same text inside a list gave the same results.
   - **Delimiter regex:** `TABLE_DELIMITER` at `parse.ts:48` has two adjacent `[ \t]*`, with `\|?` optional between them. A delimiter row followed by spaces and `x` took 11, 42 and 142 ms at 5k, 10k and 20k.
   - **Nesting does not make it worse:** wrapping the text in 1 to 7 levels of emphasis stayed at 430 to 452 ms.
   - **Fix:** find closers in one pass, either with a delimiter stack or by computing closer positions once per text. Trim the delimiter line before matching and anchor the end as `(?:\|)?$`.
2. **A false test property (T-06).**
   - Dropping a tag or comment in the middle of text joins the text on either side into something that looks like markup:
     - `<scr<!-- -->ipt>x` gives the text `<script>x`.
     - `<scr<b>ipt>alert(1)</scr<b>ipt>` gives the text `<script>alert(1)</script>`.
   - This is inert as React text, and it never becomes a link: `[x](java<!-- -->script:alert(1))` gives the text `[x](javascript:alert(1))` and no link.
   - **The problem:** the property at `parse.test.ts:297` ("no `<script` unless a backslash") does not hold. The first input has no backslash. The random generator just never produces `<!--`. The fixture check at line 233 depends on the same false assumption.
   - **Fix:** remove or restate the property. Add both inputs to `MALICIOUS`. In part 2, assert that rendered HTML contains `&lt;script` and never `<script`. The only safety guarantee is "text is rendered as text", so no text from this tree may ever reach an HTML sink (highlighter, metadata, preview string).
3. **A link can sit inside a link.**
   - **Where:** `parse.ts:389-393` and `421-425`.
   - **Evidence:** `[<https://inner.example>](https://outer.example)` gives a link to outer.example whose child is a link to inner.example.
   - **Effect:** `<a>` inside `<a>` is invalid HTML. The browser's parser splits it, so the page structure no longer matches what React produced. This does not run script.
   - **Fix:** parse link labels with links and autolinks turned off, and add a test.
4. **Addresses are kept as written, not as checked.**
   - **Where:** `parse.ts:319-326` and `425`.
   - **Evidence:**
     - `https://\evil.example` is kept as typed; Node reads it as `https://evil.example/`.
     - `https://trusted.example@evil.example/` and `https://javascript:alert(1)@evil` are kept too. Their host is the evil domain, the scheme is still https.
   - **Tests:** none cover backslashes, control characters, Unicode whitespace, zero-width characters, entities, percent-encoding or the `<…>` form. All of these are refused today:
     - `https:evil`, `https:/evil`, `https:\\evil`, `https:\t//evil`, `\0https://`
     - `https://ev\0il`, `https://evil `, `​https://`, `https://a b`, `https://evil\u007f`
     - `https%3A//`, `https&#58;//`, `<https://a b>`, `HtTpS://`, `<https:\\evil>`, `\https://`
   - **Fix:** return `new URL(href).href`, refuse addresses with a username or password, and turn the probe list above into tests.
5. **A comment says the opposite of the code.** `parse.ts:387-388` says autolinks are dropped. The code keeps https autolinks: `<https://e.example>` gives a link. No test covers this. Fix either the comment or the behaviour, and add a test.
6. **A fence with an info string swallows the rest of the lesson.** This is a correctness bug, not a script risk.
   - **Where:** `FENCE` at `parse.ts:44` accepts nothing after the language.
   - **Evidence:** ```` ```python title="x" ```` is not read as a fence. The code inside is parsed as Markdown, and the closing fence then opens a new code block that runs to the end: the next paragraph and heading become code.
   - **Fix:** accept any info string, and take its first word as the language if it matches the allowed characters.

## Confirmed sound

- **The `https://` prefix fixes the scheme.** The link pattern excludes every `\s` character. `new URL` throws on control characters in the host.
- **The node kinds are a closed union**, and the tests' tree walk is exhaustive.
- **Recursion is bounded by `MAX_DEPTH`.** Inline depth carries on from block depth.
- **Building a `RegExp` from a tag name is safe.** The name must first match the exact `DROPPED_WITH_CONTENT` list.
- **Script and style content is dropped**, including mixed case, a space before `>`, a newline inside the closing tag, an unclosed tag, and inside quotes, lists and tables.
- **No new dependencies**, and the lockfile is unchanged.

## What part 2 must carry

- The T-06 fixtures checked against the rendered output and in the dashboard preview.
- Server highlighting that returns tokens rendered as elements, never an HTML string.
- `rel="noopener noreferrer"` on every link.
- The language used only as data.
- One component for both the workspace and the preview.

## What was run

- **`pnpm verify`:** passed. 9 files, 425 tests. `parse.ts` coverage is 96.39% of statements and 83.69% of branches.
- **Scratch probes:** four runs of a scratch file at `src/content/markdown/zz-probe.test.ts`, run with `npx vitest run … --silent=false --pool=forks`, with `NODE_OPTIONS=--expose-gc` for the heap figures. They covered address tricks, fence languages, putting payloads back together after a drop, 40 timing shapes at 20,000 characters, scaling at 5k, 10k and 20k, and table memory. The file was deleted afterwards; `git status` showed only the owner's `.claude/settings.json`.

## What was not checked

- **Rendering (part 2):** not built.
- **Browsers:** Node's URL parser stood in for theirs; no browser was run.
- **Memory limit:** whether 525 MB crashes a function under Vercel's memory limit is not measured, and no timings were taken on Vercel hardware.
- **Raw HTML lint (WP-1.2):** not re-checked. WP-1.2 review 2 listed ways around it.
- **Where the 20,000 limit is enforced:** in the schema and database, and whether it counts characters or UTF-16 units; not checked.
- **The import and preview code paths:** not checked.

## Response (implementer, b5bb9e1)

Every finding was fixed, each starting from a test that failed before the change (9 failed, then 62 passed).

| Finding | Change |
|---|---|
| MAJOR 1 | `MAX_TABLE_COLUMNS = 20`; a wider table stays text. Rows keep only their own cells, cut to the header's width, so cells are bounded by the number of `|` in the input and no total-cell cap is needed. Twelve shapes at the lesson limit, among them the 2,499-column table, are tested to give JSON at most 40 times the input. |
| MINOR 1 | Each emphasis marker remembers where its closer search last failed, so a later opener does not rescan. Comments use one `lastIndexOf("-->")` check. The delimiter row is checked cell by cell, with no regex over the whole line. The heading regex no longer has adjacent `[ \t]*`; the closing `#` run is cut in code. Measured after, at 5k / 10k / 20k: `*a ` 1.1 / 1.2 / 1.7 ms; `**a ` 0.8 / 1.1 / 2.1 ms; delimiter row 0.2 / 0.3 / 0.1 ms; `<!--` 0.1 / 0.0 / 0.1 ms. No timing assertion was added, since one would depend on the machine. |
| MINOR 2 | The property no longer checks the text for `<script`. A comment on the fixtures states the real guarantee. A test pins that the two joined inputs come out as a single text node, and that `java<!-- -->script:` gives no link. Checking the rendered HTML is part 2. |
| MINOR 3 | Link text is parsed with links off; an autolink there is text. Tested. |
| MINOR 4 | `allowedHref` returns `new URL(href).href` and refuses a user name or password. Every probe above is a test. `isAllowedHref` is gone. |
| MINOR 5 | Comment corrected; an https autolink is kept with its address as its text. Tested. |
| MINOR 6 | A fence may carry any info string; the first word is the language if it matches the allowed characters, and a backtick fence's info string may not hold a backtick. Tested. |
