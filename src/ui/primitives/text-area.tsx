"use client";

import {
  FieldError,
  Label,
  Text,
  TextArea as AriaTextArea,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from "react-aria-components";
import { cx } from "../class-names";
import { ErrorFilled } from "../icons";

export type TextAreaProps = Omit<AriaTextFieldProps, "className" | "style" | "children"> & {
  /** The visible label. */
  label: string;
  description?: string;
  /** The sentence shown below the field when it is invalid. */
  errorMessage?: string;
  /** Visible lines before it scrolls. */
  rows?: number;
  /** For source text, such as Markdown: set in the monospace face. */
  mono?: boolean;
};

const area =
  "w-full rounded-control border border-border-control bg-bg px-3 py-2 text-base text-text transition-colors not-read-only:data-hovered:border-text-muted data-invalid:border-fail data-disabled:border-border data-disabled:bg-surface data-disabled:text-text-muted";

/** A text field of several lines, with the same states as `TextField` (DESIGN.md section 4.5). */
export function TextArea({
  label,
  description,
  errorMessage,
  rows = 6,
  mono = false,
  ...props
}: TextAreaProps) {
  return (
    <AriaTextField {...props} className="flex flex-col gap-2">
      <Label className="text-base font-medium text-text">{label}</Label>
      <AriaTextArea rows={rows} spellCheck={!mono} className={cx(area, mono && "font-mono")} />
      {description !== undefined && (
        <Text slot="description" className="text-sm text-text-muted">
          {description}
        </Text>
      )}
      <FieldError className="flex items-start gap-2 text-sm text-fail">
        <span aria-hidden="true" className="inline-flex pbs-1">
          <ErrorFilled size={16} />
        </span>
        <span>{errorMessage}</span>
      </FieldError>
    </AriaTextField>
  );
}
