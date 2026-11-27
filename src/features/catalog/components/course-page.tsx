import { notFound } from "next/navigation";
import type { PublishedCourse } from "@/content";
import { coursePage as words } from "@/messages/catalog";
import { Link } from "@/ui";
import { catalogCourse } from "../server/reads";
import { lessonPath } from "../paths";
import { CatalogPage } from "./catalog-page";
import {
  CourseAction,
  CourseCount,
  CourseProgress,
  LessonMark,
  LessonRow,
} from "./course-progress";

/**
 * `/courses/[course]` (docs/spec/03-experience.md section 5.3; FR-CRS-01):
 * the course's summary, its outcomes when the owner wrote them, the action
 * that begins, continues or reviews it (FR-CAT-02), and every chapter in
 * order with its lessons, each with its XP and state (FR-CRS-02). A course
 * that is not published, or has no published lesson, is not found (FR-CAT-04).
 */
export async function CoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course: slug } = await params;
  const course = await catalogCourse(slug);
  if (course === null) notFound();
  return <CourseView course={course} />;
}

export function CourseView({ course }: { course: PublishedCourse }) {
  const lessons = course.chapters.flatMap((chapter) => chapter.lessons);
  const outcomes = course.outcomes.filter((outcome) => outcome.trim() !== "");
  // Where each chapter's first lesson sits in the whole course: a lesson's
  // mark is looked up by its place in the course.
  const firstPlace = course.chapters.map((_, chapterIndex) =>
    course.chapters
      .slice(0, chapterIndex)
      .reduce((sum, chapter) => sum + chapter.lessons.length, 0),
  );
  return (
    <CatalogPage>
      <CourseProgress lessons={lessons}>
        <header className="flex max-inline-prose flex-col items-start gap-3">
          <h1 className="text-xl font-semibold text-balance text-text">{course.title}</h1>
          <p className="text-prose text-text">{course.summary}</p>
          <p className="text-xs text-text-muted tabular-nums">
            {words.size(lessons.length, course.chapters.length)}
          </p>
          <CourseCount />
          <CourseAction course={course.slug} />
        </header>
        {outcomes.length > 0 && (
          <section
            aria-labelledby="course-outcomes"
            className="flex max-inline-prose flex-col gap-4"
          >
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
          <ol aria-labelledby="course-chapters" className="flex flex-col gap-4">
            {course.chapters.map((chapter, chapterIndex) => {
              const headingId = `chapter-${chapter.id}`;
              return (
                <li
                  key={chapter.id}
                  className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-5"
                >
                  <h3
                    id={headingId}
                    className="flex flex-col gap-1 text-base font-semibold text-text"
                  >
                    <span className="font-mono text-sm font-normal text-text-muted">
                      {words.chapterNumber(chapterIndex + 1)}
                    </span>{" "}
                    <span>{chapter.title}</span>
                  </h3>
                  {chapter.summary !== "" && (
                    <p className="max-inline-prose text-base text-text-muted">{chapter.summary}</p>
                  )}
                  <ol
                    aria-label={words.chapterLessonsLabel(chapter.title)}
                    className="flex flex-col"
                  >
                    {chapter.lessons.map((lesson, lessonIndex) => {
                      const index = (firstPlace[chapterIndex] ?? 0) + lessonIndex;
                      return (
                        <LessonRow key={lesson.slug} index={index}>
                          <span className="shrink-0 font-mono text-sm text-text-muted tabular-nums">
                            {words.lessonNumber(chapterIndex + 1, lessonIndex + 1)}
                          </span>{" "}
                          <span className="min-w-0 grow basis-1/2 break-words">
                            <Link href={lessonPath(course.slug, lesson.slug)} variant="standalone">
                              {lesson.title}
                            </Link>
                          </span>{" "}
                          <span className="ms-auto flex shrink-0 items-center gap-4">
                            <span className="text-sm text-text-muted tabular-nums">
                              {words.lessonXp(lesson.xp)}
                            </span>
                            <LessonMark index={index} />
                          </span>
                        </LessonRow>
                      );
                    })}
                  </ol>
                </li>
              );
            })}
          </ol>
        </section>
      </CourseProgress>
    </CatalogPage>
  );
}
