// Where a learner stands in one course (FR-CAT-02, FR-CRS-02). Pure: the
// caller passes the course's published lessons in order and the IDs of the
// lessons the learner completed.
//
// - The action is `begin` with no lesson completed, `review` with every
//   lesson completed, and `continue` otherwise.
// - Its target is the first lesson that is not completed, so `continue` goes
//   to the next incomplete lesson even when an earlier one was skipped; for
//   `begin` that is the first lesson, and `review` goes to the first lesson.
// - That same lesson is the one row marked `next`; every other row is
//   `completed` or `open`. A completed course has no `next` row.

export type CourseAction = "begin" | "continue" | "review";

export type LessonState = "completed" | "next" | "open";

export type CourseStanding<Lesson> = {
  action: CourseAction;
  /** The lesson the action leads to; undefined only for a course with no lesson. */
  target: Lesson | undefined;
  completed: number;
  total: number;
  /** One state per lesson, in the order given. */
  states: LessonState[];
};

export function courseStanding<Lesson extends { id: string }>(
  lessons: readonly Lesson[],
  completedIds: ReadonlySet<string>,
): CourseStanding<Lesson> {
  const done = lessons.map((lesson) => completedIds.has(lesson.id));
  const completed = done.filter(Boolean).length;
  const nextIndex = done.indexOf(false);
  const action: CourseAction = completed === 0 ? "begin" : nextIndex === -1 ? "review" : "continue";
  return {
    action,
    target: nextIndex === -1 ? lessons[0] : lessons[nextIndex],
    completed,
    total: lessons.length,
    states: done.map((isDone, index) =>
      isDone ? "completed" : index === nextIndex ? "next" : "open",
    ),
  };
}
