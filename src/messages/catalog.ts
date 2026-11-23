// The public catalog: the home page, the course list and the course page
// (docs/spec/03-experience.md sections 5.1 to 5.3). Every number shown comes
// from the published content.

/** "1 lesson", "12 lessons". */
function lessons(count: number): string {
  return count === 1 ? "1 lesson" : `${String(count)} lessons`;
}

export const catalogCommon = {
  coursesLink: "Courses",
  errorLabel: "Error",
  lessonCount: lessons,
} as const;

export const home = {
  /** The whole title, without the product name after it: it already names it. */
  title: "Heap Academy: Python lessons in your browser",
  description:
    "Short Python lessons that you read, write, and run in your browser, with the test cases in plain view.",
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
  loadFailed: "The courses could not be loaded. Reload the page to try again.",
} as const;

export const coursePage = {
  loadFailedTitle: "This course could not be loaded",
  loadFailedBody:
    "Something failed on our side while we read this course. Reload the page to try again.",
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
} as const;
