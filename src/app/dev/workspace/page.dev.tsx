import type { Metadata } from "next";
import { WorkspaceGallery } from "@/features/catalog";
import { workspaceGallery } from "@/messages/gallery";

// Development only. The `.dev.tsx` extension is a page extension in
// development alone (next.config.ts), so the production build has no route here.
export const metadata: Metadata = {
  title: workspaceGallery.title,
  robots: { index: false },
};

export default function WorkspaceDevelopmentPage() {
  return <WorkspaceGallery />;
}
