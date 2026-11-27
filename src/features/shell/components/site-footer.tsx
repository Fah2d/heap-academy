"use client";

import { usePathname } from "next/navigation";
import { shell } from "@/messages/shell";
import { Link } from "@/ui";

/** The footer's destinations, in the order they are shown. */
export const FOOTER_LINKS = [
  { href: "/privacy", label: shell.footer.privacy },
  { href: "/terms", label: shell.footer.terms },
] as const;

/**
 * The `contentinfo` landmark with the privacy and terms links, on every page
 * (FR-SYS-03, docs/spec/03-experience.md section 4). The links are chrome, so
 * they take the header navigation's muted style rather than the amber of a
 * link in running text, and the current page's link is marked the same way.
 * A client component only to read the current address. Beside the workspace
 * from 768 px it spans the window as the workspace does, and drops its
 * padding while its links keep their 44 px targets, so the editor keeps the
 * height (WP-8.1 design review, B4).
 */
export function SiteFooter() {
  const pathname = usePathname();
  return (
    <footer className="border-bs border-border">
      <ul className="mx-auto flex max-inline-page flex-wrap items-center gap-x-5 px-gutter py-3 md:[body:has([data-workspace])_&]:max-inline-none md:[body:has([data-workspace])_&]:py-0">
        {FOOTER_LINKS.map(({ href, label }) => (
          <li key={href}>
            <Link href={href} variant="nav" current={pathname === href}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </footer>
  );
}
