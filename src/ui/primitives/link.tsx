import NextLink from "next/link";
import type { ReactNode } from "react";
import { cx } from "../class-names";

/**
 * - `inline`: a link in running text, always underlined, because amber on the
 *   text color measures only 2.09 to 1 against the words around it.
 * - `standalone`: a link that stands alone as the next step, such as "Go to
 *   the home page". Underlined, and at least 44 px tall.
 * - `nav`: a header navigation link. Muted, not underlined, marked when current.
 */
export type LinkVariant = "inline" | "standalone" | "nav";

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
  nav: "inline-flex min-h-target min-w-target items-center justify-center border-b-(length:--marker-width) border-transparent text-text-muted no-underline hover:text-text",
};

export function Link({ href, variant, current = false, children }: LinkProps) {
  const isCurrent = variant === "nav" && current;
  return (
    <NextLink
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      className={cx(classes[variant], isCurrent && "border-action font-semibold text-text")}
    >
      {children}
    </NextLink>
  );
}
