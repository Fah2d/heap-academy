"use client";

import { type FormEvent, useEffect, useId, useRef, useState, useTransition } from "react";
import { courseEditor as words, structure } from "@/messages/admin";
import { Button, Dialog, DialogActions, Notice, TextField } from "@/ui";
import type {
  ActionOutcome,
  AdminAction,
  EditorChapter,
  MoveDirection,
  ReorderInput,
} from "../types";
import { focusMoved, MoveButtons, settle, structureFailureText } from "./structure-controls";

// The Structure of a course (docs/spec/03-experience.md section 7.3,
// FR-ADM-03): its chapters in order, each with its lessons in order and
// their status; Move up and Move down; rename; delete an empty chapter; and
// add a chapter at the end. Each change is saved at once, and the list is
// read again from the database.

export type SaveChapterInput = { courseId: string; id?: string; title: string; summary: string };

export type ChapterActions = {
  saveChapter: AdminAction<SaveChapterInput, { id: string }>;
  deleteChapter: AdminAction<{ id: string }, null>;
  reorder: AdminAction<ReorderInput, null>;
};

export type ChapterListProps = ChapterActions & {
  courseId: string;
  chapters: EditorChapter[];
  /** Reads the course again after a change. */
  refresh: () => void;
};

const MAX_TITLE = 60;
const MAX_SUMMARY = 140;
const titleOk = (title: string) => title.trim().length >= 1 && title.trim().length <= MAX_TITLE;
const summaryOk = (summary: string) => summary.trim().length <= MAX_SUMMARY;

type ChapterFormProps = {
  initial: { title: string; summary: string };
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  onSubmit: (values: { title: string; summary: string }) => Promise<boolean>;
  onCancel?: () => void;
};

/** The title and summary of a chapter, for a new chapter and for a rename. */
function ChapterForm({
  initial,
  submitLabel,
  pendingLabel,
  pending,
  onSubmit,
  onCancel,
}: ChapterFormProps) {
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [invalid, setInvalid] = useState<"title" | "summary" | null>(null);
  const form = useRef<HTMLFormElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const wrong = !titleOk(title) ? "title" : !summaryOk(summary) ? "summary" : null;
    setInvalid(wrong);
    if (wrong !== null) {
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLInputElement>("input[aria-invalid='true']")?.focus(),
      );
      return;
    }
    void onSubmit({ title: title.trim(), summary: summary.trim() }).then((done) => {
      if (done && onCancel === undefined) {
        // The add form empties for the next chapter.
        setTitle("");
        setSummary("");
      }
    });
  }

  return (
    <form ref={form} noValidate onSubmit={submit} className="flex max-w-prose flex-col gap-4">
      <TextField
        label={words.chapterTitleLabel}
        value={title}
        onChange={setTitle}
        isInvalid={invalid === "title"}
        errorMessage={words.chapterTitleInvalid}
      />
      <TextField
        label={words.chapterSummaryLabel}
        description={words.summaryHint}
        value={summary}
        onChange={setSummary}
        isInvalid={invalid === "summary"}
        errorMessage={words.fieldInvalid.summary}
      />
      <div className="flex gap-3">
        <Button type="submit" variant="secondary" isDisabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel !== undefined && (
          <Button variant="secondary" onPress={onCancel} isDisabled={pending}>
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
  refresh,
}: ChapterListProps) {
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string>("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const list = useRef<HTMLOListElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const courseChaptersId = useId();
  const courseAddChapterId = useId();
  const lastMove = useRef<{ id: string; direction: MoveDirection } | null>(null);

  useEffect(() => {
    if (lastMove.current === null) return;
    focusMoved(list.current, lastMove.current.id, lastMove.current.direction);
    lastMove.current = null;
  }, [chapters]);

  /** Runs one change and reads the course again; true when it was saved. */
  function run<Value>(
    change: () => Promise<ActionOutcome<Value>>,
    success: string,
    beforeRefresh?: () => void,
  ) {
    setFailure(null);
    setDone("");
    return new Promise<boolean>((resolve) => {
      startTransition(async () => {
        const outcome = await settle(change);
        if (!outcome.ok) {
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
    <section aria-labelledby={courseChaptersId} className="flex flex-col gap-5">
      <h2
        ref={heading}
        id={courseChaptersId}
        tabIndex={-1}
        className="text-lg font-semibold text-text"
      >
        {words.chaptersHeading}
      </h2>
      {failure !== null && (
        <Notice kind="error" kindLabel={structure.errorLabel} announce="assertive">
          {failure}
        </Notice>
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
                  submitLabel={words.saveChapter}
                  pendingLabel={words.savingChapter}
                  pending={pending}
                  onSubmit={async (values) => {
                    const saved = await run(
                      () => saveChapter({ courseId, id: chapter.id, ...values }),
                      words.chapterSaved,
                    );
                    if (saved) setRenaming(null);
                    return saved;
                  }}
                  onCancel={() => setRenaming(null)}
                />
              ) : (
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold text-text">{chapter.title}</h3>
                  {chapter.summary !== "" && (
                    <p className="text-sm text-text-muted">{chapter.summary}</p>
                  )}
                </div>
              )}
              {chapter.lessons.length === 0 ? (
                <p className="text-sm text-text-muted">{words.chapterLessonsEmpty}</p>
              ) : (
                <ol
                  aria-label={words.chapterLessonsLabel(chapter.title)}
                  className="flex flex-col text-sm text-text"
                >
                  {chapter.lessons.map((lesson) => (
                    <li
                      key={lesson.id}
                      className="flex justify-between gap-4 border-b border-border py-2"
                    >
                      <span>{lesson.title}</span>
                      <span className="text-text-muted">{words.lessonStatus[lesson.status]}</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <MoveButtons
                  name={chapter.title}
                  itemId={chapter.id}
                  isFirst={index === 0}
                  isLast={index === last}
                  isDisabled={pending}
                  onMove={(direction) => onMove(chapter.id, direction)}
                />
                {renaming !== chapter.id && (
                  <Button
                    variant="secondary"
                    aria-label={words.renameChapter(chapter.title)}
                    isDisabled={pending}
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
                        isDisabled={pending}
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
            </li>
          ))}
        </ol>
      )}
      <section aria-labelledby={courseAddChapterId} className="flex flex-col gap-4">
        <h3 id={courseAddChapterId} className="text-base font-semibold text-text">
          {words.addChapterHeading}
        </h3>
        <ChapterForm
          initial={{ title: "", summary: "" }}
          submitLabel={words.addChapter}
          pendingLabel={words.addingChapter}
          pending={pending}
          onSubmit={(values) => run(() => saveChapter({ courseId, ...values }), words.chapterAdded)}
        />
      </section>
    </section>
  );
}
