import type { Metadata } from "next";
import { AdminFrame, AdminStateGalleryServer } from "@/features/admin";
import { adminGallery } from "@/messages/gallery";

// Development only. The `.dev.tsx` extension is a page extension in
// development alone (next.config.ts), so the production build has no route here.
export const metadata: Metadata = {
  title: adminGallery.title,
  robots: { index: false },
};

export default function AdminStatesPage() {
  return (
    <AdminFrame>
      <AdminStateGalleryServer />
    </AdminFrame>
  );
}
