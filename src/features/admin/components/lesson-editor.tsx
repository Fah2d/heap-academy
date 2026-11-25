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
import { adminLessonPreviewPath } from "@/domain/admin/gate";
import type { ContentStatus } from "@/domain/admin/structure";
import { CodeEditor } from "@/features/workspace";
import type { TestCase, TestCaseId } from "@/grader/test-case";
import { testCaseProblems, type TestCaseProblem } from "@/grader/test-case-list";
import { lessonStatus, lessonEditor as words, structure } from "@/messages/admin";
import { Button, FieldErrorMessage, Link, Notice, SelectField, TextArea, TextField } from "@/ui";
import { validateLessonContent, type ValidationContent } from "../client/validate-lesson";
import {
  openBrowserValidationRuntime,
  type OpenValidationRuntime,
  type PythonState,
  type ValidationRuntime,
} from "../client/validation-runtime";
import type { ActionOutcome, AdminAction, EditorLessonDetail } from "../types";
import {
  checkedNow,
  solutionViews,
  validatedHashFor,
  type ValidationState,
} from "../validation-view";
import { useFocusAfterCommit } from "./focus-after-commit";
import { InstructionsPreview, type RenderPreview } from "./instructions-preview";
import { useLeaveWarning } from "./leave-warning";
import { LessonStatusControls, type SetLessonStatus } from "./lesson-status";
import { settle } from "./structure-controls";
import { TestCaseList } from "./test-case-list";
import { ValidationPanel } from "./validation-panel";

// The lesson editor (docs/spec/03-experience.md section 7.4; FR-ADM-04,
// FR-ADM-05, FR-ADM-10): Details, Instructions with a live preview and
// hints, Code with the starter, the solution and the wrong answers, the test
// cases, and Publish with the checklist (FR-ADM-06, FR-ADM-07) and the
// status (FR-ADM-09), on one page with a side list that jumps between them.
// A top bar shows the status, whether anything is unsaved, and Save. Leaving
// with unsaved changes asks first. A save names the version the editor
// loaded and is refused over a newer one; it carries the validated hash only
// when the last validation passed for exactly the gradable content it saves.
// On a published lesson Save validates first, and Publish saves first
// (section 7.6).

export type SaveLessonInput = {
  id: string;
  loadedAt: string;
  draft: LessonDraft;
  testCases: TestCase[];
  /** The hash of the gradable content a passing validation checked (section 4.2). */
  validatedHash?: string;
};
export type SaveLesson = AdminAction<SaveLessonInput, { updatedAt: string }>;

type WrongAnswerRow = { key: number; label: string; code: string };
type EditorFields = Omit<LessonFields, "wrongAnswers"> & {
  wrongAnswers: WrongAnswerRow[];
  testCases: TestCase[];
};
type TestCaseProblems = ReadonlyMap<TestCaseId, readonly TestCaseProblem[]>;

const findTestCaseProblems = (testCases: readonly TestCase[]): TestCaseProblems =>
  new Map(
    testCases.flatMap((testCase) => {
      const found = testCaseProblems(testCase);
      return found.length === 0 ? [] : [[testCase.id, found] as const];
    }),
  );
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

/**
 * What Validate checks. Wrong answer labels are trimmed as the save trims
 * them, so a passing validation's hash matches the hash of what is saved.
 */
const contentOf = (fields: EditorFields): ValidationContent => ({
  title: fields.title,
  slug: fields.slug,
  instructionsMd: fields.instructionsMd,
  starterCode: fields.starterCode,
  solutionCode: fields.solutionCode,
  wrongAnswers: fields.wrongAnswers.map(({ label, code }) => ({ label: label.trim(), code })),
  testCases: fields.testCases,
});

const FAILURES = Object.keys(words.failure) as (keyof typeof words.failure)[];
const failureText = (error: string) =>
  words.failure[FAILURES.find((key) => key === error) ?? "unavailable"];
const STATUS_FAILURES = Object.keys(lessonStatus.failure) as (keyof typeof lessonStatus.failure)[];
const statusFailureText = (error: string) =>
  lessonStatus.failure[STATUS_FAILURES.find((key) => key === error) ?? "unavailable"];

/** A passing validation of exactly this content, title and instructions included: what Publish needs. */
const covers = (state: ValidationState, content: ValidationContent) =>
  state.kind === "done" && state.passed && checkedNow(state, content).whole;

/** Why Save on a published lesson saved nothing, after the validation it ran first. */
function validateFirstText(state: ValidationState, python: PythonState): string {
  if (state.kind === "stopped") return words.validateFirst.stopped;
  if (state.kind === "unavailable") {
    return python === "failed"
      ? words.validateFirst.unavailableStart
      : words.validateFirst.unavailable;
  }
  return words.validateFirst.failed;
}

/** A form that passed its checks, ready to send. */
type Prepared = { draft: LessonDraft; testCases: TestCase[]; submitted: EditorFields };

/** The editor's sections, in order. Their IDs are made per editor, so two on a page never share one. */
export const LESSON_SECTIONS = [
  { key: "details", title: words.detailsHeading },
  { key: "instructions", title: words.instructionsHeading },
  { key: "code", title: words.codeHeading },
  { key: "testCases", title: words.testCasesHeading },
  { key: "publish", title: words.publishHeading },
] as const;

export type LessonEditorProps = {
  lesson: EditorLessonDetail;
  initialPreview: LessonDocument;
  nonce: string;
  save: SaveLesson;
  setStatus: SetLessonStatus;
  renderPreview: RenderPreview;
  /** The ID of a new test case; random unless a test fixes it. */
  newTestCaseId?: () => string;
  /** Starts the Python that Validate uses; the browser's unless a test gives its own. */
  openRuntime?: OpenValidationRuntime;
};

const randomTestCaseId = () => crypto.randomUUID();

export function LessonEditor({
  lesson,
  initialPreview,
  nonce,
  save,
  setStatus,
  renderPreview,
  newTestCaseId = randomTestCaseId,
  openRuntime = openBrowserValidationRuntime,
}: LessonEditorProps) {
  const [fields, setFields] = useState<EditorFields>(() => fieldsOf(lesson));
  const [saved, setSaved] = useState(() => snapshot(fieldsOf(lesson)));
  const [loadedAt, setLoadedAt] = useState(lesson.loadedAt);
  const [status, setCurrentStatus] = useState<ContentStatus>(lesson.status);
  const [statusFailure, setStatusFailure] = useState<string | null>(null);
  const [statusChanged, setStatusChanged] = useState<ContentStatus | null>(null);
  const [invalid, setInvalid] = useState<Invalid>([]);
  const [testProblems, setTestProblems] = useState<TestCaseProblems>(() => new Map());
  const [openTestCases, setOpenTestCases] = useState<ReadonlySet<string>>(() => new Set());
  const [failure, setFailure] = useState<string | null>(null);
  const [savedNow, setSavedNow] = useState(false);
  // Saving and moving the status are told apart, so each says only what it
  // does; while one runs, the other waits, so both use the same version.
  const [savePending, startSave] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [moveTarget, setMoveTarget] = useState<ContentStatus | null>(null);
  const [python, setPython] = useState<PythonState>("loading");
  const [validation, setValidation] = useState<ValidationState>({ kind: "idle" });
  const runtime = useRef<ValidationRuntime | undefined>(undefined);
  const stopPressed = useRef(false);
  // Python starts with the editor, so it is ready when the owner presses Validate.
  useEffect(() => {
    const opened = openRuntime(setPython);
    runtime.current = opened;
    return () => {
      opened.dispose();
      runtime.current = undefined;
    };
  }, [openRuntime]);
  const form = useRef<HTMLFormElement>(null);
  const focusAfterCommit = useFocusAfterCommit(form);
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

  /**
   * Validates `checked` and shows the result. A defect, not a lesson
   * problem, rejects: the panel leaves "Validating" first.
   */
  async function runValidation(checked: ValidationContent): Promise<ValidationState> {
    const current = runtime.current;
    // A check waits for Python to be ready, which a failed start never is.
    if (current === undefined || python === "failed") {
      setValidation({ kind: "unavailable" });
      return { kind: "unavailable" };
    }
    stopPressed.current = false;
    setValidation({ kind: "running", stopping: false });
    let next: ValidationState;
    try {
      const outcome = await validateLessonContent(
        checked,
        current.checkProgram,
        () => stopPressed.current,
      );
      next = outcome.kind === "done" ? { ...outcome, checked } : { kind: outcome.kind };
    } catch (error) {
      setValidation({ kind: "unavailable" });
      throw error;
    }
    setValidation(next);
    return next;
  }

  function validate() {
    if (validation.kind === "running") return;
    // The worker refuses a test case with a problem, so it is shown and fixed first.
    const problems = findTestCaseProblems(fields.testCases);
    setTestProblems(problems);
    if (problems.size > 0) {
      showTestCaseProblems(problems);
      return;
    }
    // A rejection is a defect: it reaches the page's error reporting.
    void runValidation(contentOf(fields));
  }

  function stopValidation() {
    stopPressed.current = true;
    setValidation({ kind: "running", stopping: true });
    runtime.current?.stop();
  }

  function focusFirstInvalid() {
    focusAfterCommit("[aria-invalid='true']");
  }

  /** Opens a test case named in the checklist and moves focus to its title. */
  function openTestCase(id: TestCaseId) {
    setOpenTestCases((current) => new Set([...current, id]));
    focusAfterCommit(`[data-test-case="${id}"] button[slot="trigger"]`);
  }

  /** Opens each test case with a problem and focuses the first wrong field. */
  function showTestCaseProblems(problems: TestCaseProblems) {
    // A test case with a problem opens in the same render, so focus can reach its field.
    setOpenTestCases((current) => new Set([...current, ...problems.keys()]));
    focusFirstInvalid();
  }

  /** Checks the form; on a problem, marks and focuses it and returns nothing. */
  function prepare(): Prepared | undefined {
    const { testCases, ...lessonFields } = fields;
    const checked = checkLessonFields({
      ...lessonFields,
      wrongAnswers: fields.wrongAnswers.map(({ label, code }) => ({ label, code })),
    });
    const problems = findTestCaseProblems(testCases);
    setTestProblems(problems);
    if (!checked.ok || problems.size > 0) {
      setInvalid(checked.ok ? [] : checked.invalid);
      showTestCaseProblems(problems);
      return undefined;
    }
    setInvalid([]);
    return { draft: checked.draft, testCases, submitted: fields };
  }

  /**
   * Saves a prepared form, with the hash of `checked` when it passed for
   * exactly what is saved, and takes the saved version as the editor's.
   */
  async function store(
    { draft, testCases, submitted }: Prepared,
    checked: ValidationState,
  ): Promise<ActionOutcome<{ updatedAt: string }>> {
    const validatedHash = validatedHashFor(checked, {
      ...contentOf(submitted),
      starterCode: draft.starterCode,
      solutionCode: draft.solutionCode,
      wrongAnswers: draft.wrongAnswers,
    });
    const outcome = await settle(() =>
      save({
        id: lesson.id,
        loadedAt,
        draft,
        testCases,
        ...(validatedHash === undefined ? {} : { validatedHash }),
      }),
    );
    if (!outcome.ok) {
      if (outcome.error === "slug_taken") {
        setInvalid([{ field: "slug" }]);
        focusFirstInvalid();
      }
      return outcome;
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
    return outcome;
  }

  /** A validation that throws is a defect: reported, and taken as Python unable to run. */
  async function validateForSave(checked: ValidationContent): Promise<ValidationState> {
    try {
      return await runValidation(checked);
    } catch (error) {
      reportError(error);
      return { kind: "unavailable" };
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    setSavedNow(false);
    const prepared = prepare();
    if (prepared === undefined) return;
    const saveAfter = (checked: ValidationState) =>
      startSave(async () => {
        const outcome = await store(prepared, checked);
        if (!outcome.ok) {
          setFailure(failureText(outcome.error));
          return;
        }
        setSavedNow(true);
      });
    // A published lesson is never saved without a passing validation of what
    // is saved. The validation runs outside the transition, which would hold
    // "Validating" and Stop back until the save ended.
    const content = contentOf(prepared.submitted);
    if (status === "published" && !covers(validation, content)) {
      void validateForSave(content).then((checked) => {
        if (covers(checked, content)) saveAfter(checked);
        else setFailure(validateFirstText(checked, python));
      });
      return;
    }
    saveAfter(validation);
  }

  function moveStatus(to: ContentStatus) {
    setStatusFailure(null);
    setStatusChanged(null);
    // Publish puts the lesson on the site as it is in the editor, so it saves first.
    const prepared = to === "published" ? prepare() : undefined;
    if (to === "published" && prepared === undefined) return;
    setMoveTarget(to);
    startStatus(async () => {
      let version = loadedAt;
      if (prepared !== undefined) {
        const saved = await store(prepared, validation);
        if (!saved.ok) {
          setStatusFailure(failureText(saved.error));
          return;
        }
        version = saved.value.updatedAt;
      }
      const outcome = await settle(() =>
        setStatus({ id: lesson.id, loadedAt: version, status: to }),
      );
      if (!outcome.ok) {
        setStatusFailure(statusFailureText(outcome.error));
        return;
      }
      setLoadedAt(outcome.value.updatedAt);
      setCurrentStatus(to);
      setStatusChanged(to);
    });
  }

  const stale = failure === words.failure.stale;
  const content = contentOf(fields);
  const solution = solutionViews(validation, content);
  // On a published lesson Save validates first, so it waits for a validation in progress.
  const saveWaits = status === "published" && validation.kind === "running";
  // Publish saves first, so the top bar says so while it runs.
  const publishing = statusPending && moveTarget === "published";
  const saving = savePending || publishing;
  return (
    <form ref={form} noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="sticky inset-bs-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-border bg-bg py-3">
        <p className="text-base text-text">
          <span className="text-text-muted">{words.statusLabel}: </span>
          {words.statusNow[status]}
          <span aria-hidden="true" className="text-text-muted">
            {" · "}
          </span>
          <span className={unsaved ? "font-medium text-text" : "text-text-muted"}>
            {unsaved ? words.unsaved : words.allSaved}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {/* The preview shows the last saved version (section 7.7). */}
          <Link href={adminLessonPreviewPath(lesson.id)} variant="standalone">
            {words.previewLesson}
          </Link>
          <Button
            type="submit"
            variant="primary"
            isPending={saving || saveWaits}
            isDisabled={statusPending && !publishing}
          >
            {saving ? words.saving : words.save}
          </Button>
        </div>
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
        <div
          role="group"
          aria-label={words.sectionsLabel}
          className="sticky inset-bs-20 shrink-0 self-start"
        >
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
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <div
            role="group"
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
          </div>

          <div
            role="group"
            aria-labelledby={sectionId("instructions")}
            className="flex flex-col gap-5"
          >
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
          </div>

          <div role="group" aria-labelledby={sectionId("code")} className="flex flex-col gap-5">
            <h2 id={sectionId("code")} className="scroll-mbs-20 text-lg font-semibold text-text">
              {words.codeHeading}
            </h2>
            {status === "published" && (
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
          </div>

          <div
            role="group"
            aria-labelledby={sectionId("testCases")}
            className="flex flex-col gap-5"
          >
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
              solution={solution}
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
          </div>

          <div role="group" aria-labelledby={sectionId("publish")} className="flex flex-col gap-5">
            <h2 id={sectionId("publish")} className="scroll-mbs-20 text-lg font-semibold text-text">
              {words.publishHeading}
            </h2>
            <ValidationPanel
              state={validation}
              python={python}
              outdated={!checkedNow(validation, content).whole}
              testCases={fields.testCases}
              onValidate={validate}
              onStop={stopValidation}
              onRetry={() => runtime.current?.retry()}
              onOpenTestCase={openTestCase}
            />
            <LessonStatusControls
              status={status}
              canPublish={covers(validation, content)}
              pending={statusPending}
              busy={savePending || saveWaits}
              failure={statusFailure}
              stale={
                statusFailure === lessonStatus.failure.stale ||
                statusFailure === lessonStatus.failure.status_not_allowed ||
                statusFailure === words.failure.stale
              }
              changed={statusChanged}
              onMove={moveStatus}
            />
          </div>
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
