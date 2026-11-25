import { z } from "@/domain/schema";
import { lessonDraft } from "@/domain/admin/lesson-details";
import { CHECK_TEST_LIMIT, parseTestCases, type TestCase } from "@/grader/test-case";

// The export and import format of docs/spec/04-content-system.md section 8
// (FR-ADM-12). A lesson is one JSON object; a course wraps its fields and its
// chapters, each with its lessons in the same shape, so one lesson can be cut
// out of a course file and imported. The dashboard parses an imported file
// with this module to name the field that is wrong, and the server action
// parses it again. Test cases go through the grader's one parser.

export const LESSON_FILE_FORMAT = "heap-academy.lesson";
export const COURSE_FILE_FORMAT = "heap-academy.course";
export const FILE_VERSION = 1;

/** A file larger than this is refused before it is read. A full lesson is far smaller. */
export const LESSON_FILE_MAX_BYTES = 1024 * 1024;

export type LessonFile = {
  format: typeof LESSON_FILE_FORMAT;
  version: typeof FILE_VERSION;
  title: string;
  slug: string;
  xp: number;
  instructions_md: string;
  hints: string[];
  starter_code: string;
  solution_code: string;
  wrong_answers: { label: string; code: string }[];
  tests: TestCase[];
};

export type CourseFile = {
  format: typeof COURSE_FILE_FORMAT;
  version: typeof FILE_VERSION;
  title: string;
  slug: string;
  summary: string;
  outcomes: string[];
  chapters: { title: string; summary: string; lessons: LessonFile[] }[];
};

/** A lesson as the editor holds it, which is what an export writes. */
export type ExportedLesson = {
  title: string;
  slug: string;
  xp: number;
  instructionsMd: string;
  hints: readonly string[];
  starterCode: string;
  solutionCode: string;
  wrongAnswers: readonly { label: string; code: string }[];
  testCases: readonly TestCase[];
};

export function lessonFile(lesson: ExportedLesson): LessonFile {
  return {
    format: LESSON_FILE_FORMAT,
    version: FILE_VERSION,
    title: lesson.title,
    slug: lesson.slug,
    xp: lesson.xp,
    instructions_md: lesson.instructionsMd,
    hints: [...lesson.hints],
    starter_code: lesson.starterCode,
    solution_code: lesson.solutionCode,
    wrong_answers: lesson.wrongAnswers.map(({ label, code }) => ({ label, code })),
    tests: lesson.testCases.map((test) => ({ ...test })),
  };
}

export function courseFile(course: {
  title: string;
  slug: string;
  summary: string;
  outcomes: readonly string[];
  chapters: readonly {
    title: string;
    summary: string;
    lessons: readonly ExportedLesson[];
  }[];
}): CourseFile {
  return {
    format: COURSE_FILE_FORMAT,
    version: FILE_VERSION,
    title: course.title,
    slug: course.slug,
    summary: course.summary,
    outcomes: [...course.outcomes],
    chapters: course.chapters.map((chapter) => ({
      title: chapter.title,
      summary: chapter.summary,
      lessons: chapter.lessons.map(lessonFile),
    })),
  };
}

/** The file's text: indented, so it reads and compares well in a text editor. */
export function fileText(file: LessonFile | CourseFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function courseFileName(slug: string): string {
  return `${slug}.json`;
}

const draft = lessonDraft.shape;
const lessonShape = z.strictObject({
  format: z.literal(LESSON_FILE_FORMAT),
  version: z.literal(FILE_VERSION),
  title: draft.title,
  slug: draft.slug,
  xp: draft.xp,
  instructions_md: draft.instructionsMd,
  hints: draft.hints,
  starter_code: draft.starterCode,
  solution_code: draft.solutionCode,
  wrong_answers: draft.wrongAnswers,
  tests: z.array(z.unknown()).max(CHECK_TEST_LIMIT),
});

export type LessonFileResult =
  | { ok: true; lesson: LessonFile }
  | { ok: false; problem: "not_json" }
  /** `field` is where the file is wrong, as a path into it: `tests[0].expected`. */
  | { ok: false; problem: "invalid_field"; field: string };

function fieldPath(path: readonly PropertyKey[]): string {
  return path
    .map((key, index) =>
      typeof key === "number" ? `[${String(key)}]` : `${index === 0 ? "" : "."}${String(key)}`,
    )
    .join("");
}

/** Parses a lesson file that is already JSON, naming the first field that is wrong. */
export function parseLessonFile(value: unknown): LessonFileResult {
  const parsed = lessonShape.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue === undefined) return { ok: false, problem: "invalid_field", field: "format" };
    const path = [...issue.path];
    // A key the format does not have is named itself.
    if (issue.code === "unrecognized_keys" && issue.keys[0] !== undefined) path.push(issue.keys[0]);
    // A value that is not an object at all is wrong from its first field.
    return {
      ok: false,
      problem: "invalid_field",
      field: path.length === 0 ? "format" : fieldPath(path),
    };
  }
  const { tests, ...rest } = parsed.data;
  if (tests.length === 0) return { ok: true, lesson: { ...rest, tests: [] } };
  const cases = parseTestCases(tests);
  if (!cases.ok) {
    const { index, field } = cases.error;
    const at = index === undefined ? "tests" : `tests[${String(index)}]`;
    return {
      ok: false,
      problem: "invalid_field",
      field: field === "testCase" ? at : `${at}.${field}`,
    };
  }
  return { ok: true, lesson: { ...rest, tests: cases.value } };
}

/** Parses the text of a lesson file. */
export function parseLessonFileText(text: string): LessonFileResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, problem: "not_json" };
  }
  return parseLessonFile(value);
}
