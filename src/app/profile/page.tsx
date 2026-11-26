import type { Metadata } from "next";
import { ProfilePage } from "@/features/profile";
import { profile } from "@/messages/profile";

export const metadata: Metadata = {
  title: profile.title,
  // A learner's own page is never a search result (FR-SEO-01).
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ProfilePage />;
}
