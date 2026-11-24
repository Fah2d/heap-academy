"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { type DisplayNameProblem, parseDisplayName } from "@/domain/display-name";
import { profile as words } from "@/messages/profile";
import { Button, Notice, TextField } from "@/ui";

type Answer = { ok: true } | { ok: false; error: string };

/** The display name, edited in place (docs/spec/03-experience.md section 5.5; FR-PRF-02). */
export function DisplayName({
  name,
  updateProfile,
}: {
  name: string;
  updateProfile: (input: { displayName: string }) => Promise<Answer>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  // Set on leaving the form, so focus returns to the button that opened it.
  const [closed, setClosed] = useState(false);
  const [draft, setDraft] = useState(name);
  const [problem, setProblem] = useState<DisplayNameProblem | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    setDraft(name);
    setProblem(null);
    setFailure(null);
    setEditing(true);
  }

  function close() {
    setEditing(false);
    setClosed(true);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = parseDisplayName(draft);
    if (!parsed.ok) {
      setProblem(parsed.problem);
      return;
    }
    setFailure(null);
    startTransition(async () => {
      let answer: Answer;
      try {
        answer = await updateProfile({ displayName: parsed.value });
      } catch {
        answer = { ok: false, error: "unavailable" };
      }
      if (!answer.ok) {
        setFailure(answer.error === "not_signed_in" ? words.signedOut : words.saveFailed);
        return;
      }
      router.refresh();
      close();
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-base break-words text-text-muted">{name}</p>
        <Button variant="secondary" onPress={open} autoFocus={closed}>
          {words.changeName}
        </Button>
      </div>
    );
  }
  return (
    <form noValidate onSubmit={save} className="flex max-inline-prose flex-col items-start gap-3">
      <TextField
        label={words.nameLabel}
        value={draft}
        onChange={(value) => {
          setDraft(value);
          setProblem(null);
        }}
        autoFocus
        autoComplete="nickname"
        {...(problem === null
          ? { isInvalid: false as const }
          : { isInvalid: true as const, errorMessage: words.nameProblem[problem] })}
      />
      {failure !== null && (
        <Notice kind="error" kindLabel={words.errorLabel} announce="assertive">
          {failure}
        </Notice>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" isPending={pending}>
          {pending ? words.savingName : words.saveName}
        </Button>
        <Button variant="secondary" onPress={close} isDisabled={pending}>
          {words.cancel}
        </Button>
      </div>
    </form>
  );
}
