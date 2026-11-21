import NextLink from "next/link";
import type { ReactNode } from "react";
import { shell } from "@/messages/shell";

// The frame every page shares (docs/spec/03-experience.md section 4). The
// header shows only destinations that exist: Courses joins it with the course
// list (WP-5.1), and the footer arrives with the privacy and terms pages
// (WP-6.3). Until then neither has a link to show, so neither renders
// (antislop R-24).
//
// `account` is the account control, which the layout passes in so this frame
// does not depend on sign-in.
export function SiteShell({ account, children }: { account: ReactNode; children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:inset-bs-4 focus:z-20 focus:inline-flex focus:min-h-target focus:items-center focus:rounded-control focus:bg-surface-raised focus:px-4 focus:text-text"
      >
        {shell.skipLink}
      </a>
      <header className="border-be border-border">
        <div className="mx-auto flex min-h-target max-w-page items-center justify-between gap-4 px-gutter py-3">
          <NextLink
            href="/"
            className="inline-flex min-h-target items-center text-lg font-semibold text-text underline-offset-(--link-underline-offset) hover:underline"
          >
            {shell.productName}
          </NextLink>
          <nav aria-label={shell.accountNavigation}>{account}</nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
    </>
  );
}
