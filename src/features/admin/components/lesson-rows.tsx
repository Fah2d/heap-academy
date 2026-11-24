"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState, useTransition } from "react";
import { trimmedText } from "@/domain/admin/course-details";
import { adminLessonPath } from "@/domain/admin/gate";
import { LESSON_LIMITS } from "@/domain/admin/lesson-details";
import { courseEditor, lessonEditor, lessonRows as words, structure } from "@/messages/admin";
import { Button, Link, Notice, TextField } from "@/ui";
import type { AdminAction, EditorChapter, MoveDirection, ReorderInput } from "../types";
import type { ConfirmLeave } from "./leave-warning";
import { focusMoved, MoveButtons, settle, structureFailureText } from "./structure-controls";

// A chapter's lessons in the course editor (docs/spec/03-experience.md
// section 7.3, FR-ADM-03): each opens its editor, moves up or down with the
// keyboard, and shows its number and status; "Add lesson" creates a draft at
// the end of the chapter and opens it.

export type CreateLessonInput = { courseId: string; chapterId: string; title: string };
export type LessonRowActions = {
  reorder: AdminAction<ReorderInput, null>;
  createLesson: AdminAction<CreateLessonInput, { id: string }>;
};

/** The add-lesson form's name in the course editor's reports of unsaved text. */
export const addLessonFormKey = (chapterId: string) => `lesson-${chapterId}`;

const TITLE = trimmedText(1, LESSON_LIMITS.title);

const lessonFailureText = (error: string) =>
  Object.hasOwn(lessonEditor.failure, error)
    ? lessonEditor.failure[error as keyof typeof lessonEditor.failure]
    : structureFailureText(error);

export function LessonRows({
  chapter,
  chapterNumber,
  reorder,
  refresh,
}: {
  chapter: EditorChapter;
  /** The chapter's place, from 1, for the lesson numbers learners see. */
  chapterNumber: number;
  reorder: LessonRowActions["reorder"];
  refresh: () => void;
}) {
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState("");
  const [pending, startTransition] = useTransition();
  const list = useRef<HTMLOListElement>(null);
  const lastMove = useRef<{ id: string; direction: MoveDirection } | null>(null);

  useEffect(() => {
    if (lastMove.current !== null) {
      focusMoved(list.current, lastMove.current.id, lastMove.current.direction);
      lastMove.current = null;
    }
  }, [chapter.lessons]);

  function onMove(id: string, direction: MoveDirection) {
    setFailure(null);
    setDone("");
    startTransition(async () => {
      const outcome = await settle(() =>
        reorder({ kind: "lesson", chapterId: chapter.id, id, direction }),
      );
      if (!outcome.ok) {
        setFailure(structureFailureText(outcome.error));
        return;
      }
      lastMove.current = { id, direction };
      setDone(structure.moved);
      refresh();
    });
  }

  if (chapter.lessons.length === 0) {
    return <p className="text-sm text-text-muted">{courseEditor.chapterLessonsEmpty}</p>;
  }
  const last = chapter.lessons.length - 1;
  return (
    <div className="flex flex-col gap-3">
      <ol
        ref={list}
        aria-label={courseEditor.chapterLessonsLabel(chapter.title)}
        className="flex flex-col text-sm text-text"
      >
        {chapter.lessons.map((lesson, index) => (
          <li
            key={lesson.id}
            className="flex flex-wrap items-center gap-3 border-b border-border py-2"
          >
            <span className="font-mono text-text-muted">
              {courseEditor.lessonNumber(chapterNumber, index + 1)}
            </span>
            <span className="flex-1">
              <Link href={adminLessonPath(lesson.id)} variant="inline">
                {lesson.title}
              </Link>
            </span>
            <span className="text-text-muted">{courseEditor.lessonStatus[lesson.status]}</span>
            <MoveButtons
              name={lesson.title}
              itemId={lesson.id}
              isFirst={index === 0}
              isLast={index === last}
              isPending={pending}
              onMove={(direction) => onMove(lesson.id, direction)}
            />
          </li>
        ))}
      </ol>
      {failure !== null && (
        <Notice kind="error" kindLabel={structure.errorLabel} announce="assertive">
          {failure}
        </Notice>
      )}
      <p role="status" className="sr-only">
        {done}
      </p>
    </div>
  );
}

export function AddLessonForm({
  courseId,
  chapter,
  createLesson,
  onUnsavedChange,
  otherUnsaved = false,
  confirmLeave = (text) => window.confirm(text),
}: {
  courseId: string;
  chapter: EditorChapter;
  createLesson: LessonRowActions["createLesson"];
  onUnsavedChange: (formKey: string, unsaved: boolean) => void;
  /** Whether another form on the page holds unsaved text. */
  otherUnsaved?: boolean;
  confirmLeave?: ConfirmLeave;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const field = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const formKey = addLessonFormKey(chapter.id);

  useEffect(() => {
    onUnsavedChange(formKey, title.trim() !== "");
  }, [formKey, title, onUnsavedChange]);
  useEffect(() => () => onUnsavedChange(formKey, false), [formKey, onUnsavedChange]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    if (!TITLE.safeParse(title).success) {
      setInvalid(true);
      requestAnimationFrame(() => field.current?.querySelector("input")?.focus());
      return;
    }
    setInvalid(false);
    // The new lesson opens by the router, which the leave warning does not
    // see, so the question is asked here, before anything is created.
    if (otherUnsaved && !confirmLeave(courseEditor.unsavedWarning)) return;
    startTransition(async () => {
      const outcome = await settle(() =>
        createLesson({ courseId, chapterId: chapter.id, title: title.trim() }),
      );
      if (!outcome.ok) {
        setFailure(lessonFailureText(outcome.error));
        return;
      }
      // The new lesson holds what was typed; nothing is left unsaved here.
      onUnsavedChange(formKey, false);
      router.push(adminLessonPath(outcome.value.id));
    });
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      aria-labelledby={headingId}
      className="flex flex-col gap-3"
    >
      <h4 id={headingId} className="text-base font-medium text-text">
        {words.addLessonHeading(chapter.title)}
      </h4>
      <div ref={field} className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <TextField
            label={words.newLessonTitleLabel(chapter.title)}
            value={title}
            onChange={(next) => {
              setInvalid(false);
              setTitle(next);
            }}
            isInvalid={invalid}
            errorMessage={words.lessonTitleInvalid}
          />
        </div>
      </div>
      {failure !== null && (
        <Notice kind="error" kindLabel={structure.errorLabel} announce="assertive">
          {failure}
        </Notice>
      )}
      <div>
        <Button type="submit" variant="secondary" isPending={pending}>
          {pending ? words.addingLesson : words.addLesson}
        </Button>
      </div>
    </form>
  );
}
