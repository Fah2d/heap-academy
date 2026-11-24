import { courseEditor as words, structure } from "@/messages/admin";
import { Notice } from "@/ui";

/** The course editor when the course could not be read (docs/spec/03-experience.md section 8). */
export function CourseEditorFailed({ headingId }: { headingId: string }) {
  return (
    <>
      <h1 id={headingId} className="text-xl font-semibold text-text">
        {words.metaTitle}
      </h1>
      <Notice kind="error" kindLabel={structure.errorLabel}>
        {words.loadFailed}
      </Notice>
    </>
  );
}
