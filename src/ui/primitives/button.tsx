"use client";

import { type ReactNode, useEffect, useId } from "react";
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
 * React Aria announces a focused button going pending with a node in its
 * shared live region that is labelled by the button's id, and keeps that
 * node for seconds. When the finished action removes the button, as
 * publishing removes Publish, the node is left naming nothing: it reads as
 * empty and fails axe's role-img-alt rule. The nodes this button labelled
 * go with it. Its element may still be in the document at that moment, as
 * when the router leaves a page, so whether it is there is not asked.
 */
function forgetAnnouncements(id: string) {
  for (const node of document.querySelectorAll("[role='img'][aria-labelledby]")) {
    const labels = (node.getAttribute("aria-labelledby") ?? "").split(" ");
    if (labels.includes(id)) node.remove();
  }
}

/**
 * React Aria waits a moment before the first announcement in a document, so
 * a button that the finished action removes quickly can be gone before its
 * node arrives. One watcher per document drops such a node as it lands: every
 * element that labels it is already gone.
 */
const watchedDocuments = new WeakSet<Document>();

function dropUnnamedAnnouncements(records: MutationRecord[]) {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof Element) || node.getAttribute("role") !== "img") continue;
      if (node.closest("[data-live-announcer]") === null) continue;
      const labels = (node.getAttribute("aria-labelledby") ?? "").split(" ");
      if (labels.every((label) => node.ownerDocument.getElementById(label) === null)) {
        node.remove();
      }
    }
  }
}

function watchAnnouncements(page: Document) {
  if (watchedDocuments.has(page)) return;
  watchedDocuments.add(page);
  new MutationObserver(dropUnnamedAnnouncements).observe(page.body, {
    childList: true,
    subtree: true,
  });
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
  const ownId = useId();
  const id = props.id ?? ownId;
  useEffect(() => {
    watchAnnouncements(document);
    return () => forgetAnnouncements(id);
  }, [id]);
  return (
    <AriaButton
      {...props}
      id={id}
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
