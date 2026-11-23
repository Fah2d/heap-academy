import type { Metadata } from "next";
import { RuntimeConsole } from "@/features/workspace";
import { runtimeDev } from "@/messages/runtime-dev";

// The development server and Vercel previews only: the `.preview.tsx`
// extension is a page there alone (next.config.ts, WP-3.4), so production
// builds have no route and no bundle for it. The owner opens it on a phone
// through the protected preview's shareable link.
export const metadata: Metadata = {
  title: runtimeDev.title,
  robots: { index: false, follow: false },
};

export default function RuntimeDevelopmentPage() {
  return <RuntimeConsole />;
}
