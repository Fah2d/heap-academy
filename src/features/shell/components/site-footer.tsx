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
 * A client component only to read the current address.
 */
export function SiteFooter() {
  const pathname = usePathname();
  return (
    <footer className="border-bs border-border">
      <ul className="mx-auto flex max-inline-page flex-wrap items-center gap-x-5 px-gutter py-3">
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
