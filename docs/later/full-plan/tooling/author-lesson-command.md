> Archived. Not in force. This file belongs to the original ten-phase plan and is kept for work after the first release. Do not build from it unless the owner says so. The plan in force is in `docs/spec/`.

---
name: author-lesson
description: Create or revise one lesson with its starter, solution, tests, and wrong answers, following the content system. Use when asked to write, draft, add, or fix a lesson.
argument-hint: "[course] [chapter] [slug] [kind]"
---

Author the lesson described by: **$ARGUMENTS**. Follow `docs/spec/04-content-system.md`. The owner approves publication; you produce a draft that is ready to review.

## 1. Understand the slot

- Read the curriculum entry for this lesson and the earlier lessons in the chapter. List what the learner already knows. The lesson may use only that plus its one new idea.
- State the one new idea in a sentence. If you need two sentences, it is two lessons: stop and say so.
- For a build lesson, confirm it introduces nothing new.

## 2. Scaffold

Run `pnpm content:new <course> <chapter> <slug> --kind <kind>`. Never write an ID by hand and never edit `content/registry.json` directly.

## 3. Write the solution first

Write `solution/` as a beginner at this point in the course would write it. Run it. Keep the real output.

## 4. Write the tests

- Test names read as the task's requirements.
- At least two input and output cases with different data whenever output depends on input, so fixed output cannot pass.
- A `source` test when the lesson is about a construct.
- A hint on every visible test that says where to look, not what to type.
- Mark some cases hidden if showing them would hand over the answer.

## 5. Write the wrong answers

At least one, and more when you can think of real beginner mistakes: fixed output, missing conversion, off-by-one, right output by the wrong construct. Declare which tests must catch each. If you cannot write a test that catches a plausible wrong answer, the task needs redesigning.

## 6. Write the starter

The smallest starting point that removes typing that teaches nothing. It must fail at least one test.

## 7. Write the lesson text

Load `antislop-copywriting`. Sections in order for the lesson kind. Concept at most 150 words before the first runnable example and 300 in total. Paste real output into `:::output` blocks. Three hints: a nudge, the construct, the outline.

Check every sentence against `docs/spec/04-content-system.md` section 8: plain words, terms defined once, no idioms, suitable examples, true claims.

## 8. Check

- `pnpm content:check <path>` and `pnpm content:lint <path>` pass.
- Read the lesson top to bottom as a learner on a phone. Solve it from the text alone.
- Keep `status: draft` and `access: free`.

## 9. Review

Invoke `content-editor` on the lesson. Fix every BLOCKER and MAJOR. Then open a pull request on a `content/<course>-<chapter>` branch and tell the owner where to try it on the preview.
