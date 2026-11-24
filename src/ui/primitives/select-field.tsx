"use client";

import { useId } from "react";

export type SelectOption = { value: string; label: string };

export type SelectFieldProps = {
  /** The visible label. */
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  description?: string;
  isDisabled?: boolean;
};

const select =
  "min-h-target w-full rounded-control border border-border-control bg-bg px-3 text-base text-text transition-colors hover:border-text-muted disabled:border-border disabled:bg-surface disabled:text-text-muted";

/**
 * A choice from a short list, as the browser's own select: every keyboard,
 * screen reader and phone already knows how to use it (DESIGN.md section 4.5,
 * the text field's states).
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  description,
  isDisabled = false,
}: SelectFieldProps) {
  const id = useId();
  const descriptionId = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-medium text-text">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={isDisabled}
        aria-describedby={description === undefined ? undefined : descriptionId}
        onChange={(event) => onChange(event.target.value)}
        className={select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {description !== undefined && (
        <p id={descriptionId} className="text-sm text-text-muted">
          {description}
        </p>
      )}
    </div>
  );
}
