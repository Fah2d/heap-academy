import type { ReactNode } from "react";

/** The frame of the three catalog pages: one column at the page's width. */
export function CatalogPage({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-inline-page flex-col gap-7 px-gutter py-7">{children}</div>
  );
}
