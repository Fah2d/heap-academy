import { adminGallery as m } from "@/messages/gallery";

// The development gallery's states (src/app/dev/admin/page.dev.tsx), each
// drawn alone at `/dev/admin?state=<state>` so that one page holds one view's
// landmarks, as a real admin page does. e2e/admin-gallery.spec.ts opens each.

export const ADMIN_STATE_PATH = "/dev/admin";

export const ADMIN_STATES = [
  { state: "empty", title: m.courseListEmpty },
  { state: "failed", title: m.courseListFailed },
  { state: "rows", title: m.courseListRows },
  { state: "editor-refusing", title: m.editorRefusing },
  { state: "editor-empty", title: m.editorEmpty },
  { state: "editor-published", title: m.editorPublished },
  { state: "editor-saving", title: m.editorSaving },
  { state: "editor-failed", title: m.editorFailed },
  { state: "new-course", title: m.newCourse },
  { state: "new-course-taken", title: m.newCourseTaken },
  { state: "setup", title: m.setupFailed },
  { state: "limited", title: m.codeLimited },
  { state: "checking", title: m.codeChecking },
  { state: "lesson-editor", title: m.lessonEditor },
  { state: "lesson-refusing", title: m.lessonRefusing },
  { state: "lesson-published", title: m.lessonPublished },
  { state: "lesson-archived", title: m.lessonArchived },
  { state: "lesson-full", title: m.lessonFull },
  { state: "lesson-taken", title: m.lessonTaken },
  { state: "lesson-too-long", title: m.lessonTooLong },
  { state: "lesson-tests-full", title: m.lessonTestCasesFull },
  { state: "lesson-test-problem", title: m.lessonTestCaseProblem },
  { state: "lesson-content", title: m.lessonContent },
  { state: "lesson-empty", title: m.lessonEmpty },
  { state: "lesson-python-loading", title: m.lessonPythonLoading },
  { state: "lesson-python-failed", title: m.lessonPythonFailed },
  { state: "lesson-validating", title: m.lessonValidating },
  { state: "lesson-python-cannot-run", title: m.lessonPythonCannotRun },
  { state: "lesson-save-validating", title: m.lessonSaveValidating },
  { state: "lesson-save-python-failed", title: m.lessonSavePythonFailed },
  { state: "lesson-save-python-cannot-run", title: m.lessonSavePythonCannotRun },
  { state: "lesson-save-rule-failed", title: m.lessonSaveRuleFailed },
  { state: "lesson-odd-results", title: m.lessonOddResults },
  { state: "lesson-validation-failed", title: m.lessonValidationFailed },
] as const;

export type AdminState = (typeof ADMIN_STATES)[number]["state"];
