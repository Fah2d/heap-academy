import { ADMIN_PATHS } from "@/domain/admin/gate";
import { courseEditor as words } from "@/messages/admin";
import { Link } from "@/ui";
import { saveCourse } from "../server/structure-actions";
import { requireAdminStage } from "../server/gate";
import { NewCourseForm } from "./new-course-form";

/** `/admin/courses/new` (docs/spec/03-experience.md section 7.2): one action creates a course. */
export async function NewCoursePage() {
  await requireAdminStage("allow");
  return (
    <section aria-labelledby="admin-new-course" className="flex flex-col gap-5">
      <div>
        <Link href={ADMIN_PATHS.allow} variant="standalone">
          {words.backToCourses}
        </Link>
      </div>
      <h1 id="admin-new-course" className="text-xl font-semibold text-text">
        {words.newTitle}
      </h1>
      <NewCourseForm saveCourse={saveCourse} />
    </section>
  );
}
