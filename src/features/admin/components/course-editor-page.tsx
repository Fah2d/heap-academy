import { notFound } from "next/navigation";
import { z } from "@/domain/schema";
import { ADMIN_PATHS } from "@/domain/admin/gate";
import { createSessionClient } from "@/infrastructure/db/session-client";
import { courseEditor as words } from "@/messages/admin";
import { Link } from "@/ui";
import { courseForEditor } from "../server/courses";
import { requireAdminStage } from "../server/gate";
import {
  deleteChapter,
  reorder,
  saveChapter,
  saveCourse,
  setCourseStatus,
} from "../server/structure-actions";
import { createLesson } from "../server/lesson-actions";
import { exportCourse, importLesson } from "../server/transfer-actions";
import { CourseEditor } from "./course-editor";
import { CourseEditorFailed } from "./course-editor-failed";

/**
 * `/admin/courses/[id]` (docs/spec/03-experience.md section 7.3): one course,
 * read through the admin's own session. An address that names no course gets
 * the standard not-found page.
 */
export async function CourseEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminStage("allow");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const result = await courseForEditor(await createSessionClient("read-only"), id.data);
  if (result.ok && result.course === null) notFound();
  return (
    <section aria-labelledby="admin-course" className="flex flex-col gap-5">
      <div>
        <Link href={ADMIN_PATHS.allow} variant="standalone">
          {words.backToCourses}
        </Link>
      </div>
      {result.ok && result.course !== null ? (
        <>
          <h1 id="admin-course" className="text-xl font-semibold text-text">
            {words.editTitle(result.course.title)}
          </h1>
          <CourseEditor
            course={result.course}
            saveCourse={saveCourse}
            setStatus={setCourseStatus}
            saveChapter={saveChapter}
            deleteChapter={deleteChapter}
            reorder={reorder}
            createLesson={createLesson}
            exportCourse={exportCourse}
            importLesson={importLesson}
          />
        </>
      ) : (
        <CourseEditorFailed headingId="admin-course" />
      )}
    </section>
  );
}
