import type { ReactNode } from "react";
import { adminArea } from "@/messages/admin";

/**
 * The frame of every admin page (docs/spec/03-experience.md section 7): made
 * for 1024 px and wider. Below that, one sentence asks for a larger screen.
 */
export function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-page px-gutter py-6">
      <p className="max-w-prose text-base text-text lg:hidden">{adminArea.narrowScreen}</p>
      <div className="hidden lg:block">{children}</div>
    </div>
  );
}
