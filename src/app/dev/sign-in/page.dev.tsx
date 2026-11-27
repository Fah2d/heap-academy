import type { Metadata } from "next";
import { type GallerySend, type GalleryVerify, SignInGallery } from "@/features/auth";
import { signInGallery } from "@/messages/gallery";

// Development only. The `.dev.tsx` extension is a page extension in
// development alone (next.config.ts), so the production build has no route here.
export const metadata: Metadata = {
  title: signInGallery.title,
  robots: { index: false },
};

const SENDS: readonly GallerySend[] = ["hangs", "sent", "limited"];
const VERIFIES: readonly GalleryVerify[] = ["hangs", "rejected", "limited"];

export default async function SignInStatesPage({
  searchParams,
}: {
  searchParams: Promise<{ send?: string | string[]; verify?: string | string[] }>;
}) {
  const { send, verify } = await searchParams;
  return (
    <SignInGallery
      send={SENDS.find((value) => value === send) ?? "sent"}
      verify={VERIFIES.find((value) => value === verify) ?? "hangs"}
    />
  );
}
