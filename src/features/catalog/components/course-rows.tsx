import type { PublishedCourseSummary } from "@/content";
import { courseList } from "@/messages/catalog";
import { Link } from "@/ui";
import { coursePath } from "../paths";
import { CourseRowProgress } from "./course-progress";

export type CourseRowsProps = {
  courses: PublishedCourseSummary[];
  /** The id of the heading that names the list. */
  labelledBy: string;
  /** The level of each course title: below the heading that names the list. */
  titleLevel: 2 | 3;
};

/**
 * The published courses as wide rows: title linking into the course, summary,
 * the real count of published lessons, then the learner's progress and one
 * action that begins, continues or reviews the course (FR-LND-02, FR-CAT-01,
 * FR-CAT-02). The home page and the course list share it, so both show the
 * same thing. With no course, one sentence says so (FR-CAT-04). Each title is
 * one size step below the heading that names the list.
 */
export function CourseRows({ courses, labelledBy, titleLevel }: CourseRowsProps) {
  if (courses.length === 0) {
    return <p className="max-inline-prose text-base text-text-muted">{courseList.empty}</p>;
  }
  const Title = titleLevel === 2 ? "h2" : "h3";
  return (
    <ul aria-labelledby={labelledBy} className="flex flex-col gap-4">
      {courses.map((course) => (
        <li
          key={course.slug}
          className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-4 md:p-5"
        >
          <Title className={titleLevel === 2 ? "text-lg" : "text-base"}>
            <Link href={coursePath(course.slug)} variant="heading">
              {course.title}
            </Link>
          </Title>
          <p className="max-inline-prose text-base text-text">{course.summary}</p>
          <CourseRowProgress course={course.slug} title={course.title} lessons={course.lessons} />
        </li>
      ))}
    </ul>
  );
}
