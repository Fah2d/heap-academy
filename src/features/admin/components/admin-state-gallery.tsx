"use client";

import { createContext, type ReactNode, useContext } from "react";
import { adminGallery as m } from "@/messages/gallery";
import { secondStep } from "@/messages/admin";
import type { LessonDocument } from "@/content/markdown";
import { type TestResult, unfinished } from "@/grader/grade";
import { HARNESS_OUTPUT_LIMIT, HARNESS_VERSION } from "@/grader/harness";
import type { TestCase, TestCaseId } from "@/grader/test-case";
import type { EditorCourse, EditorLessonDetail } from "../types";
import { CourseEditor } from "./course-editor";
import { CourseEditorFailed } from "./course-editor-failed";
import { CourseList } from "./course-list";
import { CourseTransfer } from "./course-transfer";
import { fixedResultsRuntime, scriptedRuntime, stuckRuntime } from "./gallery-runtimes";
import { LessonContent } from "@/features/workspace";
import { LessonEditor } from "./lesson-editor";
import { NewCourseForm } from "./new-course-form";
import { SecondStepForm } from "./second-step-form";
import { SetupFlow } from "./setup-flow";

// Development only (src/app/dev/admin/page.dev.tsx): each state of the admin
// views that the J-12 journey cannot reach, with fake actions, so the e2e
// gallery spec can check and photograph them (WP-2.3 design review 1).

/** The one example a page shows when its address names it (`?example=<id>`). */
const ShownExample = createContext<string | undefined>(undefined);

function Example({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const shown = useContext(ShownExample);
  if (shown !== undefined && shown !== id) return null;
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
  testCases: [
    {
      id: "greets-sara" as TestCaseId,
      name: m.sampleTestName,
      stdin: m.sampleTestInput,
      afterCode: "",
      expected: m.sampleTestExpected,
      match: "normalized",
      hint: "",
    },
    {
      id: "works-for-omar" as TestCaseId,
      name: m.sampleTestName2,
      stdin: m.sampleTestInput2,
      afterCode: "",
      expected: m.sampleTestExpected2,
      match: "normalized",
      hint: "",
    },
  ],
  loadedAt: "2026-11-22T08:00:00.000000+00:00",
};

const emptyLesson: EditorLessonDetail = {
  ...sampleLesson,
  instructionsMd: "",
  hints: [],
  starterCode: "",
  solutionCode: "",
  wrongAnswers: [],
  testCases: [],
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

/** The most test cases a lesson can have. */
const twelveTestsLesson: EditorLessonDetail = {
  ...sampleLesson,
  testCases: [
    ...sampleLesson.testCases,
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `extra-${String(index + 3)}` as TestCaseId,
      name: m.extraTestName(index + 3),
      stdin: m.extraTestInput(index + 3),
      afterCode: "",
      expected: m.extraTestExpected(index + 3),
      match: "normalized" as const,
      hint: "",
    })),
  ],
};

/** A test case with no name and an expected output over 5,000 characters, so Save names both. */
const testProblemLesson: EditorLessonDetail = {
  ...sampleLesson,
  testCases: sampleLesson.testCases.map((testCase, index) =>
    index === 1 ? { ...testCase, name: "", expected: m.sampleTestExpected2.repeat(200) } : testCase,
  ),
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

/** What the sample solution prints for each test case: the expected output, with its line end. */
const samplePrints = new Map(
  twelveTestsLesson.testCases.map((testCase) => [testCase.id, `${testCase.expected}\n`]),
);
/** The starter and the wrong answers print only the prompt, so each fails every test case. */
const sampleRuntime = scriptedRuntime(m.sampleSolution, samplePrints, m.samplePromptOnly);

// Made once: the editor opens its runtime again whenever this function changes.
const loadingRuntime = stuckRuntime("loading");
const failedRuntime = stuckRuntime("failed");
const readyRuntime = stuckRuntime("ready");
/** Python that started, but whose every check ends with no results. */
const cannotRunRuntime = fixedResultsRuntime(() => undefined);

/** The second test case expects the greeting without the prompt, so the solution fails it. */
const wrongExpectedLesson: EditorLessonDetail = {
  ...sampleLesson,
  testCases: sampleLesson.testCases.map((testCase, index) =>
    index === 1 ? { ...testCase, expected: m.wrongExpected } : testCase,
  ),
};

/** A third test case, which the odd solution prints past the output limit for. */
const oddLesson: EditorLessonDetail = {
  ...sampleLesson,
  testCases: [
    ...sampleLesson.testCases,
    {
      id: "greets-many-times" as TestCaseId,
      name: m.oddTestName3,
      stdin: m.sampleTestInput,
      afterCode: "",
      expected: m.sampleTestExpected,
      match: "normalized",
      hint: "",
    },
  ],
};

const failedResult = (
  testCase: TestCase,
  ending: Pick<
    Extract<TestResult, { status: "failed" }>,
    "reason" | "actual" | "truncated" | "error"
  >,
): TestResult => ({
  testCaseId: testCase.id,
  status: "failed",
  harnessVersion: HARNESS_VERSION,
  ...ending,
});

/**
 * The solution prints escape sequences for the first test case, stops with
 * an error on line 2 for the second, and prints past the output limit for
 * the third; the starter reaches the time limit; the wrong answer prints
 * only the prompt. The cut output is as long as the harness keeps, so the
 * picture shows the box at its real size.
 */
const oddRuntime = fixedResultsRuntime((source, tests) => {
  if (source === m.sampleStarter) return unfinished(tests, "time_limit");
  if (source !== m.sampleSolution) {
    return tests.map((testCase) =>
      failedResult(testCase, { reason: "mismatch", actual: m.samplePromptOnly, truncated: false }),
    );
  }
  return tests.map((testCase, index) => {
    if (index === 0) {
      return failedResult(testCase, {
        reason: "mismatch",
        actual: m.oddColoredOutput,
        truncated: false,
      });
    }
    if (index === 1) {
      return failedResult(testCase, {
        reason: "program_error",
        actual: m.samplePromptOnly,
        truncated: false,
        error: { kind: "runtime", message: m.oddErrorMessage, line: 2 },
      });
    }
    return failedResult(testCase, {
      reason: "output_limit",
      actual: m.oddRepeatedLine
        .repeat(Math.ceil(HARNESS_OUTPUT_LIMIT / m.oddRepeatedLine.length))
        .slice(0, HARNESS_OUTPUT_LIMIT),
      truncated: true,
    });
  });
});

export type AdminGalleryPart = "course" | "lesson" | "validation";

/**
 * One page per part, so that no page holds every editor at once. A page can
 * also show one example by itself, so that an axe run or a screenshot of it
 * costs the same however many examples the part has.
 */
export function AdminStateGallery({
  nonce,
  part,
  example,
}: {
  nonce: string;
  part: AdminGalleryPart;
  example?: string | undefined;
}) {
  const heading = m.pages[part];
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold text-text">{heading.title}</h1>
        <p className="max-w-prose text-base text-text-muted">{heading.intro}</p>
      </div>
      <ShownExample value={example}>
        <GalleryPart nonce={nonce} part={part} />
      </ShownExample>
    </div>
  );
}

function GalleryPart({ nonce, part }: { nonce: string; part: AdminGalleryPart }) {
  switch (part) {
    case "course":
      return <CourseStates />;
    case "lesson":
      return <LessonStates nonce={nonce} />;
    case "validation":
      return <ValidationStates nonce={nonce} />;
    default: {
      const unreachable: never = part;
      return unreachable;
    }
  }
}

function CourseStates() {
  return (
    <>
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
          exportCourse={refuse("unavailable")}
          importLesson={refuse("unavailable")}
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
          exportCourse={never}
          importLesson={never}
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
          exportCourse={never}
          importLesson={never}
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
          exportCourse={never}
          importLesson={never}
          refresh={stay}
        />
      </Example>
      <Example id="gallery-transfer-succeeding" title={m.transferSucceeding}>
        <CourseTransfer
          courseId={COURSE_ID}
          chapters={refusingCourse.chapters}
          exportCourse={succeed({ fileName: "sample-course.json", text: "{}\n" })}
          importLesson={succeed({ id: sampleLesson.id, slug: "say-hello-by-name-2" })}
          refresh={stay}
          save={stay}
        />
      </Example>
      <Example id="gallery-transfer-pending" title={m.transferPending}>
        <CourseTransfer
          courseId={COURSE_ID}
          chapters={refusingCourse.chapters}
          exportCourse={never}
          importLesson={never}
          refresh={stay}
          save={stay}
        />
      </Example>
      <Example id="gallery-transfer-failing" title={m.transferFailing}>
        <CourseTransfer
          courseId={COURSE_ID}
          chapters={refusingCourse.chapters}
          exportCourse={refuse("export_broken")}
          importLesson={refuse("import_left_draft")}
          refresh={stay}
          save={stay}
        />
      </Example>
      <Example id="gallery-editor-failed" title={m.editorFailed}>
        <CourseEditorFailed />
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
    </>
  );
}

/** The empty lesson, which both the lesson part and the validation part show. */
function EmptyLessonExample({ nonce }: { nonce: string }) {
  return (
    <Example id="gallery-lesson-empty" title={m.lessonEmpty}>
      <LessonEditor
        lesson={emptyLesson}
        initialPreview={{ blocks: [] }}
        nonce={nonce}
        save={succeed({ updatedAt: SAVED_AT })}
        setStatus={succeed({ updatedAt: SAVED_AT })}
        renderPreview={succeed({ blocks: [] })}
        openRuntime={sampleRuntime}
      />
    </Example>
  );
}

function LessonStates({ nonce }: { nonce: string }) {
  return (
    <>
      <Example id="gallery-lesson-editor" title={m.lessonEditor}>
        <LessonEditor
          lesson={sampleLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={succeed({ updatedAt: SAVED_AT })}
          setStatus={succeed({ updatedAt: SAVED_AT })}
          renderPreview={succeed(samplePreview)}
          openRuntime={sampleRuntime}
        />
      </Example>
      <Example id="gallery-lesson-refusing" title={m.lessonRefusing}>
        <LessonEditor
          lesson={sampleLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={refuse("stale")}
          setStatus={refuse("status_not_allowed")}
          renderPreview={refuse("unavailable")}
          openRuntime={sampleRuntime}
        />
      </Example>
      <Example id="gallery-lesson-published" title={m.lessonPublished}>
        <LessonEditor
          lesson={{ ...sampleLesson, status: "published" }}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          setStatus={never}
          renderPreview={never}
          openRuntime={sampleRuntime}
        />
      </Example>
      <Example id="gallery-lesson-archived" title={m.lessonArchived}>
        <LessonEditor
          lesson={{ ...sampleLesson, status: "archived" }}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          setStatus={never}
          renderPreview={never}
          openRuntime={sampleRuntime}
        />
      </Example>
      <Example id="gallery-lesson-full" title={m.lessonFull}>
        <LessonEditor
          lesson={fullLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={refuse("unavailable")}
          setStatus={never}
          renderPreview={succeed(samplePreview)}
          openRuntime={sampleRuntime}
        />
      </Example>
      <Example id="gallery-lesson-taken" title={m.lessonTaken}>
        <LessonEditor
          lesson={sampleLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={refuse("slug_taken")}
          setStatus={never}
          renderPreview={succeed(samplePreview)}
          openRuntime={sampleRuntime}
        />
      </Example>
      <Example id="gallery-lesson-too-long" title={m.lessonTooLong}>
        <LessonEditor
          lesson={tooLongLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          setStatus={never}
          renderPreview={succeed(samplePreview)}
          openRuntime={sampleRuntime}
        />
      </Example>
      <Example id="gallery-lesson-tests-full" title={m.lessonTestCasesFull}>
        <LessonEditor
          lesson={twelveTestsLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          setStatus={never}
          renderPreview={succeed(samplePreview)}
          openRuntime={sampleRuntime}
        />
      </Example>
      <Example id="gallery-lesson-test-problem" title={m.lessonTestCaseProblem}>
        <LessonEditor
          lesson={testProblemLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          setStatus={never}
          renderPreview={succeed(samplePreview)}
          openRuntime={sampleRuntime}
        />
      </Example>
      <Example id="gallery-lesson-content" title={m.lessonContent}>
        <div className="rounded-panel border border-border bg-surface p-4">
          <LessonContent document={learnerContent} topHeadingLevel={3} />
        </div>
      </Example>
      <EmptyLessonExample nonce={nonce} />
    </>
  );
}

function ValidationStates({ nonce }: { nonce: string }) {
  return (
    <>
      <Example id="gallery-lesson-python-loading" title={m.lessonPythonLoading}>
        <LessonEditor
          lesson={sampleLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          setStatus={never}
          renderPreview={succeed(samplePreview)}
          openRuntime={loadingRuntime}
        />
      </Example>
      <Example id="gallery-lesson-python-failed" title={m.lessonPythonFailed}>
        <LessonEditor
          lesson={sampleLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          setStatus={never}
          renderPreview={succeed(samplePreview)}
          openRuntime={failedRuntime}
        />
      </Example>
      <Example id="gallery-lesson-validating" title={m.lessonValidating}>
        <LessonEditor
          lesson={sampleLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          setStatus={never}
          renderPreview={succeed(samplePreview)}
          openRuntime={readyRuntime}
        />
      </Example>
      <Example id="gallery-lesson-python-cannot-run" title={m.lessonPythonCannotRun}>
        <LessonEditor
          lesson={sampleLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          setStatus={never}
          renderPreview={succeed(samplePreview)}
          openRuntime={cannotRunRuntime}
        />
      </Example>
      <Example id="gallery-lesson-save-validating" title={m.lessonSaveValidating}>
        <LessonEditor
          lesson={{ ...sampleLesson, status: "published" }}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          setStatus={never}
          renderPreview={succeed(samplePreview)}
          openRuntime={readyRuntime}
        />
      </Example>
      <Example id="gallery-lesson-save-python-failed" title={m.lessonSavePythonFailed}>
        <LessonEditor
          lesson={{ ...sampleLesson, status: "published" }}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          setStatus={never}
          renderPreview={succeed(samplePreview)}
          openRuntime={failedRuntime}
        />
      </Example>
      <Example id="gallery-lesson-save-python-cannot-run" title={m.lessonSavePythonCannotRun}>
        <LessonEditor
          lesson={{ ...sampleLesson, status: "published" }}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          setStatus={never}
          renderPreview={succeed(samplePreview)}
          openRuntime={cannotRunRuntime}
        />
      </Example>
      <Example id="gallery-lesson-save-rule-failed" title={m.lessonSaveRuleFailed}>
        <LessonEditor
          lesson={{ ...wrongExpectedLesson, status: "published" }}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          setStatus={never}
          renderPreview={succeed(samplePreview)}
          openRuntime={sampleRuntime}
        />
      </Example>
      <Example id="gallery-lesson-odd-results" title={m.lessonOddResults}>
        <LessonEditor
          lesson={oddLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={never}
          setStatus={never}
          renderPreview={succeed(samplePreview)}
          openRuntime={oddRuntime}
        />
      </Example>
      <Example id="gallery-lesson-validation-failed" title={m.lessonValidationFailed}>
        <LessonEditor
          lesson={wrongExpectedLesson}
          initialPreview={samplePreview}
          nonce={nonce}
          save={succeed({ updatedAt: SAVED_AT })}
          setStatus={succeed({ updatedAt: SAVED_AT })}
          renderPreview={succeed(samplePreview)}
          openRuntime={sampleRuntime}
        />
      </Example>
      <EmptyLessonExample nonce={nonce} />
    </>
  );
}
