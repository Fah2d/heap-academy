"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import { cx } from "../class-names";

export type ButtonVariant = "primary" | "secondary" | "destructive";

/** The surface the button sits on. Hover is one step above it (DESIGN.md section 4.5). */
export type ButtonSurface = "base" | "raised";

export type ButtonProps = Omit<AriaButtonProps, "className" | "style" | "children"> & {
  variant: ButtonVariant;
  surface?: ButtonSurface;
  /** An icon shown before the label; it is hidden from assistive technology. */
  icon?: ReactNode;
  /** Full width, as a view's main action is on a phone (03-experience.md section 6.8). */
  block?: boolean;
  /**
   * The keys that press it, as `aria-keyshortcuts` reads them ("Control+Enter").
   * React Aria passes no such attribute on, so it is set on the element.
   */
  keyShortcuts?: string;
  children: ReactNode;
};

const shared =
  "inline-flex min-h-target min-w-target items-center justify-center gap-2 rounded-control border px-4 text-base font-medium transition-colors data-pressed:translate-y-(--press-shift) data-disabled:border-border data-disabled:bg-transparent data-disabled:text-text-muted data-pending:border-border data-pending:bg-transparent data-pending:text-text-muted data-pending:translate-y-0";

const hover: Record<ButtonSurface, string> = {
  base: "data-hovered:bg-surface-raised",
  raised: "data-hovered:bg-surface-hover",
};

function variantClasses(variant: ButtonVariant, surface: ButtonSurface): string {
  switch (variant) {
    case "primary":
      return "border-transparent bg-action text-on-action data-hovered:bg-action-hover data-pressed:bg-action-press";
    case "secondary":
      return cx(
        "border-border-control bg-surface text-text data-pressed:bg-surface-hover",
        hover[surface],
      );
    case "destructive":
      return cx(
        "border-fail bg-transparent text-fail data-pressed:bg-surface-hover",
        hover[surface],
      );
    default: {
      const unreachable: never = variant;
      return unreachable;
    }
  }
}

/**
 * One primary button per screen; secondary for the other actions; destructive
 * for deleting and archiving, never with a red fill.
 */
export function Button({
  variant,
  surface = "base",
  icon,
  block = false,
  keyShortcuts,
  children,
  ...props
}: ButtonProps) {
  const element = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const button = element.current;
    if (button === null) return;
    if (keyShortcuts === undefined) button.removeAttribute("aria-keyshortcuts");
    else button.setAttribute("aria-keyshortcuts", keyShortcuts);
  }, [keyShortcuts]);
  // React Aria announces a pending button by its ID and keeps the announcement
  // for 7 s. A button that leaves the page first, such as Publish once the
  // lesson is published, would leave it naming nothing (axe role-img-alt).
  // It has been read by then, so it leaves with the button.
  useEffect(() => {
    const button = element.current;
    return () => {
      if (button === null || button.id === "") return;
      for (const node of document.querySelectorAll(
        '[role="log"] > [role="img"][aria-labelledby]',
      )) {
        if (node.getAttribute("aria-labelledby")?.split(" ").includes(button.id)) node.remove();
      }
    };
  }, []);
  return (
    <AriaButton
      ref={element}
      {...props}
      className={cx(shared, variantClasses(variant, surface), block && "w-full")}
    >
      {icon !== undefined && (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      )}
      {children}
    </AriaButton>
  );
}
