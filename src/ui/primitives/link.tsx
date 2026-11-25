import NextLink from "next/link";
import type { ReactNode } from "react";
import { cx } from "../class-names";

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
  /**
   * The browser loads a new document instead of navigating on the client, so
   * the page arrives with its own response headers. The sign-in page needs
   * this: only its policy may frame the bot challenge.
   */
  fullLoad?: boolean;
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

export function Link({ href, variant, current = false, fullLoad = false, children }: LinkProps) {
  const isCurrent = variant === "nav" && current;
  const shared = {
    href,
    "aria-current": isCurrent ? ("page" as const) : undefined,
    className: cx(classes[variant], variant === "nav" && (isCurrent ? navCurrent : navRest)),
  };
  return fullLoad ? <a {...shared}>{children}</a> : <NextLink {...shared}>{children}</NextLink>;
}
