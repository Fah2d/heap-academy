import NextLink from "next/link";
import type { ReactNode } from "react";
import { shell } from "@/messages/shell";

// The frame every page shares (docs/spec/03-experience.md section 4). The
// header shows only destinations that exist. The footer arrives with the
// privacy and terms pages (WP-6.3); until then it has no link to show, so it
// does not render (antislop R-24).
//
// The layout passes in `navigation` (the site's own pages, from the catalog)
// and `account` (the account control), so this frame depends on neither.
export function SiteShell({
  navigation,
  account,
  children,
}: {
  navigation: ReactNode;
  account: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:inset-bs-4 focus:z-20 focus:inline-flex focus:min-h-target focus:items-center focus:rounded-control focus:bg-surface-raised focus:px-4 focus:text-text"
      >
        {shell.skipLink}
      </a>
      <header className="border-be border-border">
        <div className="mx-auto flex min-h-target max-w-page flex-wrap items-center gap-x-4 gap-y-1 px-gutter py-3">
          <NextLink
            href="/"
            className="inline-flex min-h-target items-center text-lg font-semibold text-text underline-offset-(--link-underline-offset) hover:underline"
          >
            {shell.productName}
          </NextLink>
          <nav aria-label={shell.mainNavigation} className="me-auto">
            {navigation}
          </nav>
          <nav aria-label={shell.accountNavigation}>{account}</nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
    </>
  );
}
