// What the admin views need to know about the admin actions' answers. Kept
// outside server/, so client views can import it.

export type SecondStepFailure = "code_rejected" | "rate_limited" | "setup_replaced" | "unavailable";

/** An action's answer as the view reads it: its value, or a failure code. */
export type ActionOutcome<Value> = { ok: true; value: Value } | { ok: false; error: string };

/** A server action as a client view calls it. */
export type AdminAction<Input, Value> = (input: Input) => Promise<ActionOutcome<Value>>;

export type MoveDirection = "up" | "down";

export type ReorderInput =
  | { kind: "course"; id: string; direction: MoveDirection }
  | { kind: "chapter"; courseId: string; id: string; direction: MoveDirection };

export type CourseStatus = "draft" | "published" | "archived";

/** A row of the dashboard's course list (docs/spec/03-experience.md section 7.2). */
export type AdminCourse = {
  id: string;
  slug: string;
  title: string;
  status: CourseStatus;
  publishedLessons: number;
  draftLessons: number;
};

export type AdminCourses = { ok: true; courses: AdminCourse[] } | { ok: false };

export type EditorLesson = { id: string; title: string; status: CourseStatus };
export type EditorChapter = {
  id: string;
  title: string;
  summary: string;
  /** The chapter's version: a rename names it, and is refused if the chapter is newer (FR-ADM-10). */
  loadedAt: string;
  lessons: EditorLesson[];
};

/** One course as its editor shows it (docs/spec/03-experience.md section 7.3). */
export type EditorCourse = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  outcomes: string[];
  status: CourseStatus;
  /** The row's version: a save names it, and is refused if the row is newer (FR-ADM-10). */
  loadedAt: string;
  chapters: EditorChapter[];
};

export type EditorCourseResult = { ok: true; course: EditorCourse | null } | { ok: false };
