import type { ReactNode } from "react";
import { cx } from "../class-names";
import { CheckmarkFilled, ErrorFilled, InformationFilled, WarningAltFilled } from "../icons";

export type NoticeKind = "information" | "warning" | "error" | "success";

export type NoticeProps = {
  kind: NoticeKind;
  /** The word for the kind, read before the sentence: "Warning", "Error". */
  kindLabel: string;
  children: ReactNode;
  /**
   * `polite` or `assertive` when the notice appears after the page loaded and
   * must be announced. A notice present on load is not announced.
   */
  announce?: "polite" | "assertive";
};

// The kind shows by icon and words, never by fill (DESIGN.md section 4.5).
// Warning has no hue of its own: amber is the accent.
const icons: Record<NoticeKind, { icon: ReactNode; tone: string }> = {
  information: { icon: <InformationFilled size={20} />, tone: "text-text" },
  warning: { icon: <WarningAltFilled size={20} />, tone: "text-text" },
  error: { icon: <ErrorFilled size={20} />, tone: "text-fail" },
  success: { icon: <CheckmarkFilled size={20} />, tone: "text-pass" },
};

export function Notice({ kind, kindLabel, children, announce }: NoticeProps) {
  const { icon, tone } = icons[kind];
  const role = announce === "assertive" ? "alert" : announce === "polite" ? "status" : undefined;
  return (
    <div
      role={role}
      className="flex items-start gap-3 rounded-panel border border-border-control bg-surface p-4 text-base text-text"
    >
      <span aria-hidden="true" className={cx("inline-flex shrink-0", tone)}>
        {icon}
      </span>
      <p>
        <span className="font-semibold">{kindLabel}: </span>
        {children}
      </p>
    </div>
  );
}
