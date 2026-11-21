import { notFound } from "next/navigation";
import { z } from "zod";
import { ADMIN_PATHS } from "@/domain/admin/gate";
import { createSessionClient } from "@/infrastructure/db/session-client";
import { courseEditor as words, structure } from "@/messages/admin";
import { Link, Notice } from "@/ui";
import { courseForEditor } from "../server/courses";
import { requireAdminStage } from "../server/gate";
import {
  deleteChapter,
  reorder,
  saveChapter,
  saveCourse,
  setCourseStatus,
} from "../server/structure-actions";
import { CourseEditor } from "./course-editor";

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
          />
        </>
      ) : (
        <>
          <h1 id="admin-course" className="text-xl font-semibold text-text">
            {words.metaTitle}
          </h1>
          <Notice kind="error" kindLabel={structure.errorLabel}>
            {words.loadFailed}
          </Notice>
        </>
      )}
    </section>
  );
}
