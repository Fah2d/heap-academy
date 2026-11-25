import { notFound } from "next/navigation";
import { z } from "@/domain/schema";
import { renderMarkdown } from "@/content/markdown";
import { adminLessonPath } from "@/domain/admin/gate";
import { LessonContent, Workspace } from "@/features/workspace";
import { createSessionClient } from "@/infrastructure/db/session-client";
import { requestNonce } from "@/infrastructure/http/nonce";
import { lessonEditor as words, structure } from "@/messages/admin";
import { Link, Notice } from "@/ui";
import { requireAdminStage } from "../server/gate";
import { lessonForPreview } from "../server/lesson-preview";

/**
 * `/admin/lessons/[id]/preview` (docs/spec/03-experience.md section 7.7;
 * FR-ADM-08): the lesson's last saved version in the real workspace, which
 * records nothing. An address that names no lesson, or one this session may
 * not read, gets the standard not-found page, as the editor does.
 */
export async function LessonPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminStage("allow");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const result = await lessonForPreview(await createSessionClient("read-only"), id.data);
  if (result.ok && result.lesson === null) notFound();
  if (!result.ok || result.lesson === null) {
    return (
      <section aria-labelledby="admin-preview" className="flex flex-col gap-5">
        <div>
          <Link href={adminLessonPath(id.data)} variant="standalone">
            {words.backToEditor}
          </Link>
        </div>
        <h1 id="admin-preview" className="text-xl font-semibold text-text">
          {words.previewMetaTitle}
        </h1>
        <Notice kind="error" kindLabel={structure.errorLabel}>
          {words.previewLoadFailed}
        </Notice>
      </section>
    );
  }
  const { lesson, instructionsMd } = result.lesson;
  return (
    <Workspace
      lesson={lesson}
      nonce={await requestNonce()}
      instructions={<LessonContent document={renderMarkdown(instructionsMd)} />}
      preview={{ backHref: adminLessonPath(lesson.id), backLabel: words.backToEditor }}
    />
  );
}
