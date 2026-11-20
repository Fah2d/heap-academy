"use client";

import { Label, ProgressBar } from "react-aria-components";

export type ProgressProps = {
  label: string;
  value: number;
  maxValue: number;
  /** The value in words, always shown: "3 of 12 lessons", "2.7 of 5.5 MB". */
  valueLabel: string;
};

/** A determinate bar. It always carries a text value (DESIGN.md section 4.5). */
export function Progress({ label, value, maxValue, valueLabel }: ProgressProps) {
  return (
    <ProgressBar
      value={value}
      maxValue={maxValue}
      valueLabel={valueLabel}
      className="flex w-full flex-col gap-2"
    >
      {({ percentage }) => (
        <>
          <div className="flex items-baseline justify-between gap-4">
            <Label className="text-base font-medium text-text">{label}</Label>
            <span className="text-sm text-text-muted tabular-nums">{valueLabel}</span>
          </div>
          <div className="h-2 w-full overflow-hidden bg-surface-hover">
            <div
              className="h-full bg-action transition-all"
              style={{ inlineSize: `${percentage ?? 0}%` }}
            />
          </div>
        </>
      )}
    </ProgressBar>
  );
}
