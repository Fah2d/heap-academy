// The public catalog: the home page, the course list and the course page
// (docs/spec/03-experience.md sections 5.1 to 5.3). Every number shown comes
// from the published content. A read that fails ends on the shared error page
// (`errorPage` in system.ts).

import { shell } from "./shell";

/** "1 lesson", "12 lessons". */
function lessons(count: number): string {
  return count === 1 ? "1 lesson" : `${String(count)} lessons`;
}

export const catalogCommon = {
  coursesLink: "Courses",
  lessonCount: lessons,
  /** "0 of 1 lesson completed", "3 of 12 lessons completed" (FR-CAT-02). */
  progress: (completed: number, total: number) =>
    `${String(completed)} of ${lessons(total)} completed`,
  /** The course's one action, by where the learner stands (FR-CAT-02). */
  action: {
    begin: "Begin the course",
    continue: "Continue the course",
    review: "Review the course",
  },
} as const;

export const home = {
  /** The whole title, without the product name after it: it already names it. */
  title: "Heap Academy: Python lessons in your browser",
  /** The site's default description: the home page says what the whole site is. */
  description: shell.description,
  heading: "Heap Academy has short Python lessons that you read, write, and run in your browser.",
  coursesHeading: "Courses",
  howHeading: "How a lesson works",
  how: "Each lesson starts with a short explanation. Then you write a small Python program in the editor and press Run to see what it prints. When it looks right, press Check. Every test case shows what goes in, what should come out, and what your program printed. You do not need to install anything: your code runs in your browser.",
} as const;

export const courseList = {
  title: "Courses",
  description: "Every Python course on Heap Academy, with the number of lessons in each.",
  heading: "Courses",
  empty: "There are no courses yet. The first course appears here as soon as it is published.",
} as const;

export const coursePage = {
  /** For a course with no summary, which the dashboard does not allow today. */
  fallbackDescription: (title: string) => `${title}, a Python course on Heap Academy.`,
  size: (lessonCount: number, chapterCount: number) =>
    chapterCount === 1
      ? `${lessons(lessonCount)} in 1 chapter`
      : `${lessons(lessonCount)} in ${String(chapterCount)} chapters`,
  outcomesHeading: "You will be able to",
  chaptersHeading: "Chapters",
  chapterNumber: (chapter: number) => `Chapter ${String(chapter)}`,
  lessonNumber: (chapter: number, lesson: number) => `${String(chapter)}.${String(lesson)}`,
  chapterLessonsLabel: (title: string) => `Lessons in ${title}`,
  lessonXp: (xp: number) => `${String(xp)} XP`,
  /** A lesson row's state, in words beside its icon (FR-CRS-02). */
  lessonState: { completed: "Completed", next: "Next up", open: "Not started" },
} as const;
