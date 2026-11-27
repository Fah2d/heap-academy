import type { ReactNode } from "react";
import { cx } from "../class-names";
import { CheckmarkFilled, CircleDash, ErrorFilled } from "../icons";

/** `next` marks the one item to do next, such as the next lesson of a course. */
export type StatusState = "pass" | "fail" | "not-run" | "next";

export type StatusProps = {
  state: StatusState;
  /** The word that names the state: "Passed", "Failed", "Not run", "Next up". */
  label: string;
};

// Pass and fail carry an icon and a word; color is never the only signal.
// The next item has no icon of its own (DESIGN.md section 8 lists none): its
// row carries the current-item marker, and the word says the rest.
const looks: Record<StatusState, { icon: ReactNode | null; tone: string }> = {
  pass: { icon: <CheckmarkFilled size={16} />, tone: "text-pass" },
  fail: { icon: <ErrorFilled size={16} />, tone: "text-fail" },
  "not-run": { icon: <CircleDash size={16} />, tone: "text-text-muted" },
  next: { icon: null, tone: "text-text" },
};

export function Status({ state, label }: StatusProps) {
  const { icon, tone } = looks[state];
  return (
    <span className={cx("inline-flex items-center gap-2 text-sm font-medium", tone)}>
      {icon !== null && (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      )}
      {label}
    </span>
  );
}
