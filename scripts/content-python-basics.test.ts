import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parseMarkdown } from "../src/content/markdown/parse";
import { courseDetails } from "../src/domain/admin/course-details";
import { LESSON_LIMITS, lessonDraft } from "../src/domain/admin/lesson-details";
import { z } from "../src/domain/schema";
import { createNodeRunner } from "../src/grader/node-runner/runner";
import { parseTestCases, type TestCase, type TestCaseId } from "../src/grader/test-case";
import { validateLesson, validationPassed } from "../src/grader/validation";

// The Python basics course as files (content/python-basics): each lesson has
// the shape of docs/spec/04-content-system.md section 8, and passes the five
// validation rules of section 4.1 with the learners' harness.

const root = join(import.meta.dirname, "..", "content", "python-basics");
const read = (path: string): unknown => JSON.parse(readFileSync(join(root, path), "utf8"));

/** What the person types in a lesson's code samples that call `input()`. */
const SAMPLE_INPUT: Record<string, string> = {
  "ask-a-question": "green\n",
  "calculate-with-input": "11\n",
};

const course = z
  .strictObject({
    ...courseDetails.shape,
    chapters: z.array(
      z.strictObject({
        title: z.string().min(1).max(60),
        summary: z.string().max(140),
        lessons: z.array(z.string()).min(3).max(5),
      }),
    ),
  })
  .parse(read("course.json"));

const draft = lessonDraft.shape;
const lessonShape = z.strictObject({
  format: z.literal("heap-academy.lesson"),
  version: z.literal(1),
  title: draft.title,
  slug: draft.slug,
  xp: draft.xp,
  instructions_md: draft.instructionsMd,
  hints: draft.hints,
  starter_code: draft.starterCode,
  solution_code: draft.solutionCode,
  wrong_answers: draft.wrongAnswers,
  tests: z.array(z.unknown()),
});

const paths = course.chapters.flatMap((chapter) => chapter.lessons);
const lessons = paths.map((path) => {
  const { tests, ...lesson } = lessonShape.parse(read(path));
  const parsed = parseTestCases(tests);
  if (!parsed.ok) throw new Error(`${path}: ${JSON.stringify(parsed.error)}`);
  return { path, ...lesson, testCases: parsed.value };
});

/** Each Python sample in the instructions, with the block shown after it. */
function samples(markdown: string) {
  const blocks = parseMarkdown(markdown);
  return blocks.flatMap((block, index) => {
    if (block.kind !== "code_block" || block.language !== "python") return [];
    const shown = blocks
      .slice(index + 1)
      .find((later) => later.kind === "code_block" && later.language === "text");
    return [{ code: block.text, output: shown?.kind === "code_block" ? shown.text : undefined }];
  });
}

const runner = createNodeRunner();
afterAll(() => runner.close());

const LOADING_MS = 60_000;

describe("the Python basics course", () => {
  it("lists every lesson file once, with unique addresses", () => {
    const files = readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((name) => name.endsWith(".json") && name !== "course.json")
      .sort();
    expect([...paths].sort()).toEqual(files);
    expect(new Set(lessons.map((lesson) => lesson.slug)).size).toBe(lessons.length);
  });

  describe.each(lessons.map((lesson) => [lesson.path, lesson] as const))("%s", (_path, lesson) => {
    it(
      "passes validation, and each wrong answer is caught",
      async () => {
        const run = async (source: string) =>
          (await runner.check(source, lesson.testCases)).results;
        const wrongAnswers = [];
        for (const answer of lesson.wrong_answers) wrongAnswers.push(await run(answer.code));
        const rules = validateLesson(
          {
            title: lesson.title,
            slug: lesson.slug,
            instructionsMd: lesson.instructions_md,
            testCaseCount: lesson.testCases.length,
          },
          {
            solution: await run(lesson.solution_code),
            starter: await run(lesson.starter_code),
            wrongAnswers,
          },
        );
        expect(validationPassed(rules), JSON.stringify(rules)).toBe(true);
        expect(lesson.wrong_answers.length).toBeGreaterThan(0);
        expect(lesson.hints.length).toBeGreaterThan(0);
        expect(lesson.hints.length).toBeLessThanOrEqual(LESSON_LIMITS.hints);
      },
      LOADING_MS,
    );

    it(
      "shows the real output of its code samples",
      async () => {
        const found = samples(lesson.instructions_md);
        expect(found.length).toBeGreaterThan(0);
        for (const sample of found) {
          expect(sample.output, sample.code).toBeDefined();
          const shown: TestCase = {
            id: "sample" as TestCaseId,
            name: "sample",
            stdin: SAMPLE_INPUT[lesson.slug] ?? "",
            afterCode: "",
            expected: sample.output ?? "",
            match: "normalized",
            hint: "",
          };
          const report = await runner.check(sample.code, [shown]);
          expect(report.results[0], sample.code).toMatchObject({ status: "passed" });
        }
      },
      LOADING_MS,
    );

    it("explains in at most 150 words before the first code sample", () => {
      const before = lesson.instructions_md.split("```")[0] ?? "";
      const words = before.split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word));
      expect(words.length).toBeLessThanOrEqual(150);
    });
  });
});
