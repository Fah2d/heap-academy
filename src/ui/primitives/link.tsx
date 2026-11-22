import NextLink from "next/link";
import type { ReactNode } from "react";
import { cx } from "../class-names";
import { Launch } from "../icons";

/**
 * - `inline`: a link in running text, always underlined, because amber on the
 *   text color measures only 2.09 to 1 against the words around it.
 * - `standalone`: a link that stands alone as the next step, such as "Go to
 *   the home page". Underlined, and at least 44 px tall.
 * - `nav`: a header navigation link. Muted, not underlined, marked when current.
 * - `action`: navigation that is the screen's one main action, such as "New
 *   course". It looks like the primary button, and it is still a link.
 */
export type LinkVariant = "inline" | "standalone" | "nav" | "action";

export type LinkProps = {
  href: string;
  variant: LinkVariant;
  /** For `nav`: this link is the current page. */
  current?: boolean;
  children: ReactNode;
};

const underlined =
  "text-action underline decoration-1 underline-offset-(--link-underline-offset) hover:decoration-2";

const classes: Record<LinkVariant, string> = {
  inline: underlined,
  standalone: cx(underlined, "inline-flex min-h-target items-center font-medium"),
  nav: "inline-flex min-h-target min-w-target items-center justify-center border-be-(length:--marker-width) no-underline",
  action:
    "inline-flex min-h-target min-w-target items-center justify-center rounded-control border border-transparent bg-action px-4 text-base font-medium text-on-action no-underline transition-colors hover:bg-action-hover active:bg-action-press",
};

// Exclusive sets: when two utilities set one property, the stylesheet's order
// decides, not the class attribute's, so the current link must not also carry
// the resting color and border.
const navCurrent = "border-action font-semibold text-text";
const navRest = "border-transparent text-text-muted hover:text-text";

export function Link({ href, variant, current = false, children }: LinkProps) {
  const isCurrent = variant === "nav" && current;
  return (
    <NextLink
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      className={cx(classes[variant], variant === "nav" && (isCurrent ? navCurrent : navRest))}
    >
      {children}
    </NextLink>
  );
}

export type ExternalLinkProps = {
  href: string;
  /** Read after the link's text, such as "(opens in a new tab)". */
  newTabLabel: string;
  children: ReactNode;
};

/**
 * A link that leaves the site, in running text: it opens in a new tab with no
 * opener and no referrer (docs/spec/04-content-system.md section 5), and says
 * so to every reader, by the icon and by words for screen readers.
 */
export function ExternalLink({ href, newTabLabel, children }: ExternalLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={underlined}>
      {children}
      <span className="sr-only"> {newTabLabel}</span>
      <Launch aria-hidden="true" size={16} className="ms-1 inline-block align-text-bottom" />
    </a>
  );
}
