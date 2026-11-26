"use client";

import { type FormEvent, useState, useTransition } from "react";
import { deviceProgress } from "@/features/progress";
import { profile as words } from "@/messages/profile";
import { Button, Dialog, DialogActions, Notice, TextField } from "@/ui";

type Answer = { ok: true } | { ok: false; error: string };

export type DeleteAccountActions = {
  deleteAccount: (input: { confirmation: string }) => Promise<Answer>;
  /** Ends the session on this device and goes home. */
  signOut: () => Promise<void>;
};

function failureWords(error: string): string {
  if (error === "sign_in_again") return words.deleteSignInAgain;
  if (error === "not_signed_in") return words.deleteSignedOut;
  return words.deleteFailed;
}

/** "Delete my account", confirmed by typing (FR-PRF-03; J-10). */
export function DeleteAccount({ deleteAccount, signOut }: DeleteAccountActions) {
  return (
    <Dialog
      trigger={<Button variant="destructive">{words.deleteAccount}</Button>}
      title={words.deleteTitle}
    >
      {(close) => <Confirm close={close} deleteAccount={deleteAccount} signOut={signOut} />}
    </Dialog>
  );
}

function Confirm({ close, deleteAccount, signOut }: DeleteAccountActions & { close: () => void }) {
  const [draft, setDraft] = useState("");
  const [mistyped, setMistyped] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm(event: FormEvent) {
    event.preventDefault();
    if (pending || deleted) return;
    if (draft !== words.deleteWord) {
      setMistyped(true);
      return;
    }
    setFailure(null);
    startTransition(async () => {
      let answer: Answer;
      try {
        answer = await deleteAccount({ confirmation: draft });
      } catch {
        answer = { ok: false, error: "unavailable" };
      }
      if (!answer.ok) {
        setFailure(failureWords(answer.error));
        return;
      }
      setDeleted(true);
      // As at sign-out: the next account here must not take these as its own.
      await deviceProgress().clear();
      await signOut();
    });
  }

  if (deleted) {
    return (
      <p role="status" className="text-base text-text">
        {words.deleted}
      </p>
    );
  }
  return (
    <form noValidate onSubmit={confirm} className="flex flex-col gap-4">
      <p className="text-base text-text">{words.deleteWarning}</p>
      <TextField
        label={words.confirmLabel}
        value={draft}
        onChange={(value) => {
          setDraft(value);
          setMistyped(false);
        }}
        autoFocus
        autoComplete="off"
        {...(mistyped
          ? { isInvalid: true as const, errorMessage: words.confirmProblem }
          : { isInvalid: false as const })}
      />
      {failure !== null && (
        <Notice kind="error" kindLabel={words.errorLabel} announce="assertive">
          {failure}
        </Notice>
      )}
      <DialogActions>
        <Button variant="secondary" surface="raised" onPress={close} isDisabled={pending}>
          {words.cancel}
        </Button>
        <Button type="submit" variant="destructive" surface="raised" isPending={pending}>
          {pending ? words.deleting : words.deleteAccount}
        </Button>
      </DialogActions>
    </form>
  );
}
