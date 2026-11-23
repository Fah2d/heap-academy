import { notFound } from "next/navigation";
import type { PublishedCourse } from "@/content";
import { coursePage as words } from "@/messages/catalog";
import { catalogCourse } from "../server/reads";
import { CatalogPage } from "./catalog-page";

/**
 * `/courses/[course]` (docs/spec/03-experience.md section 5.3; FR-CRS-01):
 * the course's summary, its outcomes when the owner wrote them, and every
 * chapter in order with its lessons. A course that is not published, or has
 * no published lesson, is not found (FR-CAT-04).
 */
export async function CoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course: slug } = await params;
  const result = await catalogCourse(slug);
  if (!result.ok) return <CourseLoadFailed />;
  if (result.value === null) notFound();
  return <CourseView course={result.value} />;
}

/** The course page when its read failed: no title to show, so its own heading. */
export function CourseLoadFailed() {
  return (
    <CatalogPage>
      <section className="flex max-w-prose flex-col gap-4">
        <h1 className="text-xl font-semibold text-balance text-text">{words.loadFailedTitle}</h1>
        <p className="text-base text-text-muted">{words.loadFailedBody}</p>
      </section>
    </CatalogPage>
  );
}

// Lessons are not links yet: the lesson page arrives with the workspace
// (WP-5.2), and a link to a page that does not exist is a dead control
// (CLAUDE.md rule 3). The begin or continue action and each lesson's state
// arrive with progress (WP-5.4).
export function CourseView({ course }: { course: PublishedCourse }) {
  const lessonCount = course.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0);
  const outcomes = course.outcomes.filter((outcome) => outcome.trim() !== "");
  return (
    <CatalogPage>
      <header className="flex max-w-prose flex-col gap-3">
        <h1 className="text-xl font-semibold text-balance text-text">{course.title}</h1>
        <p className="text-prose text-text">{course.summary}</p>
        <p className="text-sm text-text-muted tabular-nums">
          {words.size(lessonCount, course.chapters.length)}
        </p>
      </header>
      {outcomes.length > 0 && (
        <section aria-labelledby="course-outcomes" className="flex max-w-prose flex-col gap-3">
          <h2 id="course-outcomes" className="text-lg font-semibold text-text">
            {words.outcomesHeading}
          </h2>
          <ul
            aria-labelledby="course-outcomes"
            className="flex list-disc flex-col gap-1 ps-5 text-base text-text marker:text-text-muted"
          >
            {outcomes.map((outcome, index) => (
              <li key={index}>{outcome}</li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="course-chapters" className="flex flex-col gap-4">
        <h2 id="course-chapters" className="text-lg font-semibold text-text">
          {words.chaptersHeading}
        </h2>
        <ol className="flex flex-col gap-4">
          {course.chapters.map((chapter, chapterIndex) => {
            const headingId = `chapter-${chapter.id}`;
            return (
              <li
                key={chapter.id}
                className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-5"
              >
                <h3 id={headingId} className="flex flex-col gap-1 text-lg font-semibold text-text">
                  <span className="font-mono text-sm font-normal text-text-muted">
                    {words.chapterNumber(chapterIndex + 1)}
                  </span>{" "}
                  <span>{chapter.title}</span>
                </h3>
                {chapter.summary !== "" && (
                  <p className="max-w-prose text-base text-text-muted">{chapter.summary}</p>
                )}
                <ol aria-label={words.chapterLessonsLabel(chapter.title)} className="flex flex-col">
                  {chapter.lessons.map((lesson, lessonIndex) => (
                    <li
                      key={lesson.slug}
                      className="flex items-baseline gap-3 border-bs border-border py-2 text-base text-text"
                    >
                      <span className="shrink-0 font-mono text-sm text-text-muted tabular-nums">
                        {words.lessonNumber(chapterIndex + 1, lessonIndex + 1)}
                      </span>{" "}
                      <span className="min-w-0 break-words">{lesson.title}</span>
                    </li>
                  ))}
                </ol>
              </li>
            );
          })}
        </ol>
      </section>
    </CatalogPage>
  );
}
