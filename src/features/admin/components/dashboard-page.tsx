import { createSessionClient } from "@/infrastructure/db/session-client";
import { dashboard as words } from "@/messages/admin";
import { listCoursesForAdmin } from "../server/courses";
import { requireAdminStage } from "../server/gate";
import { CourseList } from "./course-list";

/** `/admin`: the dashboard's first page (docs/spec/03-experience.md section 7.2). */
export async function DashboardPage() {
  await requireAdminStage("allow");
  const result = await listCoursesForAdmin(await createSessionClient("read-only"));
  return (
    <section aria-labelledby="admin-courses" className="flex flex-col gap-5">
      <h1 id="admin-courses" className="text-xl font-semibold text-text">
        {words.title}
      </h1>
      <CourseList result={result} />
    </section>
  );
}
