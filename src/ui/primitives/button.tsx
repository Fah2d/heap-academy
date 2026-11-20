"use client";

import type { ReactNode } from "react";
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
  /** Full width, for the phone action of a view. */
  block?: boolean;
  children: ReactNode;
};

const shared =
  "inline-flex min-h-target min-w-target items-center justify-center gap-2 rounded-control border px-4 text-base font-medium transition-colors data-pressed:translate-y-(--press-shift) data-disabled:border-border data-disabled:bg-transparent data-disabled:text-text-muted";

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
  children,
  ...props
}: ButtonProps) {
  return (
    <AriaButton
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
