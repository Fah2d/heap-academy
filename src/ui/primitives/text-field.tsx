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

type FieldProps = Omit<AriaTextFieldProps, "className" | "style" | "children" | "isInvalid"> & {
  /** The visible label. Placeholder text is never the only label. */
  label: string;
  description?: string;
  placeholder?: string;
};

/**
 * A field marked invalid by its owner carries the sentence that says why, so
 * it is never marked by color and an icon alone. A field made invalid by its
 * own validation (`isRequired`, `validate`) shows that validation's message
 * when `errorMessage` is not given.
 */
export type TextFieldProps = FieldProps &
  (
    | { isInvalid?: false; errorMessage?: string }
    | {
        isInvalid: true;
        /** The sentence shown below the field when it is invalid. */
        errorMessage: string;
      }
  );

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
        {({ validationErrors }) => {
          const sentence = errorMessage ?? validationErrors.join(" ");
          // No sentence, no icon: a lone icon would say "wrong" without saying why.
          if (sentence === "") return null;
          return (
            <>
              <span aria-hidden="true" className="inline-flex pbs-1">
                <ErrorFilled size={16} />
              </span>
              <span>{sentence}</span>
            </>
          );
        }}
      </FieldError>
    </AriaTextField>
  );
}
