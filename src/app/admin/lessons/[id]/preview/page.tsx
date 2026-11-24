import { adminMetadata, LessonPreviewPage } from "@/features/admin";
import { lessonEditor } from "@/messages/admin";

export function generateMetadata() {
  return adminMetadata(lessonEditor.previewMetaTitle);
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <LessonPreviewPage params={params} />;
}
