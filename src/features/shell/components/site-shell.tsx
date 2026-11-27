import NextLink from "next/link";
import type { ReactNode } from "react";
import { shell } from "@/messages/shell";
import { Link } from "@/ui";
import { SiteFooter } from "./site-footer";

// The frame every page shares (docs/spec/03-experience.md section 4). The
// header shows only destinations that exist. The footer links to the privacy
// and terms pages (WP-6.3).
//
// The header's start is the page's own bar, from the layout's `bar` slot:
// the wordmark and the site's pages everywhere (`SiteBar`), and in the
// workspace one compact bar with the way back to the course and the lesson's
// title (`LessonBar`, section 4). The account control is passed in by the
// layout and stays in the header on every page, so it is rendered once and is
// kept across a move between pages. This frame depends on neither feature.
export function SiteShell({
  bar,
  account,
  children,
}: {
  bar: ReactNode;
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
        <div className="mx-auto flex min-h-target max-w-page flex-wrap items-center gap-x-4 gap-y-1 px-gutter py-3 has-[[data-lesson-bar]]:max-w-none has-[[data-lesson-bar]]:py-1">
          {bar}
          <nav aria-label={shell.accountNavigation} className="ms-auto">
            {account}
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}

/** The header's start on every page but the workspace: the wordmark, then the site's pages. */
export function SiteBar({ navigation }: { navigation: ReactNode }) {
  return (
    <>
      <NextLink
        href="/"
        className="inline-flex min-h-target items-center text-lg font-semibold text-text underline-offset-(--link-underline-offset) hover:underline"
      >
        {shell.productName}
      </NextLink>
      <nav aria-label={shell.mainNavigation} className="me-auto">
        {navigation}
      </nav>
    </>
  );
}

/**
 * The workspace's compact bar (docs/spec/03-experience.md sections 4 and
 * 6.1): back to the course, then the lesson's title, the page's one `h1`. It
 * replaces the wordmark row, so the editor keeps the window's height.
 */
export function LessonBar({
  back,
  title,
}: {
  back: { href: string; label: string };
  title: string;
}) {
  return (
    // Below 768 px the bar's parts join the header's row, so the way back
    // and the account control share the first line and the title takes the
    // next; the title is not focusable, so the keyboard's order is the same.
    <div
      data-lesson-bar
      className="contents md:me-auto md:flex md:min-w-0 md:flex-wrap md:items-center md:gap-x-5"
    >
      <Link href={back.href} variant="standalone">
        {back.label}
      </Link>
      <h1 className="min-w-0 text-lg font-semibold text-text max-md:order-last max-md:basis-full max-md:pbe-2">
        {title}
      </h1>
    </div>
  );
}
