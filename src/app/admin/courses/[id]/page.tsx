import { adminMetadata, CourseEditorPage } from "@/features/admin";
import { courseEditor } from "@/messages/admin";

export function generateMetadata() {
  return adminMetadata(courseEditor.metaTitle);
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <CourseEditorPage params={params} />;
}
