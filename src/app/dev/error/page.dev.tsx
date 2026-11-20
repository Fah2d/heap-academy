import type { Metadata } from "next";

// Development only, like the primitive gallery: a page that fails while it
// renders, so the error page can be seen, checked with axe, and photographed.
export const metadata: Metadata = {
  robots: { index: false },
};

export default function FailingPage(): never {
  throw new Error("The development error page failed on purpose.");
}
