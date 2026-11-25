import { dashboard as words } from "@/messages/admin";
import { Notice } from "@/ui";
import type { AdminCourses } from "../server/courses";

/**
 * The course list of `/admin` (docs/spec/03-experience.md section 7.2): every
 * course with its status and its published and draft lessons, or a sentence
 * when there is none or the list could not load.
 */
export function CourseList({ result }: { result: AdminCourses }) {
  if (!result.ok) {
    return (
      <Notice kind="error" kindLabel={words.errorLabel}>
        {words.loadFailed}
      </Notice>
    );
  }
  if (result.courses.length === 0) {
    return <p className="text-base text-text-muted">{words.empty}</p>;
  }
  const cell = "border-b border-border px-3 py-2 text-start";
  return (
    <table className="w-full border-collapse text-sm text-text">
      <caption className="sr-only">{words.tableCaption}</caption>
      <thead>
        <tr className="text-text-muted">
          <th scope="col" className={`${cell} font-medium`}>
            {words.columnCourse}
          </th>
          <th scope="col" className={`${cell} font-medium`}>
            {words.columnStatus}
          </th>
          <th scope="col" className={`${cell} text-end font-medium`}>
            {words.columnPublished}
          </th>
          <th scope="col" className={`${cell} text-end font-medium`}>
            {words.columnDrafts}
          </th>
        </tr>
      </thead>
      <tbody>
        {result.courses.map((course) => (
          <tr key={course.id}>
            <th scope="row" className={`${cell} font-medium`}>
              {course.title}
            </th>
            <td className={cell}>{words.status[course.status]}</td>
            <td className={`${cell} text-end tabular-nums`}>{course.publishedLessons}</td>
            <td className={`${cell} text-end tabular-nums`}>{course.draftLessons}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
