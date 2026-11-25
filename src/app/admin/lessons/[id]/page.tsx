import { adminMetadata, LessonEditorPage } from "@/features/admin";
import { lessonEditor } from "@/messages/admin";

export function generateMetadata() {
  return adminMetadata(lessonEditor.metaTitle);
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <LessonEditorPage params={params} />;
}
