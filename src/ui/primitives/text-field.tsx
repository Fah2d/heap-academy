"use client";

import {
  FieldError,
  Input,
  Label,
  Text,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from "react-aria-components";
import { ErrorFilled } from "../icons";

export type TextFieldProps = Omit<AriaTextFieldProps, "className" | "style" | "children"> & {
  /** The visible label. Placeholder text is never the only label. */
  label: string;
  description?: string;
  placeholder?: string;
  /** The sentence shown below the field when it is invalid. */
  errorMessage?: string;
};

const input =
  "min-h-target w-full rounded-control border border-border-control bg-bg px-3 text-base text-text transition-colors placeholder:text-text-subtle not-read-only:data-hovered:border-text-muted data-invalid:border-fail data-disabled:border-border data-disabled:bg-surface data-disabled:text-text-muted read-only:border-border read-only:bg-surface";

export function TextField({
  label,
  description,
  placeholder,
  errorMessage,
  ...props
}: TextFieldProps) {
  return (
    <AriaTextField {...props} className="flex flex-col gap-2">
      <Label className="text-base font-medium text-text">{label}</Label>
      <Input className={input} {...(placeholder !== undefined && { placeholder })} />
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
