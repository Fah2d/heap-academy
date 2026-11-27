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

type FieldProps = Omit<
  AriaTextFieldProps,
  "className" | "style" | "children" | "isInvalid" | "validate" | "validationBehavior"
> & {
  /** The visible label. Placeholder text is never the only label. */
  label: string;
  description?: string;
  placeholder?: string;
  /**
   * The sentence that says why the value is wrong, or nothing when it is
   * right. React Aria also accepts `true` (invalid, no reason); this type
   * does not.
   */
  validate?: (value: string) => string | null | undefined;
};

/**
 * An invalid field always carries the sentence that says why, so it is never
 * marked by color alone (DESIGN.md sections 4.2 and 4.5):
 *
 * - A field its owner marks invalid must be given `errorMessage`.
 * - A field made invalid by `validate` shows the sentence `validate` returns.
 * - Validation is React Aria's `aria` behavior, so `isRequired` only marks the
 *   field required and never adds the browser's message ("Please fill out
 *   this field."). The sentence for an empty required field comes from
 *   `validate` or from the owner. The browser still checks `type`, `pattern`
 *   and `minLength` when a form without `noValidate` is submitted; the form
 *   primitive that sets it comes with the first form.
 *
 * An invalid field with an empty sentence is a programming error and throws.
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

/** Thrown for an invalid field with no sentence; a test names it. */
export const INVALID_WITHOUT_SENTENCE =
  "TextField: an invalid field needs a sentence that says why (DESIGN.md section 4.5).";

const input =
  "min-h-target w-full rounded-control border border-border-control bg-bg px-3 text-base text-text transition-colors placeholder:text-text-subtle not-read-only:data-hovered:border-text-muted data-invalid:border-fail data-invalid:data-hovered:border-fail data-disabled:border-border data-disabled:bg-surface data-disabled:text-text-muted read-only:border-border read-only:bg-surface";

export function TextField({
  label,
  description,
  placeholder,
  errorMessage,
  ...props
}: TextFieldProps) {
  return (
    <AriaTextField {...props} validationBehavior="aria" className="flex flex-col gap-2">
      <Label className="text-base font-medium text-text">{label}</Label>
      <Input className={input} {...(placeholder !== undefined && { placeholder })} />
      {description !== undefined && (
        <Text slot="description" className="text-sm text-text-muted">
          {description}
        </Text>
      )}
      <FieldError className="flex items-start gap-2 text-sm text-fail">
        {({ validationErrors }) => {
          const sentence = (errorMessage ?? validationErrors.join(" ")).trim();
          // FieldError renders only while the field is invalid, so an empty
          // sentence here would leave a red border that does not say why.
          if (sentence === "") throw new Error(INVALID_WITHOUT_SENTENCE);
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
