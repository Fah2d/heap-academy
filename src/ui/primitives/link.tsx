import NextLink from "next/link";
import type { ReactNode } from "react";
import { cx } from "../class-names";

/**
 * - `inline`: a link in running text, always underlined, because amber on the
 *   text color measures only 2.09 to 1 against the words around it.
 * - `standalone`: a link that stands alone as the next step, such as "Go to
 *   the home page". Underlined, and at least 44 px tall.
 * - `heading`: a link that is a whole heading, such as a course title in a
 *   list. As `standalone`, at the heading's weight (DESIGN.md section 5), and
 *   laid out at the height of its text.
 * - `nav`: a header navigation link. Muted, not underlined, marked when current.
 * - `action`: navigation that is the screen's one main action, such as "New
 *   course". It looks like the primary button, and it is still a link.
 */
export type LinkVariant = "inline" | "standalone" | "heading" | "nav" | "action";

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
  // The 44 px target reaches past the line box, by padding that a negative
  // margin of the same size takes back, so a one-line title takes about the
  // room of its line, as a wrapped title does: exactly at text-lg (28 px
  // lines), 2.4 px more at text-base (25.6 px lines).
  heading: cx(underlined, "inline-flex min-block-target items-center -my-2 py-2 font-semibold"),
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
