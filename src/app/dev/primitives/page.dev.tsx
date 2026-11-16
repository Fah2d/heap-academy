import type { Metadata } from "next";
import { PrimitiveGallery } from "@/features/shell";
import { gallery } from "@/messages/gallery";

// Development only. The `.dev.tsx` extension is a page extension in
// development alone (next.config.ts), so the production build has no route here.
export const metadata: Metadata = {
  title: gallery.title,
  robots: { index: false },
};

export default function PrimitivesPage() {
  return <PrimitiveGallery />;
}
