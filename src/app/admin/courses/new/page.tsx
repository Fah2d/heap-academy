import { adminMetadata, NewCoursePage } from "@/features/admin";
import { courseEditor } from "@/messages/admin";

export function generateMetadata() {
  return adminMetadata(courseEditor.newTitle);
}

export default function Page() {
  return <NewCoursePage />;
}
