import type { ReactNode } from "react";
import { cx } from "../class-names";
import { CheckmarkFilled, ErrorFilled, WarningAltFilled } from "../icons";
import { LiveRegion } from "./live-region";

export type NoticeKind = "information" | "warning" | "error" | "success";

export type NoticeProps = {
  kind: NoticeKind;
  /** The word for the kind, read before the sentence: "Warning", "Error". */
  kindLabel: string;
  children: ReactNode;
  /**
   * `polite` or `assertive` when the notice appears after the page loaded and
   * must be announced. Leave unset for a notice present on load: an announced
   * notice is drawn only after scripts run, one frame after its region.
   */
  announce?: "polite" | "assertive";
};

// The kind shows by icon and words, never by fill (DESIGN.md section 4.5).
// Warning has no hue of its own: amber is the accent. Information has no
// icon, because DESIGN.md section 8 lists none for it; its word names it.
const icons: Record<NoticeKind, { icon: ReactNode | null; tone: string }> = {
  information: { icon: null, tone: "text-text" },
  warning: { icon: <WarningAltFilled size={20} />, tone: "text-text" },
  error: { icon: <ErrorFilled size={20} />, tone: "text-fail" },
  success: { icon: <CheckmarkFilled size={20} />, tone: "text-pass" },
};

export function Notice({ kind, kindLabel, children, announce }: NoticeProps) {
  const { icon, tone } = icons[kind];
  const box = (
    <div className="flex items-start gap-3 rounded-panel border border-border-control bg-surface p-4 text-base text-text">
      {icon !== null && (
        <span aria-hidden="true" className={cx("inline-flex shrink-0", tone)}>
          {icon}
        </span>
      )}
      <p>
        <span className="font-semibold">{kindLabel}: </span>
        {children}
      </p>
    </div>
  );
  if (announce === undefined) return box;
  return <LiveRegion role={announce === "assertive" ? "alert" : "status"}>{box}</LiveRegion>;
}
