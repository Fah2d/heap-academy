import type { ReactNode } from "react";
import { adminArea } from "@/messages/admin";

/**
 * The frame of every admin page (docs/spec/03-experience.md section 7): made
 * for windows 1024 px and wider. Below that, a heading and one sentence say
 * what to do, so the page still has its one `h1`.
 */
export function AdminFrame({ children }: { children: ReactNode }) {
  // The preview's workspace fills the window and scrolls by pane (FR-WSP-01),
  // so around it the frame takes the main region's full height, with no
  // padding above and below: its title row has its own (WP-9.1 design
  // review, m1).
  return (
    <div className="mx-auto max-w-page px-gutter py-6 has-[[data-workspace]]:h-full lg:has-[[data-workspace]]:py-0">
      <section aria-labelledby="admin-narrow" className="flex max-w-prose flex-col gap-3 lg:hidden">
        <h1 id="admin-narrow" className="text-xl font-semibold text-text">
          {adminArea.narrowHeading}
        </h1>
        <p className="text-base text-text">{adminArea.narrowScreen}</p>
      </section>
      <div className="hidden lg:block lg:has-[[data-workspace]]:h-full">{children}</div>
    </div>
  );
}
