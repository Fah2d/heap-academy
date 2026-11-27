import { renderMarkdown } from "@/content/markdown";
import { parseLessonId } from "@/domain/ids";
import { LessonContent, Workspace } from "@/features/workspace";
import { EXAMPLE_LESSON } from "@/grader/example-lesson";
import { requestNonce } from "@/infrastructure/http/nonce";
import { workspaceGallery as words } from "@/messages/gallery";
import { workspace } from "@/messages/workspace";
import { coursePath } from "../paths";

// A fixed ID for the example lesson, so its completion is kept across visits.
const EXAMPLE_LESSON_ID = parseLessonId("00000000-0000-4000-8000-00000000e001");
/** What the example lesson earns, as a seeded lesson would. */
const EXAMPLE_LESSON_XP = 10;

/**
 * The development-only workspace page (`/dev/workspace`): the example lesson
 * of docs/spec/04-content-system.md section 7 in the real workspace, with no
 * database read, so the browser journeys J-2, J-3 and J-4 run without the
 * local stack. Previous and next name lessons that do not exist here.
 */
export async function WorkspaceGallery() {
  if (EXAMPLE_LESSON_ID === undefined) throw new Error("gallery: the example lesson's ID");
  return (
    <Workspace
      lesson={{
        id: EXAMPLE_LESSON_ID,
        xp: EXAMPLE_LESSON_XP,
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

/** The gallery's compact bar, as the real workspace's (`lessonBar`). */
export function workspaceGalleryBar(): { back: { href: string; label: string }; title: string } {
  return {
    back: { href: coursePath(words.courseSlug), label: workspace.backToCourse(words.courseTitle) },
    title: EXAMPLE_LESSON.title,
  };
}
