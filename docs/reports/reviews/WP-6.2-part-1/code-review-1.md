# Review of three part-1 work packages

- Reviewer: code-reviewer subagent, fresh context, read-only
- Ranges:
  - `main..75b0bb5` on `wp/6.1-merge-part-1`
  - `main..f82bc85` on `wp/6.2-streak-part-1`
  - `main..d7a5f36` on `wp/4.2-markdown-part-1`
- Date: 2026-11-20
- Verdict: CHANGES REQUIRED on all three.
  - WP-6.1: no blocker, two majors, three minors.
  - WP-6.2: no blocker, three majors, three minors.
  - WP-4.2: one blocker, four majors, six minors.

The 4.2 branch moved during the review. A new commit, b5bb9e1 ("bound the Markdown tree and normalize link addresses"), landed at 11:23. The reviewer reviewed d7a5f36 as asked, then re-ran its checks on b5bb9e1. A status table is at the end of the 4.2 section. b5bb9e1 was not reviewed in full.

---

## 1. `wp/6.1-merge-part-1` (75b0bb5): WP-6.1 part 1, the merge

Verdict: CHANGES REQUIRED.

**MAJOR 1** `src/domain/progress.ts:70-75`: `applyAccount` sends a completion that was already stored on one account to the next account that signs in on the same device.
- What happens: a device entry with `synced: true` for a lesson the account does not have is turned back into `synced: false`. `unsynced` then sends it.
- On a shared browser, learner A's completion and A's code go to learner B. The code is personal data (`06-security-privacy.md` section 7.1).
- Probe: device `[{…, code: "learner A's code", synced: true}]`, account `[]`. `applyAccount` gives `synced: false`, and `unsynced` returns A's entry.
- The test at `progress.test.ts:129-140` treats this as intended: every device entry whose lesson is missing from the account must be pending.
- The spec says nothing about device progress on sign-out (FR-AUTH-05 only ends the session).
- Fix: an entry that is already synced and missing from the account's list must never be sent again. Either drop it, or keep it synced and leave it out of `unsynced`. Then decide in the spec whether device progress is cleared, or kept per account, at sign-out. Add a test for the shared-device case.

**MAJOR 2** `src/domain/progress.ts:9-19, 34-37, 66-76`: there are two different rules for which completion wins the same conflict.
- `mergeCompletions` keeps the earliest completion. `applyAccount` keeps the account's, and so does the database ("do nothing on conflict", architecture section 10).
- The function tested for commutativity is not the one that decides what the learner ends up with.
- Probe for one lesson, guest at 100 and account at 500:
  - `mergeCompletions` gives `completedAt: 100, code: "guest"`;
  - `applyAccount` gives `completedAt: 500, code: "account", synced: true`.
- If part 2 ever shows `mergeCompletions(device, account)` before the server answers, the shown time (and so the streak day) and the code change after sync.
- Section 10 asks for commutativity, which the authority's rule cannot have, because an insert-only table with "do nothing on conflict" keeps the first row inserted.
- Fix (owner decision): state that `mergeCompletions` only removes duplicates within one source and is never used across device and account, or remove it. Make `applyAccount` the merge of FR-PRG-03, and propose a `spec-change` so section 10 says what commutativity covers (the set of lessons).

**MINOR 1** `src/domain/progress.ts:34-37`: a `NaN` time breaks commutativity.
- Probe: `mergeCompletions([NaN, "x"], [100, "y"])` keeps `NaN`; the reverse order keeps `100`.
- No schema for `Completion` exists yet, so the claim in the header ("idempotent, commutative and associative") holds only for finite times.
- Fix: parse completions at the boundary in part 2 and reject times that are not finite. Until then, state the precondition in the type's comment and add a test.

**MINOR 2** `src/domain/progress.ts:75`: no test notices if the final `.sort(byLesson)` is removed. With it removed, 13 of 13 tests still pass.
- Fix: assert lesson order in the `applyAccount` property test, as `mergeCompletions` does at line 99.

**MINOR 3** `src/domain/ids.test.ts:5`: the title cites `[FR-PRG-07]`, but the test checks only the UUID format. FR-PRG-07 is about completions surviving edits, renames and archiving, which the test does not verify (`.claude/rules/testing.md`: a title cites the IDs it verifies).
- Fix: remove the ID, or test the property FR-PRG-07 names when part 2 can.

Checks: format, lint and types clean. `Test Files 10 passed (10)`, `Tests 395 passed (395)`. `src/domain` coverage: 100 % lines, 92.85 % branches. Line 40 (equal lesson IDs) is never reached, because map keys are unique. The module is pure: no clock, no I/O.

---

## 2. `wp/6.2-streak-part-1` (f82bc85): WP-6.2 part 1, streak and XP

Verdict: CHANGES REQUIRED.

**MAJOR 1** `src/domain/streak.test.ts:43-133`: the property tests never put a completion near local midnight, so FR-PRG-05's "property tests cover day boundaries" is not met.
- `nearNoon` keeps every generated instant between 10:00 and 16:00 local time. Only four example tests touch midnight: New York at 23:59/00:01 twice, and Kolkata.
- Mutant probe: the reviewer replaced the day calculation in `streak` with offset arithmetic, using the zone's offset at `now` (the bug section 14 warns about). It passes 12 of 12 tests.
- On a concrete case the mutant is wrong:
  - completions at 23:30 EST on 7 March 2026 and at noon EDT on 9 March, `now` on 9 March;
  - the original gives `{"current":1,"longest":1}`;
  - the mutant gives `{"current":2,"longest":2}`.
- Fix: generate instants at any minute, weighted toward ±90 minutes of local midnight and toward transition dates. Assert, independently of the code under test:
  - `localDay` never decreases from one minute to the next (except in zones whose clocks fall back across midnight);
  - when it increases, the local time is 00:00, or the first minute after a skipped midnight.
  - Run the streak model on days taken from those instants.

**MAJOR 2** `src/domain/streak.ts:75`: a completion later than `now` is dropped, but the database moves such a time back to now (architecture section 8.3: the trigger "clamps `completed_at` so it is never in the future").
- With a device clock a few seconds behind the server, the completion the server just stored is in the device's future and does not count.
- Probe: `streak([now - 1 day, now + 3 s], now, New York)` gives `{"current":1,"longest":1}`. Treating the future time as now gives 2.
- This also works against the "Done when" line: "a guest and an account with the same history show the same numbers".
- Fix: use `Math.min(instant, now)` to match the trigger, and change the test at line 182.

**MAJOR 3** `src/domain/streak.ts:34-42`: `parseTimeZone` accepts zones that are not IANA names, and returns names that are not in canonical form.
- Node 26.13.1 accepts:
  - fixed offsets `"+03:00"`, `"+0530"` and `"-11"`;
  - wrong-case names `"europe/london"` and `"EUROPE/LONDON"`;
  - `"EST5EDT"` and `"Etc/GMT+3"`.
- `parseTimeZone` returns these strings unchanged.
- Section 14 requires an IANA zone. A profile time zone of `"+03:00"` never has daylight saving, and two spellings of one zone would be stored as different values.
- This function will very likely validate `updateProfile`.
- Fix: reject values that start with `+` or `-`, return `resolvedOptions().timeZone` (`"europe/london"` becomes `Europe/London`), and test each value above.

**MINOR 1** `src/domain/streak.ts:15-31`: the formatter cache is a module-level map keyed by the caller's raw string. Each wrong-case spelling of a valid zone adds an entry, so on a long-running server the map can grow without limit from user input.
- Fix: key it by the canonical name from MAJOR 3.

**MINOR 2** `src/domain/streak.ts:75`: no test notices if `Number.isFinite` is removed.
- `NaN` and `+Infinity` already fail `instant <= now`. Without the check, 12 of 12 tests still pass.
- `-Infinity` and `-1e16` pass the filter, and then `localDay` throws `RangeError: Invalid time value`. The probe shows this for `-1e16` even with the check in place.
- Fix: also keep only times within the `Date` range (±8.64e15), and test `-Infinity` and `-1e16`.

**MINOR 3** `src/domain/streak.test.ts:93`: the comment says Lord Howe's half-hour shift is tested, but there is no Lord Howe assertion at a boundary. Lord Howe appears only in the noon-based properties, where a half-hour shift cannot reach midnight.
- Fix: add the case, or correct the comment.

Checks: format, lint and types clean. `Tests 394 passed (394)`. `src/domain` coverage: 100 % lines and branches. Pure: the clock and the zone are parameters.

Note for the owner: `totalXp` takes `{ xp }`, but the device's `Completion` in 6.1 has no `xp`. Where a guest's XP comes from is not decided yet. If it comes from the lesson's current XP, a guest and an account can differ after the owner edits a lesson's XP.

---

## 3. `wp/4.2-markdown-part-1` (d7a5f36): WP-4.2 part 1, the Markdown parser

Verdict: CHANGES REQUIRED.

The security model is sound. Nodes are text only, links are https only, and the language name is limited to a safe set of characters. All 27 malicious fixtures come out inert. The findings are about time and about correctness.

**BLOCKER 1** `src/content/markdown/parse.ts:45`: `HEADING` backtracks catastrophically on a heading line with mixed spaces and tabs.
- Input `"## a" + " \t" × n/2 + "x"`, run in a child process with a 20 s limit (n is the number of whitespace characters):

| n | time |
|---|---|
| 1,000 | 275.8 ms |
| 2,000 | 1,852.6 ms |
| 4,000 | 12,805.0 ms |
| 8,000 | killed after 20 s |

- A 20,000-character probe ran for more than 3 minutes and had not finished.
- `#### a` + the same whitespace: 1,840 ms at 2,000.
- The input is within the lesson limit. It runs on the server for every learner view, and in the dashboard preview. T-06 says the protections apply to the owner's own input too. No test covers it.
- Fix: no quantifiers that can match the same characters next to each other. Match `^ {0,3}(#{1,6})(?:[ \t](.*))?$` and strip a closing `#` run in code (b5bb9e1 does this). Add a test that fails on the old regex.

**MAJOR 1** `parse.ts:44, 73`: a fence whose info string has a second word is not a fence. Its closing fence then opens an unclosed fence that swallows the rest of the lesson.
- Probe: `` "```python title\nprint(1)\n```" `` gives a paragraph `"```python title\nprint(1)"`, then an empty `code_block` that runs to the end.
- Fix: accept any info string and take its first word as the language.

**MAJOR 2** `parse.ts:50, 115, 165, 193-195`: a line that starts with a tag drops its whole paragraph, up to the next blank line.
- Probes:
  - `"Type your name.\n<name> is what you typed.\nThis line is lost too.\n\nNext paragraph."`: the two middle lines disappear;
  - `"<kbd>Enter</kbd> runs the code, and this is lost."` gives `[]`.
- In CommonMark, a block that starts with an ordinary tag must hold only the tag on its line, and cannot interrupt a paragraph.
- The owner's text is lost without warning, in the preview and in the learner view.
- Fix: drop a whole block only for comments and the elements in `DROPPED_WITH_CONTENT`, or for a line that is only a tag. Otherwise parse a paragraph and drop the inline tag. Add both probes as tests.

**MAJOR 3** `parse.ts:491-497`: the second star of a `**` run is accepted as a closer, because the "doubled" check looks only forward.
- Probes:
  - `"Use *args and **kwargs in a call."` gives emphasis `"args and *"` + `"kwargs…"`;
  - `"*a **b** c*"` gives emphasis `"a *"`, `"b"`, emphasis `"* c"`.
- `*args`, `**kwargs` and `**` (power) are ordinary Python prose.
- Fix: treat a run of markers as one unit and check what comes before it and after it, as CommonMark does. Add both probes as tests.

**MAJOR 4** The parser renders the spec's own example lesson wrongly (`docs/spec/04-content-system.md` section 7).
- The example shows its code as an indented block (four spaces). The parser turns it into one paragraph, `"name = input(\"What is your name? \")\nprint(\"Hello, \" + name + \"!\")"`.
- Section 5 allows only fenced blocks, so the spec contradicts itself.
- Fix (owner decision): change the example to a fence through a `spec-change` PR (recommended), or support indented code.

**MINOR 1** `parse.ts:432-502`: searching for an emphasis closer takes time that grows with the square of the input length.
- 20,000 characters of `"*a "` take 430 ms; `"*a\n"` takes 454 ms.
- `FENCE` and `TABLE_DELIMITER` behave the same way with mixed spaces and tabs: about 150 ms at 19,980.

**MINOR 2** `parse.ts:45`: `"## Python and C#"` becomes the heading "Python and C". A closing `#` run must follow a space.

**MINOR 3** `parse.ts:387-388`: the comment says an autolink is dropped, but the code keeps an https autolink (probe: `<https://docs.python.org>` becomes a link). No test covers either behavior. Also, a link's text can contain an autolink, which would put an `<a>` inside an `<a>`.

**MINOR 4** Four mutants survive the tests: with each change, 43 of 43 tests still pass.
- The depth limit on lists is removed (line 246).
- The depth limit on inline nesting is removed (lines 438-441 and 450-453). The test at line 313 only checks `toHaveLength(1)`.
- The inline comment branch is removed (lines 382-386). The fixture `before <!-- … --> after` still passes, because `"<!--"` text is not caught by `/<\/?[A-Za-z]/`.
- The block comment branch is removed (lines 188-192).
- Fix:
  - assert the nesting depth for lists and for strong emphasis;
  - assert the exact visible text of the comment fixture (`"before  after"`);
  - add a multi-line comment followed by text on the next line.

**MINOR 5** Some CommonMark behavior differs, and an author will see it (probes):
- `"In the year\n2024. we started."` becomes a list starting at 2024. In CommonMark, only a list starting at 1 can interrupt a paragraph.
- A table directly after a paragraph line stays text.
- `&lt;` and `&amp;` are shown literally.
- `\=` and `\"` are not treated as escapes.
- A lazy line after a fenced block in a list item joins the code.
- Content indented with tabs inside a list item is not recognized.
- A block quote does not continue onto a lazy line.
- Fix: implement these, or list the supported subset in the field help and in section 5.

**MINOR 6** `parse.ts:59`: the 20,000 limit counts UTF-16 code units, while the database's "1 to 20,000 characters" (section 1.3) counts code points.
- 15,000 emoji are 15,000 code points but 30,000 code units, so the end of a valid lesson is cut without warning. The cut can also split a surrogate pair.
- Fix: count code points, or remove the silent cut and rely on the schema's refusal.

### Status at b5bb9e1 (the reviewer's probes on that commit; not a full review)

| d7a5f36 finding | At b5bb9e1 |
|---|---|
| BLOCKER 1 heading backtracking | Fixed: n = 8,000 takes 1.0 ms. No test would fail if it came back. |
| MAJOR 1 fence info string | Fixed: gives `code_block` with `language: "python"`. |
| MAJOR 2 a line that starts with a tag | Still present: same output. |
| MAJOR 3 `*args and **kwargs` | Still present: same output. |
| MAJOR 4 indented code in the spec example | Still present. |
| MINOR 1 time growing with the square of the input | Fixed: 1.8 ms; fence 0.2 ms. |
| MINOR 2 `C#` | Fixed. |
| MINOR 3 autolink comment, link inside link | Comment corrected; `inLink` added. Tests for these not checked. |
| MINOR 4 mutants | Not re-run. |
| MINOR 5, MINOR 6 | Still present. |

At b5bb9e1: types and lint clean, `Tests 62 passed (62)` in `src/content`.

Note for the owner: the choice between a hand-written parser and a library has not been made. Every deviation above comes from that choice.

---

## Attribution and checks intact (all four commits)

- `git log --format=fuller` on each range: every author and committer is the owner's GitHub no-reply address.
- No message or added line matches claude, anthropic, co-authored or generated with. The one hit is a comment in `progress.ts` that says "CLAUDE.md rule 8", which refers to the rules file and credits no one.
- No skip, `.only`, suppression, TODO, raised timeout or lowered threshold.
- `scripts/testing/property.ts` is identical to `wp/3.3-grader` on all three branches.

## What the reviewer ran

- Each commit was exported with `git archive` into the scratchpad, with `node_modules` linked. No branch was switched and no repository file was touched.
- In each export: `prettier --check .`, `eslint --max-warnings=0 .`, `tsc --noEmit`, `vitest run --coverage`. Results:
  - 6.1: 395 tests pass;
  - 6.2: 394 tests pass;
  - 4.2 at d7a5f36: 425 tests pass;
  - format, lint and types clean on all three.
- Mutants, applied to copies in the scratchpad:
  - 6.1: sort removed; `<=` changed to `<` (no effect on results, so not a finding); device's sync flag kept (caught);
  - 6.2: offset arithmetic; `isFinite` removed;
  - 4.2: four depth and comment mutants.
- Node probes: time zones, merge with `NaN`, `applyAccount` across accounts, parser behavior, and parser timing at 20,000 characters, at d7a5f36 and at b5bb9e1.

## Not checked

- `pnpm verify` as one command, and `pnpm attribution`. The other steps were run one by one instead.
- Rendering, highlighting and the copy control (part 2). No browser.
- b5bb9e1 beyond the probes and its content tests.
- Whether Postgres's `char_length` is the size check the migrations will use (they do not exist yet).

## For the owner

- A process the reviewer started may still be running: a `node` process for `md-time.mts`, from a timing probe that hung on BLOCKER 1. The sandbox cannot stop it. Run `pkill -f md-time.mts` in your own terminal.

## Response for WP-6.2 part 1 (implementer, 8fd2382)

Each fix started from a test that failed before the change (5 failed, then 16 passed).

| Finding | Change |
|---|---|
| MAJOR 1 | Two new tests. (1) A property places completions and `now` within 14 hours of a UTC midnight, so near local midnight in every zone from UTC-11 to UTC+14, and compares `streak` with the model on days from an independent oracle: the platform's `en-CA` date string for the zone. (2) Every 2026 offset change of the nine zones is found hour by hour. Each is then swept in 5-minute steps from 26 hours before to 26 hours after. The local day must move by 0 or 1 per step, move only at local midnight or across a change that skips it, and equal the oracle. Lord Howe's half-hour shifts and Santiago's change at midnight are among the swept changes; each of the five zones with daylight saving has exactly two in 2026. The reviewer's mutant (offset arithmetic at `now`) now fails a test. |
| MAJOR 2 | A completion later than `now` counts as made at `now`, matching the trigger. `streak([now - 1 day, now + 3 s], now, New York)` gives 2, and is a test. |
| MAJOR 3 | `parseTimeZone` refuses a value that does not start with a letter (`+03:00`, `+0530`, `-11`) and returns `resolvedOptions().timeZone`, so `europe/london` and `EUROPE/LONDON` give `Europe/London`. All are tests. `EST5EDT` and `Etc/GMT+3` are still accepted: both are names in the IANA database. |
| MINOR 1 | The formatter cache is keyed by `TimeZone`, the canonical name, so it holds at most one entry per zone. |
| MINOR 2 | Only times within the `Date` range (±8.64e15) are counted. `NaN`, both infinities, `-1e16` and `1e16` are tests. |
| MINOR 3 | The comment is corrected; the sweep covers Lord Howe's changes. |

Five mutants each fail at least one test: offset arithmetic at `now`; dropping future times again; removing the range check; returning the zone as written; accepting offsets.

On the note about XP: the device's `Completion` has no `xp`, and where a guest's XP comes from is not decided. It is raised in the pull request.
