> Archived. Not in force. This file belongs to the original ten-phase plan and is kept for work after the first release. Do not build from it unless the owner says so. The plan in force is in `docs/spec/`.

---
paths:
  - "content/**"
---

# Lesson content

Full text: `docs/spec/04-content-system.md`. Use `/author-lesson` to create a lesson.

- Never edit, reuse, or remove an ID. `content/registry.json` is append-only.
- Changing a slug requires adding the old one to `previous_slugs`.
- Raise `content_version` when a change could make previously passing code fail.
- Every lesson has a solution that passes, a starter that fails, and at least one wrong answer with the tests that must catch it. Run `pnpm content:check` and `pnpm content:lint` before committing.
- Until Phase 7 ships, `access` must be `free`.
- New lessons start as `status: draft`. Only the owner's approval changes a lesson to `published`.

Teaching:

- One new idea per lesson. Concept is at most 150 words before the first code sample and 300 in total.
- Show runnable code before asking for any.
- The task makes a small real thing. Test names read as the task's requirements.
- Hints go from a nudge, to the construct, to the outline. Never the answer.
- A build lesson introduces nothing new.

Writing:

- Load `antislop-copywriting`. Short sentences for a reader with English as a second language. Define each term once and keep using it. No idioms. No em dashes.
- Output shown in a lesson is the real output of the code shown. Run it.
- Every factual claim is true and checkable, or it is removed.
- Examples suit young learners in the Gulf: no gambling, alcohol, or dating themes; no real brands or public figures.
- Python: PEP 8, four spaces, double quotes. HTML and CSS: lowercase, two spaces, double-quoted attributes.
- Images come from the lesson's `assets/` folder and have alt text. Do not generate brand or mascot images.
