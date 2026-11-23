import { notFound } from "next/navigation";
import { z } from "@/domain/schema";
import { renderMarkdown } from "@/content/markdown";
import { adminCoursePath } from "@/domain/admin/gate";
import { createSessionClient } from "@/infrastructure/db/session-client";
import { requestNonce } from "@/infrastructure/http/nonce";
import { lessonEditor as words, structure } from "@/messages/admin";
import { Link, Notice } from "@/ui";
import { requireAdminStage } from "../server/gate";
import { renderInstructionsPreview, saveLesson } from "../server/lesson-actions";
import { lessonForEditor } from "../server/lessons";
import { LessonEditor } from "./lesson-editor";

/**
 * `/admin/lessons/[id]` (docs/spec/03-experience.md section 7.4): one lesson
 * with its solution, read through the admin's own session. An address that
 * names no lesson, or one this session may not read, gets the standard
 * not-found page.
 */
export async function LessonEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminStage("allow");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const result = await lessonForEditor(await createSessionClient("read-only"), id.data);
  if (result.ok && result.lesson === null) notFound();
  if (!result.ok || result.lesson === null) {
    return (
      <section aria-labelledby="admin-lesson" className="flex flex-col gap-5">
        <h1 id="admin-lesson" className="text-xl font-semibold text-text">
          {words.metaTitle}
        </h1>
        <Notice kind="error" kindLabel={structure.errorLabel}>
          {words.loadFailed}
        </Notice>
      </section>
    );
  }
  const lesson = result.lesson;
  return (
    <section aria-labelledby="admin-lesson" className="flex flex-col gap-5">
      <div>
        <Link href={adminCoursePath(lesson.courseId)} variant="standalone">
          {words.backToCourse(lesson.courseTitle)}
        </Link>
      </div>
      <h1 id="admin-lesson" className="text-xl font-semibold text-text">
        {words.editTitle(lesson.title)}
      </h1>
      <LessonEditor
        lesson={lesson}
        initialPreview={renderMarkdown(lesson.instructionsMd)}
        nonce={await requestNonce()}
        save={saveLesson}
        renderPreview={renderInstructionsPreview}
      />
    </section>
  );
}
