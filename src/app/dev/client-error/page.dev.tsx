import type { Metadata } from "next";
import { BrowserErrorTrigger } from "@/features/shell";

// Development only, like the error page beside it: a page that fails in the
// browser after it loads, so the error page shows the reference of the
// client error report instead of a server digest (WP-7.3).
export const metadata: Metadata = {
  robots: { index: false },
};

export default function BrowserErrorPage() {
  return <BrowserErrorTrigger />;
}
