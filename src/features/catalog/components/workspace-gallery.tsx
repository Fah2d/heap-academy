import { renderMarkdown } from "@/content/markdown";
import { LessonContent, Workspace } from "@/features/workspace";
import { EXAMPLE_LESSON } from "@/grader/example-lesson";
import { requestNonce } from "@/infrastructure/http/nonce";
import { workspaceGallery as words } from "@/messages/gallery";

/**
 * The development-only workspace page (`/dev/workspace`): the example lesson
 * of docs/spec/04-content-system.md section 7 in the real workspace, with no
 * database read, so the browser journeys J-2, J-3 and J-4 run without the
 * local stack. Previous and next name lessons that do not exist here.
 */
export async function WorkspaceGallery() {
  return (
    <Workspace
      lesson={{
        course: { slug: words.courseSlug, title: words.courseTitle },
        slug: words.lessonSlug,
        title: EXAMPLE_LESSON.title,
        starterCode: EXAMPLE_LESSON.starter,
        hints: EXAMPLE_LESSON.hints,
        tests: EXAMPLE_LESSON.testCases,
        neighbours: { previous: words.previous, next: words.next },
      }}
      nonce={await requestNonce()}
      instructions={<LessonContent document={renderMarkdown(EXAMPLE_LESSON.instructions)} />}
    />
  );
}
