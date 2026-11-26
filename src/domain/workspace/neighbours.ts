// The lessons before and after one lesson in its course's order, across
// chapters (FR-WSP-11). The workspace disables previous and next at the ends
// of a course rather than hiding them.

export type LessonLink = { slug: string; title: string };

export type Neighbours = { previous: LessonLink | null; next: LessonLink | null };

/** The neighbours of `slug`, or undefined when the course has no such lesson. */
export function lessonNeighbours(
  chapters: readonly { lessons: readonly LessonLink[] }[],
  slug: string,
): Neighbours | undefined {
  const lessons = chapters.flatMap((chapter) => chapter.lessons);
  const index = lessons.findIndex((lesson) => lesson.slug === slug);
  if (index === -1) return undefined;
  const link = (at: number): LessonLink | null => {
    const lesson = lessons[at];
    return lesson === undefined ? null : { slug: lesson.slug, title: lesson.title };
  };
  return { previous: link(index - 1), next: link(index + 1) };
}
