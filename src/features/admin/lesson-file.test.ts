import { describe, expect, it } from "vitest";
import { parseTestCases } from "@/grader/test-case";
import {
  COURSE_FILE_FORMAT,
  courseFile,
  courseFileName,
  type ExportedLesson,
  fileText,
  LESSON_FILE_FORMAT,
  lessonFile,
  parseLessonFile,
  parseLessonFileText,
} from "./lesson-file";

// The export and import format (docs/spec/04-content-system.md section 8;
// FR-ADM-12): an exported lesson reads back as the same lesson, and a file
// that is wrong is refused with the field that is wrong named.

const tests = parseTestCases([
  { id: "greets", name: "Greets Sara by name", stdin: "Sara\n", expected: "Hello, Sara!" },
  {
    id: "asks",
    name: "Asks first",
    expected: "What is your name?",
    match: "contains",
    hint: "Ask",
  },
]);
if (!tests.ok) throw new Error("fixture");

const sampleLesson: ExportedLesson = {
  title: "Say hello by name",
  slug: "say-hello-by-name",
  xp: 10,
  instructionsMd: "## Ask, then answer\n\nUse `input()`.",
  hints: ["Store the answer first."],
  starterCode: "# Ask for a name\n",
  solutionCode: 'name = input("What is your name? ")\nprint("Hello, " + name + "!")\n',
  wrongAnswers: [{ label: "prints a fixed name", code: 'print("Hello, Sara!")' }],
  testCases: tests.value,
};

const file = lessonFile(sampleLesson);

/** The file as an owner might change it: one field replaced or removed. */
function changed(patch: Record<string, unknown>, drop?: string): unknown {
  const copy: Record<string, unknown> = { ...JSON.parse(fileText(file)), ...patch };
  if (drop !== undefined) delete copy[drop];
  return copy;
}

const field = (value: unknown) => {
  const result = parseLessonFile(value);
  return result.ok ? "ok" : result.problem === "invalid_field" ? result.field : result.problem;
};

describe("lesson files [FR-ADM-12]", () => {
  it("writes the section 8 fields, in its order, with the test cases whole", () => {
    expect(Object.keys(file)).toEqual([
      "format",
      "version",
      "title",
      "slug",
      "xp",
      "instructions_md",
      "hints",
      "starter_code",
      "solution_code",
      "wrong_answers",
      "tests",
    ]);
    expect(file.format).toBe(LESSON_FILE_FORMAT);
    expect(file.version).toBe(1);
    expect(file.tests[0]).toEqual({
      id: "greets",
      name: "Greets Sara by name",
      stdin: "Sara\n",
      afterCode: "",
      expected: "Hello, Sara!",
      match: "normalized",
      hint: "",
    });
  });

  it("reads an exported lesson back as the same lesson", () => {
    const text = fileText(file);
    expect(text.endsWith("}\n")).toBe(true);
    expect(parseLessonFileText(text)).toEqual({ ok: true, lesson: file });
  });

  it("reads a draft with no test cases", () => {
    const empty = lessonFile({ ...sampleLesson, testCases: [], wrongAnswers: [], hints: [] });
    expect(parseLessonFileText(fileText(empty))).toEqual({ ok: true, lesson: empty });
  });

  it("does not share arrays with the lesson it was made from", () => {
    expect(file.hints).not.toBe(sampleLesson.hints);
    expect(file.tests[0]).not.toBe(sampleLesson.testCases[0]);
  });

  it("refuses text that is not JSON", () => {
    expect(parseLessonFileText("{ title: ")).toEqual({ ok: false, problem: "not_json" });
    expect(parseLessonFileText("")).toEqual({ ok: false, problem: "not_json" });
  });

  it.each([
    ["a list", [], "format"],
    ["a string", "lesson", "format"],
    ["null", null, "format"],
    ["a course file", changed({ format: COURSE_FILE_FORMAT }), "format"],
    ["a later version", changed({ version: 2 }), "version"],
    ["no title", changed({}, "title"), "title"],
    ["a blank title", changed({ title: "   " }), "title"],
    ["an address with spaces", changed({ slug: "say hello" }), "slug"],
    ["too much XP", changed({ xp: 51 }), "xp"],
    ["XP as text", changed({ xp: "10" }), "xp"],
    ["a field it does not have", changed({ status: "published" }), "status"],
    ["a long hint", changed({ hints: ["ok", "x".repeat(301)] }), "hints[1]"],
    ["six hints", changed({ hints: ["a", "b", "c", "d", "e", "f"] }), "hints"],
    ["code too long", changed({ solution_code: "x".repeat(10_001) }), "solution_code"],
    [
      "a wrong answer with no label",
      changed({ wrong_answers: [{ label: "", code: "pass" }] }),
      "wrong_answers[0].label",
    ],
    ["test cases that are not a list", changed({ tests: {} }), "tests"],
    ["13 test cases", changed({ tests: Array.from({ length: 13 }, () => file.tests[0]) }), "tests"],
    [
      "a test case with no expected output",
      changed({ tests: [file.tests[0], { id: "x", name: "Second" }] }),
      "tests[1].expected",
    ],
    [
      "two test cases with one ID",
      changed({ tests: [file.tests[0], file.tests[0]] }),
      "tests[1].id",
    ],
    [
      "a test case with a field it does not have",
      changed({ tests: [{ ...file.tests[0], points: 3 }] }),
      "tests[0]",
    ],
    ["a test case that is not an object", changed({ tests: ["greets"] }), "tests[0]"],
    [
      "an unknown comparison",
      changed({ tests: [{ ...file.tests[0], match: "fuzzy" }] }),
      "tests[0].match",
    ],
  ])("refuses %s and names the field", (_, value, expected) => {
    expect(field(value)).toBe(expected);
  });

  it("cuts a long unknown key from the file to 60 characters", () => {
    expect(field(changed({ ["k".repeat(500)]: 1 }))).toBe(`${"k".repeat(60)}…`);
  });

  it("names the field in a file read from text", () => {
    expect(parseLessonFileText(JSON.stringify(changed({ xp: 0 })))).toEqual({
      ok: false,
      problem: "invalid_field",
      field: "xp",
    });
  });
});

describe("course files [FR-ADM-12]", () => {
  const course = courseFile({
    title: "Python basics",
    slug: "python-basics",
    summary: "Write your first programs.",
    outcomes: ["Print text"],
    chapters: [
      { title: "First steps", summary: "", lessons: [sampleLesson] },
      { title: "Empty", summary: "Soon", lessons: [] },
    ],
  });

  it("wraps the course fields and its chapters, each lesson in the lesson shape", () => {
    expect(course).toEqual({
      format: COURSE_FILE_FORMAT,
      version: 1,
      title: "Python basics",
      slug: "python-basics",
      summary: "Write your first programs.",
      outcomes: ["Print text"],
      chapters: [
        { title: "First steps", summary: "", lessons: [file] },
        { title: "Empty", summary: "Soon", lessons: [] },
      ],
    });
    expect(courseFileName(course.slug)).toBe("python-basics.json");
  });

  it("lets one lesson be cut out of a course file and imported", () => {
    const lesson = (JSON.parse(fileText(course)) as typeof course).chapters[0]?.lessons[0];
    expect(parseLessonFile(lesson)).toEqual({ ok: true, lesson: file });
  });
});
