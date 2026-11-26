import type { Metadata } from "next";
import { AdminFrame, AdminPreviewGallery } from "@/features/admin";
import { adminPreviewGallery } from "@/messages/gallery";

// Development only. The `.dev.tsx` extension is a page extension in
// development alone (next.config.ts), so the production build has no route here.
export const metadata: Metadata = {
  title: adminPreviewGallery.title,
  robots: { index: false },
};

export default function AdminPreviewPage() {
  return (
    <AdminFrame>
      <AdminPreviewGallery />
    </AdminFrame>
  );
}
