"use client";

import { type FormEvent, useState, useTransition } from "react";
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
        result = { ok: false, error: "unavailable" };
      }
      if (result.ok) {
        // A full load, so every server component reads the new aal2 session.
        navigate("/admin");
        return;
      }
      if (result.error === "invalid_input") {
        setInvalid(true);
        setFailure(null);
        return;
      }
      setCode("");
      setFailure(failureText(result.error));
    });
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
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
