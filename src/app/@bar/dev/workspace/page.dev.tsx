import { workspaceGalleryBar } from "@/features/catalog";
import { LessonBar } from "@/features/shell";

// Development only, as the workspace gallery it heads (`.dev.tsx`).
export default function WorkspaceGalleryBar() {
  const bar = workspaceGalleryBar();
  return <LessonBar back={bar.back} title={bar.title} />;
}
