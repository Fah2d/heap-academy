"use client";

import { type FormEvent, useEffect, useId, useRef, useState, useTransition } from "react";
import type { LessonDocument } from "@/content/markdown";
import {
  checkLessonFields,
  LESSON_LIMITS,
  type LessonDraft,
  type LessonField,
  type LessonFields,
} from "@/domain/admin/lesson-details";
import { CodeEditor } from "@/features/workspace";
import type { TestCase, TestCaseId } from "@/grader/test-case";
import { testCaseProblems, type TestCaseProblem } from "@/grader/test-case-list";
import { lessonEditor as words, structure } from "@/messages/admin";
import { Button, FieldErrorMessage, Notice, SelectField, TextArea, TextField } from "@/ui";
import type { AdminAction, EditorLessonDetail } from "../types";
import { InstructionsPreview, type RenderPreview } from "./instructions-preview";
import { useLeaveWarning } from "./leave-warning";
import { settle } from "./structure-controls";
import { TestCaseList } from "./test-case-list";

// The lesson editor (docs/spec/03-experience.md section 7.4; FR-ADM-04,
// FR-ADM-05, FR-ADM-10): Details, Instructions with a live preview and
// hints, Code with the starter, the solution and the wrong answers, and the
// test cases, on one page with a side list that jumps between them. A top bar shows the status, whether
// anything is unsaved, and Save. Leaving with unsaved changes asks first. A
// save names the version the editor loaded and is refused over a newer one.

export type SaveLessonInput = {
  id: string;
  loadedAt: string;
  draft: LessonDraft;
  testCases: TestCase[];
};
export type SaveLesson = AdminAction<SaveLessonInput, { updatedAt: string }>;

type WrongAnswerRow = { key: number; label: string; code: string };
type EditorFields = Omit<LessonFields, "wrongAnswers"> & {
  wrongAnswers: WrongAnswerRow[];
  testCases: TestCase[];
};
type TestCaseProblems = ReadonlyMap<TestCaseId, readonly TestCaseProblem[]>;
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
    testCases: lesson.testCases,
  };
}

const sameLines = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((line, index) => line === b[index]);

/** The fields as text, to tell whether anything differs from what was saved. */
const snapshot = (fields: EditorFields) =>
  JSON.stringify({
    ...fields,
    wrongAnswers: fields.wrongAnswers.map(({ label, code }) => ({ label, code })),
  });

const FAILURES = Object.keys(words.failure) as (keyof typeof words.failure)[];
const failureText = (error: string) =>
  words.failure[FAILURES.find((key) => key === error) ?? "unavailable"];

/** The editor's sections, in order. Their IDs are made per editor, so two on a page never share one. */
export const LESSON_SECTIONS = [
  { key: "details", title: words.detailsHeading },
  { key: "instructions", title: words.instructionsHeading },
  { key: "code", title: words.codeHeading },
  { key: "testCases", title: words.testCasesHeading },
] as const;

export type LessonEditorProps = {
  lesson: EditorLessonDetail;
  initialPreview: LessonDocument;
  nonce: string;
  save: SaveLesson;
  renderPreview: RenderPreview;
  /** The ID of a new test case; random unless a test fixes it. */
  newTestCaseId?: () => string;
};

const randomTestCaseId = () => crypto.randomUUID();

export function LessonEditor({
  lesson,
  initialPreview,
  nonce,
  save,
  renderPreview,
  newTestCaseId = randomTestCaseId,
}: LessonEditorProps) {
  const [fields, setFields] = useState<EditorFields>(() => fieldsOf(lesson));
  const [saved, setSaved] = useState(() => snapshot(fieldsOf(lesson)));
  const [loadedAt, setLoadedAt] = useState(lesson.loadedAt);
  const [invalid, setInvalid] = useState<Invalid>([]);
  const [testProblems, setTestProblems] = useState<TestCaseProblems>(() => new Map());
  const [openTestCases, setOpenTestCases] = useState<ReadonlySet<string>>(() => new Set());
  const [failure, setFailure] = useState<string | null>(null);
  const [savedNow, setSavedNow] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const nextKey = useRef(lesson.wrongAnswers.length);
  const sectionPrefix = useId();
  const sectionId = (key: (typeof LESSON_SECTIONS)[number]["key"]) => `${sectionPrefix}${key}`;
  const ids = {
    hints: useId(),
    wrong: useId(),
  };
  // Where focus goes once the wrong answers re-render after an Add or a
  // Remove, so it never falls back to the page.
  const focusAfter = useRef<{ row: number } | "add" | null>(null);
  useEffect(() => {
    const target = focusAfter.current;
    if (target === null) return;
    focusAfter.current = null;
    const element =
      target === "add"
        ? form.current?.querySelector<HTMLElement>(`[data-add-wrong-answer] button`)
        : form.current?.querySelector<HTMLElement>(
            `[data-wrong-answer="${String(target.row)}"] input`,
          );
    element?.focus();
  }, [fields.wrongAnswers]);

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
    const { testCases, ...lessonFields } = fields;
    const checked = checkLessonFields({
      ...lessonFields,
      wrongAnswers: fields.wrongAnswers.map(({ label, code }) => ({ label, code })),
    });
    const problems = new Map(
      testCases.flatMap((testCase) => {
        const found = testCaseProblems(testCase);
        return found.length === 0 ? [] : [[testCase.id, found] as const];
      }),
    );
    setTestProblems(problems);
    if (!checked.ok || problems.size > 0) {
      setInvalid(checked.ok ? [] : checked.invalid);
      // A test case with a problem opens in the same render, so focus can reach its field.
      setOpenTestCases((current) => new Set([...current, ...problems.keys()]));
      focusFirstInvalid();
      return;
    }
    setInvalid([]);
    const { draft } = checked;
    const submitted = fields;
    startTransition(async () => {
      const outcome = await settle(() => save({ id: lesson.id, loadedAt, draft, testCases }));
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
      // What was saved, as the form shows it once tidied. The fields stayed
      // editable while the save was in flight, so a field is tidied only if
      // it still holds what was sent; anything typed since is kept, and the
      // editor goes on calling it unsaved.
      const clean: EditorFields = {
        ...submitted,
        title: draft.title,
        hints: hintLines(draft.hints),
        wrongAnswers: submitted.wrongAnswers.map((row, index) => ({
          ...row,
          label: draft.wrongAnswers[index]?.label ?? row.label,
        })),
      };
      setFields((current) => ({
        ...current,
        title: current.title === submitted.title ? clean.title : current.title,
        hints: sameLines(current.hints, submitted.hints) ? clean.hints : current.hints,
        wrongAnswers: current.wrongAnswers.map((row) => {
          const sent = submitted.wrongAnswers.find((entry) => entry.key === row.key);
          const tidy = clean.wrongAnswers.find((entry) => entry.key === row.key);
          return sent !== undefined && tidy !== undefined && row.label === sent.label
            ? { ...row, label: tidy.label }
            : row;
        }),
      }));
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

      {/* A taken address is said once, under its field. */}
      {failure !== null && failure !== words.failure.slug_taken && (
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
              <li key={section.key}>
                <a
                  href={`#${sectionId(section.key)}`}
                  className="inline-flex min-h-target items-center text-base text-text-muted underline-offset-(--link-underline-offset) hover:text-text hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <section
            aria-labelledby={sectionId("details")}
            className="flex max-w-prose flex-col gap-5"
          >
            <h2 id={sectionId("details")} className="scroll-mbs-20 text-lg font-semibold text-text">
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

          <section aria-labelledby={sectionId("instructions")} className="flex flex-col gap-5">
            <h2
              id={sectionId("instructions")}
              className="scroll-mbs-20 text-lg font-semibold text-text"
            >
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

          <section aria-labelledby={sectionId("code")} className="flex flex-col gap-5">
            <h2 id={sectionId("code")} className="scroll-mbs-20 text-lg font-semibold text-text">
              {words.codeHeading}
            </h2>
            {lesson.status === "published" && (
              <Notice kind="information" kindLabel={words.noteLabel}>
                {words.publishedCodeNote}
              </Notice>
            )}
            <div className="grid grid-cols-2 gap-6">
              <CodeField
                label={words.starterLabel}
                hint={words.starterHint}
                invalid={isInvalid("starterCode") ? words.fieldInvalid.starterCode : undefined}
                nonce={nonce}
                value={fields.starterCode}
                onChange={(starterCode) => edit({ starterCode })}
              />
              <CodeField
                label={words.solutionLabel}
                hint={words.solutionHint}
                invalid={isInvalid("solutionCode") ? words.fieldInvalid.solutionCode : undefined}
                nonce={nonce}
                value={fields.solutionCode}
                onChange={(solutionCode) => edit({ solutionCode })}
              />
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
                  onRemove={() => {
                    const rest = fields.wrongAnswers.filter((other) => other.key !== row.key);
                    const next = rest[index] ?? rest[index - 1];
                    focusAfter.current = next === undefined ? "add" : { row: next.key };
                    edit({ wrongAnswers: rest });
                  }}
                />
              ))}
              {fields.wrongAnswers.length < LESSON_LIMITS.wrongAnswers && (
                <div data-add-wrong-answer>
                  <Button
                    variant="secondary"
                    onPress={() => {
                      const key = nextKey.current;
                      nextKey.current += 1;
                      focusAfter.current = { row: key };
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

          <section aria-labelledby={sectionId("testCases")} className="flex flex-col gap-5">
            <h2
              id={sectionId("testCases")}
              className="scroll-mbs-20 text-lg font-semibold text-text"
            >
              {words.testCasesHeading}
            </h2>
            <TestCaseList
              testCases={fields.testCases}
              onChange={(testCases) => edit({ testCases })}
              problems={testProblems}
              expanded={openTestCases}
              onExpandedChange={(id, isOpen) =>
                setOpenTestCases((current) => {
                  const next = new Set(current);
                  if (isOpen) next.add(id);
                  else next.delete(id);
                  return next;
                })
              }
              newId={newTestCaseId}
            />
          </section>
        </div>
      </div>
    </form>
  );
}

/**
 * A code editor with its visible label, hint and error, in the order a text
 * field has them. The editor's text area carries the invalid state and is
 * described by the hint and the error, so focus lands on it and both are read.
 */
function CodeField({
  label,
  hint,
  invalid,
  nonce,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  invalid: string | undefined;
  nonce: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();
  const describedBy = [
    hint === undefined ? undefined : hintId,
    invalid === undefined ? undefined : errorId,
  ]
    .filter((id) => id !== undefined)
    .join(" ");
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span id={labelId} className="text-base font-medium text-text">
        {label}
      </span>
      <CodeEditor
        labelledBy={labelId}
        {...(describedBy === "" ? {} : { describedBy })}
        invalid={invalid !== undefined}
        nonce={nonce}
        value={value}
        onChange={onChange}
      />
      {hint !== undefined && (
        <p id={hintId} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
      {invalid !== undefined && <FieldErrorMessage id={errorId}>{invalid}</FieldErrorMessage>}
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
  return (
    <div
      data-wrong-answer={row.key}
      className="flex flex-col gap-3 rounded-panel border border-border p-4"
    >
      <TextField
        label={words.wrongAnswerLabel(number)}
        value={row.label}
        onChange={(label) => onChange({ label })}
        isInvalid={labelInvalid}
        errorMessage={words.fieldInvalid.wrongAnswerLabel}
      />
      <CodeField
        label={words.wrongAnswerCodeLabel(number)}
        invalid={codeInvalid ? words.fieldInvalid.wrongAnswerCode : undefined}
        nonce={nonce}
        value={row.code}
        onChange={(code) => onChange({ code })}
      />
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
