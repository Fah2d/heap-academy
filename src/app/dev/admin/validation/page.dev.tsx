import type { Metadata } from "next";
import { AdminFrame, AdminStateGalleryServer } from "@/features/admin";
import { adminGallery } from "@/messages/gallery";

// Development only. The `.dev.tsx` extension is a page extension in
// development alone (next.config.ts), so the production build has no route here.
export const metadata: Metadata = {
  title: adminGallery.pages.validation.title,
  robots: { index: false },
};

export default function AdminValidationStatesPage() {
  return (
    <AdminFrame>
      <AdminStateGalleryServer part="validation" />
    </AdminFrame>
  );
}
