import "server-only";
import { renderMarkdown } from "@/content/markdown";
import { parseLessonId } from "@/domain/ids";
import { LessonContent, Workspace } from "@/features/workspace";
import { EXAMPLE_LESSON } from "@/grader/example-lesson";
import { requestNonce } from "@/infrastructure/http/nonce";
import { lessonEditor } from "@/messages/admin";
import { workspaceGallery as words } from "@/messages/gallery";

// The example lesson's ID on `/dev/workspace`, so a journey can show that the
// preview leaves that lesson's saved code and completion alone.
const EXAMPLE_LESSON_ID = parseLessonId("00000000-0000-4000-8000-00000000e001");

/**
 * The development-only preview page (`/dev/admin/preview`): the example
 * lesson of docs/spec/04-content-system.md section 7 in the admin's preview
 * (section 7.7 of the experience spec), inside the admin frame, with no
 * database read and no guard, so the browser journeys run without the local
 * stack. Not an admin page: its data is fake.
 */
export async function AdminPreviewGallery() {
  if (EXAMPLE_LESSON_ID === undefined) throw new Error("gallery: the example lesson's ID");
  return (
    <Workspace
      lesson={{
        id: EXAMPLE_LESSON_ID,
        xp: 10,
        course: { slug: words.courseSlug, title: words.courseTitle },
        slug: words.lessonSlug,
        title: EXAMPLE_LESSON.title,
        starterCode: EXAMPLE_LESSON.starter,
        hints: EXAMPLE_LESSON.hints,
        tests: EXAMPLE_LESSON.testCases,
        neighbours: { previous: null, next: null },
      }}
      nonce={await requestNonce()}
      instructions={<LessonContent document={renderMarkdown(EXAMPLE_LESSON.instructions)} />}
      preview={{ backHref: "/dev/admin", backLabel: lessonEditor.backToEditor }}
    />
  );
}
