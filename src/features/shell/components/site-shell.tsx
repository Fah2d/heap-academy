import NextLink from "next/link";
import type { ReactNode } from "react";
import { shell } from "@/messages/shell";
import { SiteFooter } from "./site-footer";

// The frame every page shares (docs/spec/03-experience.md section 4). The
// header shows only destinations that exist: Courses and the account control
// join it with the pages they open (WP-5.1, WP-2.2). The footer links to the
// privacy and terms pages (WP-6.3).
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:inset-bs-4 focus:z-20 focus:inline-flex focus:min-h-target focus:items-center focus:rounded-control focus:bg-surface-raised focus:px-4 focus:text-text"
      >
        {shell.skipLink}
      </a>
      <header className="border-be border-border">
        <div className="mx-auto flex min-h-target max-w-page items-center px-gutter py-3">
          <NextLink
            href="/"
            className="inline-flex min-h-target items-center text-lg font-semibold text-text underline-offset-(--link-underline-offset) hover:underline"
          >
            {shell.productName}
          </NextLink>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
