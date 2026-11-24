"use client";

import { type FormEvent, useEffect, useId, useRef, useState, useTransition } from "react";
import {
  type CourseDetails,
  type CourseField,
  type CourseFields,
  checkCourseFields,
  MAX_OUTCOMES,
} from "@/domain/admin/course-details";
import { courseEditor as words, structure } from "@/messages/admin";
import { Button, Notice, TextField } from "@/ui";
import type { AdminAction } from "../types";
import { useLeaveWarning } from "./leave-warning";
import { settle, structureFailureText } from "./structure-controls";

// The Details of a course (docs/spec/03-experience.md section 7.3, FR-ADM-03,
// FR-ADM-10): title, address, summary and up to five outcomes. Used to create
// a course and to edit one. While there are unsaved changes, leaving asks
// first. A save names the version the editor loaded and is refused when the
// course is newer, with a prompt to reload.

export type SaveCourseInput =
  { details: CourseDetails } | { id: string; loadedAt: string; details: CourseDetails };

export type SaveCourse = AdminAction<SaveCourseInput, { id: string; updatedAt?: string }>;

export type CourseDetailsFormProps = {
  /** The course being edited and the version loaded; absent when creating one. */
  course?: { id: string; loadedAt: string };
  initial: CourseFields;
  save: SaveCourse;
  /** An edit was saved: the course's new version. */
  onSaved?: (updatedAt: string) => void;
  /** A course was created: open its editor. */
  onCreated?: (id: string) => void;
  /**
   * Reports unsaved changes to a page that asks before leaving for all its
   * forms at once. Without it, the form asks by itself.
   */
  onUnsavedChange?: (unsaved: boolean) => void;
};

/** The five outcome lines the form shows, filled from the saved outcomes. */
export function outcomeLines(outcomes: readonly string[]): string[] {
  return Array.from({ length: MAX_OUTCOMES }, (_, index) => outcomes[index] ?? "");
}

const sameFields = (a: CourseFields, b: CourseFields) =>
  a.title === b.title &&
  a.slug === b.slug &&
  a.summary === b.summary &&
  a.outcomes.length === b.outcomes.length &&
  a.outcomes.every((line, index) => line === b.outcomes[index]);

function submitLabel(creating: boolean, pending: boolean): string {
  if (creating) return pending ? words.creating : words.create;
  return pending ? words.saving : words.save;
}

type Invalid = { field: CourseField; index?: number }[];

export function CourseDetailsForm({
  course,
  initial,
  save,
  onSaved,
  onCreated,
  onUnsavedChange,
}: CourseDetailsFormProps) {
  const start = { ...initial, outcomes: outcomeLines(initial.outcomes) };
  const [fields, setFields] = useState<CourseFields>(start);
  const [savedFields, setSavedFields] = useState<CourseFields>(start);
  const [invalid, setInvalid] = useState<Invalid>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [slugTaken, setSlugTaken] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const outcomesHintId = useId();

  const unsaved = !sameFields(fields, savedFields);
  const leave = useLeaveWarning(onUnsavedChange === undefined && unsaved, words.unsavedWarning);
  useEffect(() => {
    onUnsavedChange?.(unsaved);
  }, [unsaved, onUnsavedChange]);

  const isInvalid = (field: CourseField, index?: number) =>
    invalid.some((entry) => entry.field === field && entry.index === index);

  function edit(next: Partial<CourseFields>) {
    setFields((current) => ({ ...current, ...next }));
    setSaved(false);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    setStale(false);
    setSlugTaken(false);
    setSaved(false);
    const checked = checkCourseFields(fields);
    if (!checked.ok) {
      setInvalid(checked.invalid);
      // The first field marked invalid takes focus, so its message is read.
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLInputElement>("input[aria-invalid='true']")?.focus(),
      );
      return;
    }
    setInvalid([]);
    const { details } = checked;
    startTransition(async () => {
      const outcome = await settle(() =>
        save(course === undefined ? { details } : { ...course, details }),
      );
      if (!outcome.ok) {
        if (outcome.error === "slug_taken") {
          // The Address field's own error, where the owner fixes it.
          setSlugTaken(true);
          requestAnimationFrame(() =>
            form.current?.querySelector<HTMLInputElement>("input[aria-invalid='true']")?.focus(),
          );
          return;
        }
        setStale(outcome.error === "stale");
        setFailure(structureFailureText(outcome.error));
        return;
      }
      if (course === undefined) {
        // The new course's editor opens; nothing is left unsaved here.
        leave.release();
        onCreated?.(outcome.value.id);
        return;
      }
      const clean = { ...details, outcomes: outcomeLines(details.outcomes) };
      setFields(clean);
      setSavedFields(clean);
      setSaved(true);
      if (outcome.value.updatedAt !== undefined) onSaved?.(outcome.value.updatedAt);
    });
  }

  const creating = course === undefined;
  return (
    <form ref={form} noValidate onSubmit={onSubmit} className="flex max-w-prose flex-col gap-5">
      <TextField
        label={words.titleLabel}
        description={words.titleHint}
        value={fields.title}
        onChange={(title) => edit({ title })}
        isInvalid={isInvalid("title")}
        errorMessage={words.fieldInvalid.title}
      />
      <TextField
        label={words.slugLabel}
        description={words.slugHint}
        value={fields.slug}
        onChange={(slug) => {
          setSlugTaken(false);
          edit({ slug });
        }}
        isInvalid={slugTaken || isInvalid("slug")}
        errorMessage={slugTaken ? structure.failure.slug_taken : words.fieldInvalid.slug}
      />
      <TextField
        label={words.summaryLabel}
        description={words.summaryHint}
        value={fields.summary}
        onChange={(summary) => edit({ summary })}
        isInvalid={isInvalid("summary")}
        errorMessage={words.fieldInvalid.summary}
      />
      <fieldset aria-describedby={outcomesHintId} className="flex flex-col gap-4">
        <legend className="pbe-1 text-base font-medium text-text">{words.outcomesLabel}</legend>
        <p id={outcomesHintId} className="text-sm text-text-muted">
          {words.outcomesHint}
        </p>
        {fields.outcomes.map((line, index) => (
          <TextField
            // The five lines never move, so their place is their identity.
            key={index}
            label={words.outcomeLabel(index + 1)}
            value={line}
            onChange={(value) =>
              edit({ outcomes: fields.outcomes.map((old, at) => (at === index ? value : old)) })
            }
            isInvalid={isInvalid("outcome", index)}
            errorMessage={words.fieldInvalid.outcome}
          />
        ))}
      </fieldset>
      {failure !== null && (
        <div className="flex flex-col gap-3">
          <Notice kind="error" kindLabel={structure.errorLabel} announce="assertive">
            {failure}
          </Notice>
          {stale && (
            <div>
              <Button variant="secondary" onPress={() => window.location.reload()}>
                {structure.reload}
              </Button>
            </div>
          )}
        </div>
      )}
      {/* Kept in the page for the live region, and out of the layout while empty. */}
      <p role="status" className={saved ? "text-sm text-text-muted" : "sr-only"}>
        {saved ? words.saved : ""}
      </p>
      <div>
        <Button type="submit" variant="primary" isPending={pending}>
          {submitLabel(creating, pending)}
        </Button>
      </div>
    </form>
  );
}
