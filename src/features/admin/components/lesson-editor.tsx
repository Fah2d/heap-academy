"use client";

import { type FormEvent, type ReactNode, useId, useRef, useState, useTransition } from "react";
import type { LessonDocument } from "@/content/markdown";
import {
  checkLessonFields,
  LESSON_LIMITS,
  type LessonDraft,
  type LessonField,
  type LessonFields,
} from "@/domain/admin/lesson-details";
import { CodeEditor } from "@/features/workspace";
import { lessonEditor as words, structure } from "@/messages/admin";
import { Button, Notice, SelectField, TextArea, TextField } from "@/ui";
import type { AdminAction, EditorLessonDetail } from "../types";
import { InstructionsPreview, type RenderPreview } from "./instructions-preview";
import { useLeaveWarning } from "./leave-warning";
import { settle } from "./structure-controls";

// The lesson editor (docs/spec/03-experience.md section 7.4; FR-ADM-04,
// FR-ADM-10): Details, Instructions with a live preview and hints, and Code
// with the starter, the solution and the wrong answers, on one page with a
// side list that jumps between them. A top bar shows the status, whether
// anything is unsaved, and Save. Leaving with unsaved changes asks first. A
// save names the version the editor loaded and is refused over a newer one.

export type SaveLessonInput = { id: string; loadedAt: string; draft: LessonDraft };
export type SaveLesson = AdminAction<SaveLessonInput, { updatedAt: string }>;

type WrongAnswerRow = { key: number; label: string; code: string };
type EditorFields = Omit<LessonFields, "wrongAnswers"> & { wrongAnswers: WrongAnswerRow[] };
type Invalid = { field: LessonField; index?: number }[];

/** The five hint lines the form shows, filled from the saved hints. */
export function hintLines(hints: readonly string[]): string[] {
  return Array.from({ length: LESSON_LIMITS.hints }, (_, index) => hints[index] ?? "");
}

function fieldsOf(lesson: EditorLessonDetail): EditorFields {
  return {
    chapterId: lesson.chapterId,
    title: lesson.title,
    slug: lesson.slug,
    xp: String(lesson.xp),
    instructionsMd: lesson.instructionsMd,
    hints: hintLines(lesson.hints),
    starterCode: lesson.starterCode,
    solutionCode: lesson.solutionCode,
    wrongAnswers: lesson.wrongAnswers.map((answer, index) => ({ key: index, ...answer })),
  };
}

/** The fields as text, to tell whether anything differs from what was saved. */
const snapshot = (fields: EditorFields) =>
  JSON.stringify({
    ...fields,
    wrongAnswers: fields.wrongAnswers.map(({ label, code }) => ({ label, code })),
  });

const FAILURES = Object.keys(words.failure) as (keyof typeof words.failure)[];
const failureText = (error: string) =>
  words.failure[FAILURES.find((key) => key === error) ?? "unavailable"];

export const LESSON_SECTIONS = [
  { id: "lesson-details", title: words.detailsHeading },
  { id: "lesson-instructions", title: words.instructionsHeading },
  { id: "lesson-code", title: words.codeHeading },
] as const;

export type LessonEditorProps = {
  lesson: EditorLessonDetail;
  initialPreview: LessonDocument;
  nonce: string;
  save: SaveLesson;
  renderPreview: RenderPreview;
};

export function LessonEditor({
  lesson,
  initialPreview,
  nonce,
  save,
  renderPreview,
}: LessonEditorProps) {
  const [fields, setFields] = useState<EditorFields>(() => fieldsOf(lesson));
  const [saved, setSaved] = useState(() => snapshot(fieldsOf(lesson)));
  const [loadedAt, setLoadedAt] = useState(lesson.loadedAt);
  const [invalid, setInvalid] = useState<Invalid>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [savedNow, setSavedNow] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const nextKey = useRef(lesson.wrongAnswers.length);
  const ids = {
    starter: useId(),
    solution: useId(),
    hints: useId(),
    wrong: useId(),
  };

  const unsaved = snapshot(fields) !== saved;
  useLeaveWarning(unsaved, words.unsavedWarning);
  // "Saved" stays only until the next edit.
  const showSaved = savedNow && !unsaved;

  const isInvalid = (field: LessonField, index?: number) =>
    invalid.some((entry) => entry.field === field && entry.index === index);
  const edit = (next: Partial<EditorFields>) => setFields((current) => ({ ...current, ...next }));
  const editAnswer = (key: number, next: Partial<WrongAnswerRow>) =>
    setFields((current) => ({
      ...current,
      wrongAnswers: current.wrongAnswers.map((row) =>
        row.key === key ? { ...row, ...next } : row,
      ),
    }));

  function focusFirstInvalid() {
    requestAnimationFrame(() =>
      form.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus(),
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    setSavedNow(false);
    const checked = checkLessonFields(fields);
    if (!checked.ok) {
      setInvalid(checked.invalid);
      focusFirstInvalid();
      return;
    }
    setInvalid([]);
    const { draft } = checked;
    startTransition(async () => {
      const outcome = await settle(() => save({ id: lesson.id, loadedAt, draft }));
      if (!outcome.ok) {
        if (outcome.error === "slug_taken") {
          setInvalid([{ field: "slug" }]);
          setFailure(failureText("slug_taken"));
          focusFirstInvalid();
          return;
        }
        setFailure(failureText(outcome.error));
        return;
      }
      const clean: EditorFields = {
        ...fields,
        title: draft.title,
        hints: hintLines(draft.hints),
        wrongAnswers: fields.wrongAnswers.map((row, index) => ({
          ...row,
          label: draft.wrongAnswers[index]?.label ?? row.label,
        })),
      };
      setFields(clean);
      setSaved(snapshot(clean));
      setLoadedAt(outcome.value.updatedAt);
      setSavedNow(true);
    });
  }

  const stale = failure === words.failure.stale;
  return (
    <form ref={form} noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="sticky inset-bs-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-border bg-bg py-3">
        <p className="text-base text-text">
          <span className="text-text-muted">{words.statusLabel}: </span>
          {words.statusNow[lesson.status]}
          <span aria-hidden="true" className="text-text-muted">
            {" · "}
          </span>
          <span className={unsaved ? "font-medium text-text" : "text-text-muted"}>
            {unsaved ? words.unsaved : words.allSaved}
          </span>
        </p>
        <Button type="submit" variant="primary" isPending={pending}>
          {pending ? words.saving : words.save}
        </Button>
      </div>

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
      <p role="status" className={showSaved ? "text-sm text-text-muted" : "sr-only"}>
        {showSaved ? words.saved : ""}
      </p>

      <div className="flex gap-8">
        <nav aria-label={words.sectionsLabel} className="sticky inset-bs-20 shrink-0 self-start">
          <ul className="flex flex-col gap-1">
            {LESSON_SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-flex min-h-target items-center text-base text-text-muted underline-offset-(--link-underline-offset) hover:text-text hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <section aria-labelledby="lesson-details" className="flex max-w-prose flex-col gap-5">
            <h2 id="lesson-details" className="scroll-mbs-20 text-lg font-semibold text-text">
              {words.detailsHeading}
            </h2>
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
              onChange={(slug) => edit({ slug })}
              isInvalid={isInvalid("slug")}
              errorMessage={
                failure === words.failure.slug_taken
                  ? words.failure.slug_taken
                  : words.fieldInvalid.slug
              }
            />
            <SelectField
              label={words.chapterLabel}
              description={words.chapterHint}
              value={fields.chapterId}
              options={lesson.chapters.map((chapter) => ({
                value: chapter.id,
                label: chapter.title,
              }))}
              onChange={(chapterId) => edit({ chapterId })}
            />
            <TextField
              label={words.xpLabel}
              description={words.xpHint}
              inputMode="numeric"
              value={fields.xp}
              onChange={(xp) => edit({ xp })}
              isInvalid={isInvalid("xp")}
              errorMessage={words.fieldInvalid.xp}
            />
          </section>

          <section aria-labelledby="lesson-instructions" className="flex flex-col gap-5">
            <h2 id="lesson-instructions" className="scroll-mbs-20 text-lg font-semibold text-text">
              {words.instructionsHeading}
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <TextArea
                label={words.instructionsLabel}
                description={words.instructionsHint}
                mono
                rows={20}
                value={fields.instructionsMd}
                onChange={(instructionsMd) => edit({ instructionsMd })}
                isInvalid={isInvalid("instructionsMd")}
                errorMessage={words.fieldInvalid.instructionsMd}
              />
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="text-base font-medium text-text">{words.previewHeading}</h3>
                <p className="text-sm text-text-muted">{words.previewDescription}</p>
                <InstructionsPreview
                  markdown={fields.instructionsMd}
                  initial={initialPreview}
                  render={renderPreview}
                />
              </div>
            </div>
            <fieldset aria-describedby={ids.hints} className="flex max-w-prose flex-col gap-4">
              <legend className="pbe-1 text-base font-medium text-text">{words.hintsLabel}</legend>
              <p id={ids.hints} className="text-sm text-text-muted">
                {words.hintsHint}
              </p>
              {fields.hints.map((line, index) => (
                <TextField
                  // The five lines never move, so their place is their identity.
                  key={index}
                  label={words.hintLabel(index + 1)}
                  value={line}
                  onChange={(value) =>
                    edit({ hints: fields.hints.map((old, at) => (at === index ? value : old)) })
                  }
                  isInvalid={isInvalid("hint", index)}
                  errorMessage={words.fieldInvalid.hint}
                />
              ))}
            </fieldset>
          </section>

          <section aria-labelledby="lesson-code" className="flex flex-col gap-5">
            <h2 id="lesson-code" className="scroll-mbs-20 text-lg font-semibold text-text">
              {words.codeHeading}
            </h2>
            {lesson.status === "published" && (
              <Notice kind="information" kindLabel={words.statusNow.published}>
                {words.publishedCodeNote}
              </Notice>
            )}
            <p className="text-sm text-text-muted">{words.testCount(lesson.testCount)}</p>
            <div className="grid grid-cols-2 gap-6">
              <CodeField
                id={ids.starter}
                label={words.starterLabel}
                hint={words.starterHint}
                invalid={isInvalid("starterCode") ? words.fieldInvalid.starterCode : undefined}
              >
                <CodeEditor
                  labelledBy={ids.starter}
                  nonce={nonce}
                  value={fields.starterCode}
                  onChange={(starterCode) => edit({ starterCode })}
                />
              </CodeField>
              <CodeField
                id={ids.solution}
                label={words.solutionLabel}
                hint={words.solutionHint}
                invalid={isInvalid("solutionCode") ? words.fieldInvalid.solutionCode : undefined}
              >
                <CodeEditor
                  labelledBy={ids.solution}
                  nonce={nonce}
                  value={fields.solutionCode}
                  onChange={(solutionCode) => edit({ solutionCode })}
                />
              </CodeField>
            </div>
            <fieldset aria-describedby={ids.wrong} className="flex flex-col gap-5">
              <legend className="pbe-1 text-base font-medium text-text">
                {words.wrongAnswersLabel}
              </legend>
              <p id={ids.wrong} className="max-w-prose text-sm text-text-muted">
                {words.wrongAnswersHint}
              </p>
              {fields.wrongAnswers.length === 0 && (
                <p className="text-sm text-text-muted">{words.wrongAnswersEmpty}</p>
              )}
              {fields.wrongAnswers.map((row, index) => (
                <WrongAnswer
                  key={row.key}
                  number={index + 1}
                  row={row}
                  nonce={nonce}
                  labelInvalid={isInvalid("wrongAnswerLabel", index)}
                  codeInvalid={isInvalid("wrongAnswerCode", index)}
                  onChange={(next) => editAnswer(row.key, next)}
                  onRemove={() =>
                    edit({
                      wrongAnswers: fields.wrongAnswers.filter((other) => other.key !== row.key),
                    })
                  }
                />
              ))}
              {fields.wrongAnswers.length < LESSON_LIMITS.wrongAnswers && (
                <div>
                  <Button
                    variant="secondary"
                    onPress={() => {
                      const key = nextKey.current;
                      nextKey.current += 1;
                      edit({
                        wrongAnswers: [...fields.wrongAnswers, { key, label: "", code: "" }],
                      });
                    }}
                  >
                    {words.addWrongAnswer}
                  </Button>
                </div>
              )}
            </fieldset>
          </section>
        </div>
      </div>
    </form>
  );
}

/** A code editor with its visible label, hint and error, as a text field has them. */
function CodeField({
  id,
  label,
  hint,
  invalid,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  invalid: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span id={id} className="text-base font-medium text-text">
        {label}
      </span>
      <p className="text-sm text-text-muted">{hint}</p>
      <div aria-invalid={invalid === undefined ? undefined : true}>{children}</div>
      {invalid !== undefined && <p className="text-sm text-fail">{invalid}</p>}
    </div>
  );
}

function WrongAnswer({
  number,
  row,
  nonce,
  labelInvalid,
  codeInvalid,
  onChange,
  onRemove,
}: {
  number: number;
  row: WrongAnswerRow;
  nonce: string;
  labelInvalid: boolean;
  codeInvalid: boolean;
  onChange: (next: Partial<WrongAnswerRow>) => void;
  onRemove: () => void;
}) {
  const codeId = useId();
  return (
    <div className="flex flex-col gap-3 rounded-panel border border-border p-4">
      <TextField
        label={words.wrongAnswerLabel(number)}
        value={row.label}
        onChange={(label) => onChange({ label })}
        isInvalid={labelInvalid}
        errorMessage={words.fieldInvalid.wrongAnswerLabel}
      />
      <CodeField
        id={codeId}
        label={words.wrongAnswerCodeLabel(number)}
        hint=""
        invalid={codeInvalid ? words.fieldInvalid.wrongAnswerCode : undefined}
      >
        <CodeEditor
          labelledBy={codeId}
          nonce={nonce}
          value={row.code}
          onChange={(code) => onChange({ code })}
        />
      </CodeField>
      <div>
        <Button
          variant="destructive"
          aria-label={words.removeWrongAnswer(number)}
          onPress={onRemove}
        >
          {words.removeShort}
        </Button>
      </div>
    </div>
  );
}
