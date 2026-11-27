import type { Metadata } from "next";
import { SignOutForm } from "@/features/auth";
import { type GalleryDeletion, ProfileGallery } from "@/features/profile";
import { profileGallery } from "@/messages/gallery";

// Development only. The `.dev.tsx` extension is a page extension in
// development alone (next.config.ts), so the production build has no route here.
export const metadata: Metadata = {
  title: profileGallery.title,
  robots: { index: false },
};

const OUTCOMES: readonly GalleryDeletion[] = ["hangs", "succeeds", "fails"];

export default async function ProfileStatesPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[]; deletion?: string | string[] }>;
}) {
  const { state, deletion } = await searchParams;
  const outcome = OUTCOMES.find((value) => value === deletion) ?? "succeeds";
  return <ProfileGallery empty={state === "empty"} outcome={outcome} signOut={<SignOutForm />} />;
}
