import type { Metadata } from "next";
import { RuntimeConsole } from "@/features/workspace";
import { runtimeDev } from "@/messages/runtime-dev";

// Development only: the `.dev.tsx` extension is a page only under the
// development server (next.config.ts, from WP-1.4), so production builds
// have no route and no bundle for it.
export const metadata: Metadata = {
  title: runtimeDev.title,
  robots: { index: false, follow: false },
};

export default function RuntimeDevelopmentPage() {
  return <RuntimeConsole />;
}
