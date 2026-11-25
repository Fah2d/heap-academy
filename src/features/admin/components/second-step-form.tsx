"use client";

import { type FormEvent, useRef, useState, useTransition } from "react";
import { ADMIN_PATHS } from "@/domain/admin/gate";
import { secondStep as words } from "@/messages/admin";
import { Button, Notice, TextField } from "@/ui";
import type { ActionOutcome } from "../types";

// The code field of /admin/setup and /admin/verify (docs/spec/03-experience.md
// section 7.1, FR-ADM-02). States: checking, wrong code, too many tries,
// setup replaced, service down. On success the session is at aal2 and the
// dashboard opens.

export type SecondStepAction = (input: { code: string }) => Promise<ActionOutcome<null>>;

export type SecondStepFormProps = {
  action: SecondStepAction;
  submitLabel: string;
  /** Moves focus to the field on load; the verify page has nothing before it. */
  autoFocus?: boolean;
  navigate?: (path: string) => void;
};

function failureText(error: string): string {
  switch (error) {
    case "code_rejected":
      return words.codeRejected;
    case "rate_limited":
      return words.tooManyAttempts;
    case "setup_replaced":
      return words.setupReplaced;
    default:
      return words.unavailable;
  }
}

export function SecondStepForm({
  action,
  submitLabel,
  autoFocus = false,
  navigate = (path) => window.location.assign(path),
}: SecondStepFormProps) {
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldArea = useRef<HTMLDivElement>(null);
  // The button is disabled while a code is checked, so focus goes back to the
  // field for the next code.
  const focusField = () => fieldArea.current?.querySelector("input")?.focus();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const digits = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(digits)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    startTransition(async () => {
      let result: ActionOutcome<null>;
      try {
        result = await action({ code: digits });
      } catch {
        // The action could not be reached; the person sees the provider-down
        // state. No client error reporter exists yet (WP-2.3 description).
        result = { ok: false, error: "unavailable" };
      }
      if (result.ok) {
        // A full load, so every server component reads the new aal2 session.
        navigate(ADMIN_PATHS.allow);
        return;
      }
      if (result.error === "invalid_input") {
        setInvalid(true);
        setFailure(null);
        focusField();
        return;
      }
      setCode("");
      setFailure(failureText(result.error));
      focusField();
    });
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <div ref={fieldArea}>
        <TextField
          label={words.codeLabel}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={32}
          value={code}
          onChange={(value) => {
            setCode(value);
            setInvalid(false);
          }}
          isInvalid={invalid}
          errorMessage={words.codeInvalid}
          autoFocus={autoFocus}
        />
      </div>
      {failure !== null && (
        <Notice kind="error" kindLabel={words.errorLabel} announce="assertive">
          {failure}
        </Notice>
      )}
      <Button type="submit" variant="primary" isDisabled={pending}>
        {pending ? words.checking : submitLabel}
      </Button>
    </form>
  );
}
