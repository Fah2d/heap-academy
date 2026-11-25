# WP-4.1 design review 1 (condensed)

Reviewer: design-reviewer, of a039c64, from source only. Verdict: CHANGES REQUIRED. antislop active: during.

- BLOCKER 1: no screenshots at 1280 px (no browser here). Run `e2e/admin-gallery.spec.ts` and `e2e/course-structure-journey.spec.ts` and review again.
- BLOCKER 2: no Delivery Gate report; R-35 needs a click-through of every control.
- MAJOR 3 (R-32, C-4): focus is lost: Rename removes itself and the form takes no focus; Cancel and Save chapter remove themselves; a status button disappears after its move; buttons disabled while pending may drop focus. Focus the rename field and return to Rename, focus the status line after a change, use `isPending` instead of `isDisabled` for in-flight actions, refocus the title after Add chapter; test `document.activeElement`.
- MAJOR 4 (FR-ADM-10): typed chapter text is lost without a warning; the chapter form does not use the leave warning.
- MAJOR 5: states never photographed: the confirm dialogs, the delete dialog, rename, pending, saved, a published course's status panel, the editor's load failure, slug taken.
- MINOR 6: the gallery squeezes the list and editor into `max-w-prose`.
- MINOR 7 (RHYTHM 1): the chapter cards are not on the prose measure; lesson title and status sit 1100 px apart.
- MINOR 8: chapters and lessons show no number; DESIGN.md section 2 puts structural labels in Plex Mono.
- MINOR 9: New course, the page's one action, is a text link.
- MINOR 10: in-app links use `window.confirm` (OK and Cancel) for unsaved changes.
- MINOR 11: messages: `invalid_input` points at marked fields that are not marked; `slug_taken` is not the Address field's error; `stale` does not say reloading drops the typed text; "Only you can see it" is wrong with two admins; "will be removed" has no actor; "This item" is vague.
- MINOR 12: two fields named "Chapter title" during a rename.
- MINOR 13: the outcomes hint is not tied to its fields.
- MINOR 14: an empty `role="status"` paragraph doubles the gap.
- Passed to code review: add and reorder lessons are absent (which package owns them); `reorder_courses` bumps `updated_at` on every course, so an editor open in another tab becomes stale.
