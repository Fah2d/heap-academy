import { courseEditor as words, structure } from "@/messages/admin";
import { Notice } from "@/ui";

/**
 * The course editor when the course could not be read
 * (docs/spec/03-experience.md section 8). The page around it owns the `h1`,
 * so the state can also sit in the admin gallery beside the gallery's own.
 */
export function CourseEditorFailed() {
  return (
    <Notice kind="error" kindLabel={structure.errorLabel}>
      {words.loadFailed}
    </Notice>
  );
}
