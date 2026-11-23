import type { Metadata } from "next";
import { CatalogStateGallery } from "@/features/catalog";
import { catalogGallery } from "@/messages/gallery";

// Development only. The `.dev.tsx` extension is a page extension in
// development alone (next.config.ts), so the production build has no route here.
export const metadata: Metadata = {
  title: catalogGallery.title,
  robots: { index: false },
};

export default function CatalogStatesPage() {
  return <CatalogStateGallery />;
}
