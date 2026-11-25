"use client";

import { type FormEvent, useId, useRef, useState, useTransition } from "react";
import { adminLessonPath } from "@/domain/admin/gate";
import { structure, transfer as words } from "@/messages/admin";
import { Button, FieldErrorMessage, Link, Notice, SelectField } from "@/ui";
import {
  jsonByteLength,
  LESSON_FILE_MAX_BYTES,
  LESSON_IMPORT_MAX_BYTES,
  type LessonFile,
  parseLessonFileText,
} from "../lesson-file";
import type { AdminAction } from "../types";
import { settle } from "./structure-controls";

// Export and import on the course editor (docs/spec/04-content-system.md
// section 8; FR-ADM-12, T-23). Export saves the course as one JSON file.
// Import reads one lesson file in this browser, names the first field that is
// wrong, and sends the parsed lesson; the server makes it a draft. Nothing in
// the file runs: the lesson's code runs only when the owner presses Validate
// in its editor, inside the worker learners use.

export type ExportCourse = AdminAction<{ id: string }, { fileName: string; text: string }>;
export type ImportLesson = AdminAction<
  { courseId: string; chapterId: string; lesson: LessonFile },
  { id: string; slug: string }
>;

/** Saves text as a file through the browser's own download. */
export function saveFile(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoked later: a browser may still be starting the download after the click.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type CourseTransferProps = {
  courseId: string;
  chapters: readonly { id: string; title: string }[];
  exportCourse: ExportCourse;
  importLesson: ImportLesson;
  /** Reads the course again, so the new draft shows in its chapter. */
  refresh: () => void;
  /** The browser's download by default. */
  save?: (fileName: string, text: string) => void;
};

function failureText(error: string): string {
  return Object.hasOwn(words.failure, error)
    ? words.failure[error as keyof typeof words.failure]
    : words.failure.unavailable;
}

type Imported = { id: string; title: string; chapter: string; slug: string; wanted: string };

const fileInput =
  "w-full text-base text-text file:me-3 file:min-h-target file:cursor-pointer file:rounded-control file:border file:border-border-control file:bg-bg file:px-3 file:text-base file:text-text hover:file:border-text-muted aria-invalid:file:border-fail";

export function CourseTransfer({
  courseId,
  chapters,
  exportCourse,
  importLesson,
  refresh,
  save = saveFile,
}: CourseTransferProps) {
  const headingId = useId();
  const importHeadingId = useId();
  const fileId = useId();
  const fileHintId = useId();
  const fileErrorId = useId();
  const file = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [exporting, startExport] = useTransition();
  const [exported, setExported] = useState<string | null>(null);
  const [exportFailure, setExportFailure] = useState<string | null>(null);
  const [importing, startImport] = useTransition();
  const [chapterId, setChapterId] = useState(chapters[0]?.id ?? "");
  const [fileError, setFileError] = useState<string | null>(null);
  const [importFailure, setImportFailure] = useState<string | null>(null);
  const [imported, setImported] = useState<Imported | null>(null);
  // A chapter deleted since it was chosen falls back to the first one.
  const chapter = chapters.find((one) => one.id === chapterId) ?? chapters[0];

  function runExport() {
    setExported(null);
    setExportFailure(null);
    startExport(async () => {
      const outcome = await settle(() => exportCourse({ id: courseId }));
      if (!outcome.ok) {
        setExportFailure(
          outcome.error === "export_broken" ? words.exportBroken : words.exportFailed,
        );
        return;
      }
      save(outcome.value.fileName, outcome.value.text);
      setExported(outcome.value.fileName);
    });
  }

  function refuseFile(sentence: string): undefined {
    setFileError(sentence);
    file.current?.focus();
    return undefined;
  }

  /** The parsed lesson in the chosen file, or undefined once the field says what is wrong. */
  async function readChosen(chapterId: string): Promise<LessonFile | undefined> {
    const chosen = file.current?.files?.[0];
    if (chosen === undefined) return refuseFile(words.fileMissing);
    if (chosen.size > LESSON_FILE_MAX_BYTES) return refuseFile(words.fileTooLarge);
    let text: string;
    try {
      text = await chosen.text();
    } catch {
      return refuseFile(words.fileUnreadable);
    }
    const parsed = parseLessonFileText(text);
    if (!parsed.ok) {
      return refuseFile(
        parsed.problem === "not_json" ? words.notJson : words.fieldInvalid(parsed.field),
      );
    }
    if (jsonByteLength({ courseId, chapterId, lesson: parsed.lesson }) > LESSON_IMPORT_MAX_BYTES) {
      return refuseFile(words.fileTooLarge);
    }
    return parsed.lesson;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Pressed again while the file is read: the first press is still running.
    if (busy.current || chapter === undefined) return;
    busy.current = true;
    const target = chapter;
    setFileError(null);
    setImportFailure(null);
    setImported(null);
    // Read and checked before the field is disabled, so a refusal can focus it.
    const lesson = await readChosen(target.id);
    if (lesson === undefined) {
      busy.current = false;
      return;
    }
    startImport(async () => {
      const outcome = await settle(() => importLesson({ courseId, chapterId: target.id, lesson }));
      busy.current = false;
      if (!outcome.ok) {
        setImportFailure(failureText(outcome.error));
        return;
      }
      setImported({
        id: outcome.value.id,
        title: lesson.title,
        chapter: target.title,
        slug: outcome.value.slug,
        wanted: lesson.slug,
      });
      if (file.current !== null) file.current.value = "";
      refresh();
    });
  }

  return (
    <section aria-labelledby={headingId} className="flex max-w-prose flex-col gap-5">
      <h2 id={headingId} className="text-lg font-semibold text-text">
        {words.heading}
      </h2>
      <div className="flex flex-col gap-3">
        <p className="text-base text-text">{words.exportExplain}</p>
        {exportFailure !== null && (
          <Notice kind="error" kindLabel={structure.errorLabel} announce="assertive">
            {exportFailure}
          </Notice>
        )}
        {/* Kept in the page for the live region, and out of the layout while empty. */}
        <p
          role="status"
          className={exporting || exported !== null ? "text-sm text-text-muted" : "sr-only"}
        >
          {exporting ? words.exporting : exported === null ? "" : words.exported(exported)}
        </p>
        <div>
          <Button variant="secondary" isPending={exporting} onPress={runExport}>
            {words.exportCourse}
          </Button>
        </div>
      </div>
      <section aria-labelledby={importHeadingId} className="flex flex-col gap-4">
        <h3 id={importHeadingId} className="text-base font-semibold text-text">
          {words.importHeading}
        </h3>
        <p className="text-base text-text">{words.importExplain}</p>
        {chapter === undefined ? (
          <p className="text-base text-text-muted">{words.importNeedsChapter}</p>
        ) : (
          <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
            <SelectField
              label={words.chapterLabel}
              value={chapter.id}
              options={chapters.map((one) => ({ value: one.id, label: one.title }))}
              onChange={setChapterId}
              isDisabled={importing}
            />
            <div className="flex flex-col gap-2">
              <label htmlFor={fileId} className="text-base font-medium text-text">
                {words.fileLabel}
              </label>
              <input
                ref={file}
                id={fileId}
                type="file"
                accept="application/json,.json"
                disabled={importing}
                aria-invalid={fileError !== null}
                aria-describedby={fileError === null ? fileHintId : `${fileHintId} ${fileErrorId}`}
                onChange={() => setFileError(null)}
                className={fileInput}
              />
              <p id={fileHintId} className="text-sm text-text-muted">
                {words.fileHint}
              </p>
              {fileError !== null && (
                <FieldErrorMessage id={fileErrorId}>{fileError}</FieldErrorMessage>
              )}
            </div>
            {importFailure !== null && (
              <Notice kind="error" kindLabel={structure.errorLabel} announce="assertive">
                {importFailure}
              </Notice>
            )}
            {imported !== null && (
              <Notice kind="success" kindLabel={structure.savedLabel} announce="polite">
                {words.imported(imported.title, imported.chapter)}
                {imported.slug !== imported.wanted &&
                  ` ${words.slugChanged(imported.slug, imported.wanted)}`}{" "}
                <Link href={adminLessonPath(imported.id)} variant="inline">
                  {words.openLesson(imported.title)}
                </Link>
              </Notice>
            )}
            <p role="status" className={importing ? "text-sm text-text-muted" : "sr-only"}>
              {importing ? words.importing : ""}
            </p>
            <div>
              <Button type="submit" variant="secondary" isPending={importing}>
                {words.importLesson}
              </Button>
            </div>
          </form>
        )}
      </section>
    </section>
  );
}
