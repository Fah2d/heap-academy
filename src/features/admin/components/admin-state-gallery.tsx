"use client";

import type { ReactNode } from "react";
import { adminGallery as m } from "@/messages/gallery";
import { secondStep } from "@/messages/admin";
import type { LessonDocument } from "@/content/markdown";
import type { EditorCourse, EditorLessonDetail } from "../types";
import { CourseEditor } from "./course-editor";
import { CourseEditorFailed } from "./course-editor-failed";
import { CourseList } from "./course-list";
import { LessonContent } from "@/features/workspace";
import { LessonEditor } from "./lesson-editor";
import { NewCourseForm } from "./new-course-form";
import { SecondStepForm } from "./second-step-form";
import { SetupFlow } from "./setup-flow";

// Development only (src/app/dev/admin/page.dev.tsx): each state of the admin
// views that the J-12 journey cannot reach, with fake actions, so the e2e
// gallery spec can check and photograph them (WP-2.3 design review 1).

function Example({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  // As wide as the real pages, so a screenshot shows the layout they have.
  return (
    <section aria-labelledby={id} className="flex max-w-page flex-col gap-4">
      <h2 id={id} className="text-lg font-semibold text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

const never = () => new Promise<never>(() => undefined);
const refuse = (error: string) => () => Promise.resolve({ ok: false as const, error });
const stay = () => undefined;
const succeed =
  <Value,>(value: Value) =>
  () =>
    Promise.resolve({ ok: true as const, value });
const SAVED_AT = "2026-11-21T08:10:00.000000+00:00";

const COURSE_ID = "5eed0000-0000-4000-8000-000000000001";

const sampleLesson: EditorLessonDetail = {
  id: "5eed0000-0000-4000-8000-000000000201",
  courseId: COURSE_ID,
  courseTitle: m.sampleCourse,
  chapterId: "5eed0000-0000-4000-8000-000000000101",
  chapters: [
    { id: "5eed0000-0000-4000-8000-000000000101", title: m.sampleChapter },
    { id: "5eed0000-0000-4000-8000-000000000102", title: m.secondChapter },
  ],
  title: m.sampleLesson,
  slug: "sample-lesson",
  xp: 10,
  status: "draft",
  instructionsMd: m.sampleInstructions,
  hints: [m.sampleHint],
  starterCode: m.sampleStarter,
  solutionCode: m.sampleSolution,
  wrongAnswers: [{ label: m.sampleWrongLabel, code: m.sampleWrongCode }],
  testCount: 2,
  loadedAt: "2026-11-22T08:00:00.000000+00:00",
};

const emptyLesson: EditorLessonDetail = {
  ...sampleLesson,
  instructionsMd: "",
  hints: [],
  starterCode: "",
  solutionCode: "",
  wrongAnswers: [],
  testCount: 0,
};

/** What the server's renderer gives for the sample instructions. */
const samplePreview: LessonDocument = {
  blocks: [
    { kind: "heading", level: 2, children: [{ kind: "text", text: m.previewHeading }] },
    {
      kind: "paragraph",
      children: [
        { kind: "text", text: m.previewText },
        { kind: "code", text: m.previewCode },
        { kind: "text", text: m.previewTail },
      ],
    },
  ],
};

const fullLesson: EditorLessonDetail = {
  ...sampleLesson,
  wrongAnswers: [
    { label: m.sampleWrongLabel, code: m.sampleWrongCode },
    { label: m.sampleWrongLabel2, code: m.sampleWrongCode2 },
    { label: m.sampleWrongLabel3, code: m.sampleWrongCode3 },
  ],
};

/** A starter over the 10,000-character limit, so Save names the field. */
const tooLongLesson: EditorLessonDetail = {
  ...sampleLesson,
  starterCode: m.sampleStarter.repeat(300),
};

const codeText = [
  m.contentCodeName,
  m.contentCodeAssign,
  m.contentCodeInput,
  m.contentCodeOpen,
  m.contentCodePrompt,
  m.contentCodeClose,
  m.contentCodeComment,
].join("");

/** Every construct a lesson's instructions may hold, as the server renders it. */
const learnerContent: LessonDocument = {
  blocks: [
    { kind: "heading", level: 2, children: [{ kind: "text", text: m.contentHeading }] },
    { kind: "paragraph", children: [{ kind: "text", text: m.contentText }] },
    {
      kind: "code_block",
      language: "python",
      python: true,
      text: codeText,
      runs: [
        { text: m.contentCodeName },
        { text: m.contentCodeAssign },
        { text: m.contentCodeInput, kind: "builtin" },
        { text: m.contentCodeOpen },
        { text: m.contentCodePrompt, kind: "string" },
        { text: m.contentCodeClose },
        { text: m.contentCodeComment, kind: "comment" },
      ],
    },
    {
      kind: "table",
      align: ["start", "start"],
      head: [[{ kind: "text", text: m.tableFunction }], [{ kind: "text", text: m.tableReturns }]],
      rows: [
        [[{ kind: "code", text: m.tableInput }], [{ kind: "text", text: m.tableInputReturns }]],
        [[{ kind: "code", text: m.tableLen }], [{ kind: "text", text: m.tableLenReturns }]],
      ],
    },
    {
      kind: "quote",
      children: [{ kind: "paragraph", children: [{ kind: "text", text: m.contentQuote }] }],
    },
    {
      kind: "paragraph",
      children: [
        { kind: "text", text: m.contentLinkBefore },
        {
          kind: "link",
          href: "https://docs.python.org/3/library/functions.html#input",
          children: [{ kind: "text", text: m.contentLink }],
        },
      ],
    },
  ],
};

const refusingCourse: EditorCourse = {
  id: COURSE_ID,
  slug: "sample-course",
  title: m.sampleCourse,
  summary: m.sampleSummary,
  outcomes: [],
  status: "draft",
  loadedAt: "2026-11-21T08:00:00.000000+00:00",
  chapters: [
    {
      id: "5eed0000-0000-4000-8000-000000000101",
      title: m.sampleChapter,
      summary: "",
      loadedAt: "2026-11-21T08:00:00.000000+00:00",
      lessons: [
        { id: "5eed0000-0000-4000-8000-000000000201", title: m.sampleLesson, status: "draft" },
        { id: "5eed0000-0000-4000-8000-000000000202", title: m.secondLesson, status: "draft" },
      ],
    },
    {
      id: "5eed0000-0000-4000-8000-000000000102",
      title: m.secondChapter,
      summary: "",
      loadedAt: "2026-11-21T08:00:00.000000+00:00",
      lessons: [],
    },
  ],
};

export function AdminStateGallery({ nonce }: { nonce: string }) {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold text-text">{m.title}</h1>
        <p className="max-w-prose text-base text-text-muted">{m.intro}</p>
      </div>
      <Example id="gallery-empty" title={m.courseListEmpty}>
        <CourseList result={{ ok: true, courses: [] }} reorder={never} refresh={stay} />
      </Example>
      <Example id="gallery-failed" title={m.courseListFailed}>
        <CourseList result={{ ok: false }} reorder={never} refresh={stay} />
      </Example>
      <Example id="gallery-rows" title={m.courseListRows}>
        <CourseList
          result={{
            ok: true,
            courses: [
              {
                id: COURSE_ID,
                slug: "sample-course",
                title: m.sampleCourse,
                status: "published",
                publishedLessons: 1,
                draftLessons: 0,
              },
              {
                id: "5eed0000-0000-4000-8000-000000000002",
                slug: "second-course",
                title: m.secondCourse,
                status: "draft",
                publishedLessons: 0,
                draftLessons: 2,
              },
            ],
          }}
          reorder={refuse("cannot_move")}
          refresh={stay}
        />
      </Example>
      <Example id="gallery-editor-refusing" title={m.editorRefusing}>
        <CourseEditor
          course={refusingCourse}
          saveCourse={refuse("stale")}
          setStatus={refuse("no_published_lesson")}
          saveChapter={refuse("unavailable")}
          deleteChapter={refuse("unavailable")}
          reorder={refuse("cannot_move")}
          createLesson={refuse("unavailable")}
          refresh={stay}
        />
      </Example>
      <Example id="gallery-editor-empty" title={m.editorEmpty}>
        <CourseEditor
          course={{ ...refusingCourse, chapters: [] }}
          saveCourse={never}
          setStatus={never}
          saveChapter={never}
          deleteChapter={never}
          reorder={never}
          createLesson={never}
          refresh={stay}
        />
      </Example>
      <Example id="gallery-editor-published" title={m.editorPublished}>
        <CourseEditor
          course={{ ...refusingCourse, status: "published" }}
          saveCourse={never}
          setStatus={never}
          saveChapter={never}
          deleteChapter={never}
          reorder={never}
          createLesson={never}
          refresh={stay}
        />
      </Example>
      <Example id="gallery-editor-saving" title={m.editorSaving}>
        <CourseEditor
          course={refusingCourse}
          saveCourse={succeed({ id: COURSE_ID, updatedAt: SAVED_AT })}
          setStatus={succeed({ updatedAt: SAVED_AT })}
          saveChapter={succeed({ id: COURSE_ID })}
          deleteChapter={succeed(null)}
          reorder={succeed(null)}
          createLesson={never}
          refresh={stay}
        />
      </Example>
      <Example id="gallery-editor-failed" title={m.editorFailed}>
        <CourseEditorFailed headingId="gallery-editor-failed-heading" />
      </Example>
      <Example id="gallery-new-course" title={m.newCourse}>
        <NewCourseForm saveCourse={never} navigate={stay} />
      </Example>
      <Example id="gallery-new-course-taken" title={m.newCourseTaken}>
        <NewCourseForm saveCourse={refuse("slug_taken")} navigate={stay} />
      </Example>
      <Example id="gallery-setup" title={m.setupFailed}>
        <SetupFlow
          startSetup={() => Promise.resolve({ ok: false, error: "unavailable" })}
          confirmSetup={never}
          navigate={() => undefined}
        />
      </Example>
      <Example id="gallery-limited" title={m.codeLimited}>
        <SecondStepForm
          action={() => Promise.resolve({ ok: false, error: "rate_limited" })}
          submitLabel={secondStep.verify}
          navigate={() => undefined}
        />
      </Example>
      <Example id="gallery-checking" title={m.codeChecking}>
        <SecondStepForm action={never} submitLabel={secondStep.verify} navigate={() => undefined} />
      </Example>
      <Example id="gallery-lesson-editor" title={m.lessonEditor}>
        <LessonEditor
          lesson={sampleLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={succeed({ updatedAt: SAVED_AT })}
          renderPreview={succeed(samplePreview)}
        />
      </Example>
      <Example id="gallery-lesson-refusing" title={m.lessonRefusing}>
        <LessonEditor
          lesson={sampleLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={refuse("stale")}
          renderPreview={refuse("unavailable")}
        />
      </Example>
      <Example id="gallery-lesson-published" title={m.lessonPublished}>
        <LessonEditor
          lesson={{ ...sampleLesson, status: "published" }}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          renderPreview={never}
        />
      </Example>
      <Example id="gallery-lesson-full" title={m.lessonFull}>
        <LessonEditor
          lesson={fullLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={refuse("unavailable")}
          renderPreview={succeed(samplePreview)}
        />
      </Example>
      <Example id="gallery-lesson-taken" title={m.lessonTaken}>
        <LessonEditor
          lesson={sampleLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={refuse("slug_taken")}
          renderPreview={succeed(samplePreview)}
        />
      </Example>
      <Example id="gallery-lesson-too-long" title={m.lessonTooLong}>
        <LessonEditor
          lesson={tooLongLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          renderPreview={succeed(samplePreview)}
        />
      </Example>
      <Example id="gallery-lesson-content" title={m.lessonContent}>
        <div className="rounded-panel border border-border bg-surface p-4">
          <LessonContent document={learnerContent} topHeadingLevel={3} />
        </div>
      </Example>
      <Example id="gallery-lesson-empty" title={m.lessonEmpty}>
        <LessonEditor
          lesson={emptyLesson}
          initialPreview={{ blocks: [] }}
          nonce={nonce}
          save={succeed({ updatedAt: SAVED_AT })}
          renderPreview={succeed({ blocks: [] })}
        />
      </Example>
    </div>
  );
}
