"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { trimmedText } from "@/domain/admin/course-details";
import { courseEditor as words, structure } from "@/messages/admin";
import { Button, Dialog, DialogActions, Notice, TextField } from "@/ui";
import type { ActionOutcome, AdminAction, EditorChapter, MoveDirection } from "../types";
import { AddLessonForm, addLessonFormKey, LessonRows, type LessonRowActions } from "./lesson-rows";
import { focusMoved, MoveButtons, settle, structureFailureText } from "./structure-controls";

// The Structure of a course (docs/spec/03-experience.md section 7.3,
// FR-ADM-03): its chapters in order, each with its lessons in order and
// their status; Move up and Move down; rename; delete an empty chapter; and
// add a chapter at the end. Each change is saved at once, and the list is
// read again from the database. A rename names the version it loaded and is
// refused when the chapter is newer (FR-ADM-10). Typed text that is not
// saved yet is reported to the editor, which asks before leaving.

export type SaveChapterInput =
  | { courseId: string; title: string; summary: string }
  | { courseId: string; id: string; loadedAt: string; title: string; summary: string };

export type ChapterActions = LessonRowActions & {
  saveChapter: AdminAction<SaveChapterInput, { id: string }>;
  deleteChapter: AdminAction<{ id: string }, null>;
};

export type ChapterListProps = ChapterActions & {
  courseId: string;
  chapters: EditorChapter[];
  /** Reads the course again after a change. */
  refresh: () => void;
  /** Whether a chapter form holds text that is not saved. */
  onUnsavedChange?: (unsaved: boolean) => void;
  /** Whether a form outside the list, such as the course details, holds unsaved text. */
  otherUnsaved?: boolean;
};

/** The limits of docs/spec/04-content-system.md section 1.2, as the server checks them. */
const TITLE = trimmedText(1, 60);
const SUMMARY = trimmedText(0, 140);
const within = (text: string, limit: typeof TITLE) => limit.safeParse(text).success;

type ChapterFormProps = {
  initial: { title: string; summary: string };
  titleLabel: string;
  summaryLabel: string;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  /** Focus the title field when the form appears (a rename). */
  focusOnOpen?: boolean;
  onSubmit: (values: { title: string; summary: string }) => Promise<boolean>;
  onCancel?: () => void;
  /** This form's name in the reports of unsaved text. */
  formKey: string;
  onUnsavedChange: (formKey: string, unsaved: boolean) => void;
};

/** The title and summary of a chapter, for a new chapter and for a rename. */
function ChapterForm({
  initial,
  titleLabel,
  summaryLabel,
  submitLabel,
  pendingLabel,
  pending,
  focusOnOpen = false,
  onSubmit,
  onCancel,
  formKey,
  onUnsavedChange,
}: ChapterFormProps) {
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [invalid, setInvalid] = useState<"title" | "summary" | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const titleField = () => form.current?.querySelector<HTMLInputElement>("input");

  const unsaved = title !== initial.title || summary !== initial.summary;
  useEffect(() => {
    onUnsavedChange(formKey, unsaved);
  }, [formKey, unsaved, onUnsavedChange]);
  // A form that goes away holds nothing.
  useEffect(() => () => onUnsavedChange(formKey, false), [formKey, onUnsavedChange]);

  useEffect(() => {
    if (focusOnOpen) titleField()?.focus();
  }, [focusOnOpen]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const wrong = !within(title, TITLE) ? "title" : !within(summary, SUMMARY) ? "summary" : null;
    setInvalid(wrong);
    if (wrong !== null) {
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLInputElement>("input[aria-invalid='true']")?.focus(),
      );
      return;
    }
    void onSubmit({ title: title.trim(), summary: summary.trim() }).then((done) => {
      if (done && onCancel === undefined) {
        // The add form empties for the next chapter, and its title takes focus.
        setTitle("");
        setSummary("");
        titleField()?.focus();
      }
    });
  }

  return (
    <form ref={form} noValidate onSubmit={submit} className="flex flex-col gap-4">
      <TextField
        label={titleLabel}
        value={title}
        onChange={setTitle}
        isInvalid={invalid === "title"}
        errorMessage={words.chapterTitleInvalid}
      />
      <TextField
        label={summaryLabel}
        description={words.summaryHint}
        value={summary}
        onChange={setSummary}
        isInvalid={invalid === "summary"}
        errorMessage={words.fieldInvalid.summary}
      />
      <div className="flex gap-3">
        <Button type="submit" variant="secondary" isPending={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel !== undefined && (
          <Button variant="secondary" onPress={onCancel} isPending={pending}>
            {words.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}

export function ChapterList({
  courseId,
  chapters,
  saveChapter,
  deleteChapter,
  reorder,
  createLesson,
  refresh,
  onUnsavedChange,
  otherUnsaved = false,
}: ChapterListProps) {
  const [failure, setFailure] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [done, setDone] = useState<string>("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const list = useRef<HTMLOListElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const courseChaptersId = useId();
  const courseAddChapterId = useId();
  const lastMove = useRef<{ id: string; direction: MoveDirection } | null>(null);
  // After a rename closes, focus goes back to that chapter's Rename button.
  const renameClosed = useRef<string | null>(null);
  const [unsavedForms, setUnsavedForms] = useState<ReadonlySet<string>>(new Set());
  // Stable, so a form's effect runs only when its own text changes.
  const reportUnsaved = useCallback((formKey: string, unsaved: boolean) => {
    setUnsavedForms((current) => {
      if (current.has(formKey) === unsaved) return current;
      const next = new Set(current);
      if (unsaved) next.add(formKey);
      else next.delete(formKey);
      return next;
    });
  }, []);
  const anyUnsaved = unsavedForms.size > 0;
  useEffect(() => {
    onUnsavedChange?.(anyUnsaved);
  }, [anyUnsaved, onUnsavedChange]);

  useEffect(() => {
    if (lastMove.current !== null) {
      focusMoved(list.current, lastMove.current.id, lastMove.current.direction);
      lastMove.current = null;
    }
  }, [chapters]);

  useEffect(() => {
    if (renaming !== null || renameClosed.current === null) return;
    list.current
      ?.querySelector<HTMLButtonElement>(`[data-rename="${renameClosed.current}"]`)
      ?.focus();
    renameClosed.current = null;
  }, [renaming, chapters]);

  function closeRename(id: string) {
    renameClosed.current = id;
    setRenaming(null);
  }

  /** Runs one change and reads the course again; true when it was saved. */
  function run<Value>(
    change: () => Promise<ActionOutcome<Value>>,
    success: string,
    beforeRefresh?: () => void,
  ) {
    setFailure(null);
    setStale(false);
    setDone("");
    return new Promise<boolean>((resolve) => {
      startTransition(async () => {
        const outcome = await settle(change);
        if (!outcome.ok) {
          setStale(outcome.error === "stale");
          setFailure(structureFailureText(outcome.error));
          resolve(false);
          return;
        }
        setDone(success);
        beforeRefresh?.();
        refresh();
        resolve(true);
      });
    });
  }

  function onMove(id: string, direction: MoveDirection) {
    void run(
      () => reorder({ kind: "chapter", courseId, id, direction }),
      structure.moved,
      () => {
        lastMove.current = { id, direction };
      },
    );
  }

  const last = chapters.length - 1;
  return (
    <div
      role="group"
      aria-labelledby={courseChaptersId}
      className="flex max-w-prose flex-col gap-5"
    >
      <h2
        ref={heading}
        id={courseChaptersId}
        tabIndex={-1}
        className="text-lg font-semibold text-text"
      >
        {words.chaptersHeading}
      </h2>
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
      <p role="status" className="sr-only">
        {done}
      </p>
      {chapters.length === 0 ? (
        <p className="text-base text-text-muted">{words.chaptersEmpty}</p>
      ) : (
        <ol ref={list} className="flex flex-col gap-4">
          {chapters.map((chapter, index) => (
            <li
              key={chapter.id}
              className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4"
            >
              {renaming === chapter.id ? (
                <ChapterForm
                  initial={chapter}
                  titleLabel={words.renameTitleLabel(chapter.title)}
                  summaryLabel={words.renameSummaryLabel(chapter.title)}
                  submitLabel={words.saveChapter}
                  pendingLabel={words.savingChapter}
                  pending={pending}
                  focusOnOpen
                  formKey={`rename:${chapter.id}`}
                  onUnsavedChange={reportUnsaved}
                  onSubmit={async (values) => {
                    const saved = await run(
                      () =>
                        saveChapter({
                          courseId,
                          id: chapter.id,
                          loadedAt: chapter.loadedAt,
                          ...values,
                        }),
                      words.chapterSaved,
                    );
                    if (saved) closeRename(chapter.id);
                    return saved;
                  }}
                  onCancel={() => closeRename(chapter.id)}
                />
              ) : (
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm text-text-muted">
                    {words.chapterNumber(index + 1)}
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold text-text">{chapter.title}</h3>
                    {chapter.summary !== "" && (
                      <p className="text-sm text-text-muted">{chapter.summary}</p>
                    )}
                  </div>
                </div>
              )}
              <LessonRows
                chapter={chapter}
                chapterNumber={index + 1}
                reorder={reorder}
                refresh={refresh}
              />
              <div className="flex flex-wrap items-center gap-3">
                <MoveButtons
                  name={chapter.title}
                  itemId={chapter.id}
                  isFirst={index === 0}
                  isLast={index === last}
                  isPending={pending}
                  onMove={(direction) => onMove(chapter.id, direction)}
                />
                {renaming !== chapter.id && (
                  <Button
                    variant="secondary"
                    aria-label={words.renameChapter(chapter.title)}
                    data-rename={chapter.id}
                    isPending={pending}
                    onPress={() => setRenaming(chapter.id)}
                  >
                    {words.rename}
                  </Button>
                )}
                {chapter.lessons.length === 0 && (
                  <Dialog
                    title={words.deleteConfirmTitle}
                    trigger={
                      <Button
                        variant="destructive"
                        aria-label={words.deleteChapter(chapter.title)}
                        isPending={pending}
                      >
                        {words.deleteShort}
                      </Button>
                    }
                  >
                    {(close) => (
                      <>
                        <p className="text-base text-text">
                          {words.deleteConfirmBody(chapter.title)}
                        </p>
                        <DialogActions>
                          <Button variant="secondary" surface="raised" onPress={close}>
                            {words.cancel}
                          </Button>
                          <Button
                            variant="destructive"
                            surface="raised"
                            onPress={() => {
                              close();
                              // The chapter's row goes, so focus moves to the heading.
                              void run(
                                () => deleteChapter({ id: chapter.id }),
                                words.chapterDeleted,
                                () => heading.current?.focus(),
                              );
                            }}
                          >
                            {words.deleteConfirm}
                          </Button>
                        </DialogActions>
                      </>
                    )}
                  </Dialog>
                )}
              </div>
              <AddLessonForm
                courseId={courseId}
                chapter={chapter}
                createLesson={createLesson}
                onUnsavedChange={reportUnsaved}
                otherUnsaved={
                  otherUnsaved ||
                  [...unsavedForms].some((key) => key !== addLessonFormKey(chapter.id))
                }
              />
            </li>
          ))}
        </ol>
      )}
      <div role="group" aria-labelledby={courseAddChapterId} className="flex flex-col gap-4">
        <h3 id={courseAddChapterId} className="text-base font-semibold text-text">
          {words.addChapterHeading}
        </h3>
        <ChapterForm
          initial={{ title: "", summary: "" }}
          titleLabel={words.newChapterTitleLabel}
          summaryLabel={words.newChapterSummaryLabel}
          submitLabel={words.addChapter}
          pendingLabel={words.addingChapter}
          pending={pending}
          formKey="add"
          onUnsavedChange={reportUnsaved}
          onSubmit={(values) => run(() => saveChapter({ courseId, ...values }), words.chapterAdded)}
        />
      </div>
    </div>
  );
}
