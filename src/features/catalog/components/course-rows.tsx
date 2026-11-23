import type { ContentResult, PublishedCourseSummary } from "@/content";
import { catalogCommon, courseList } from "@/messages/catalog";
import { Link, Notice } from "@/ui";
import { coursePath } from "../paths";

export type CourseRowsProps = {
  result: ContentResult<PublishedCourseSummary[]>;
  /** The id of the heading that names the list. */
  labelledBy: string;
  /** The level of each course title: below the heading that names the list. */
  titleLevel: 2 | 3;
};

/**
 * The published courses as wide rows: title linking into the course, summary,
 * and the real count of published lessons (FR-LND-02, FR-CAT-01). The home
 * page and the course list share it, so both show the same thing. With no
 * course, one sentence says so (FR-CAT-04); when the read failed, a notice
 * says that instead.
 */
export function CourseRows({ result, labelledBy, titleLevel }: CourseRowsProps) {
  if (!result.ok) {
    return (
      <Notice kind="error" kindLabel={catalogCommon.errorLabel}>
        {courseList.loadFailed}
      </Notice>
    );
  }
  if (result.value.length === 0) {
    return <p className="max-w-prose text-base text-text-muted">{courseList.empty}</p>;
  }
  const Title = titleLevel === 2 ? "h2" : "h3";
  return (
    <ul aria-labelledby={labelledBy} className="flex flex-col gap-4">
      {result.value.map((course) => (
        <li
          key={course.slug}
          className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-5"
        >
          <Title className="text-lg">
            <Link href={coursePath(course.slug)} variant="standalone">
              {course.title}
            </Link>
          </Title>
          <p className="max-w-prose text-base text-text">{course.summary}</p>
          <p className="text-sm text-text-muted tabular-nums">
            {catalogCommon.lessonCount(course.lessonCount)}
          </p>
        </li>
      ))}
    </ul>
  );
}
