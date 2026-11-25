import { describe, expect, it } from "vitest";
import {
  checkLessonFields,
  freeSlug,
  LESSON_LIMITS,
  lessonDraft,
  type LessonFields,
  slugFromTitle,
} from "./lesson-details";

const CHAPTER = "8a1f0c2e-6a59-4f0e-9d3b-2f4c1b7e9a10";

const fields = (extra: Partial<LessonFields> = {}): LessonFields => ({
  chapterId: CHAPTER,
  title: "Ask, then answer",
  slug: "ask-then-answer",
  xp: "10",
  instructionsMd: "## Ask\n\nUse `input()`.",
  hints: ["Use input()", ""],
  starterCode: "# Ask for a name\n",
  solutionCode: 'name = input("Name? ")\nprint(f"Hello, {name}")\n',
  wrongAnswers: [{ label: "Prints without a name", code: 'print("Hello")' }],
  ...extra,
});

describe("checkLessonFields [FR-ADM-04]", () => {
  it("accepts a complete draft, drops blank hints, and keeps code exactly", () => {
    const checked = checkLessonFields(fields({ starterCode: "  x = 1  \n\n" }));
    expect(checked).toEqual({
      ok: true,
      draft: {
        chapterId: CHAPTER,
        title: "Ask, then answer",
        slug: "ask-then-answer",
        xp: 10,
        instructionsMd: "## Ask\n\nUse `input()`.",
        hints: ["Use input()"],
        starterCode: "  x = 1  \n\n",
        solutionCode: 'name = input("Name? ")\nprint(f"Hello, {name}")\n',
        wrongAnswers: [{ label: "Prints without a name", code: 'print("Hello")' }],
      },
    });
  });

  it("accepts a draft with no instructions, starter, hints or wrong answers", () => {
    const checked = checkLessonFields(
      fields({ instructionsMd: "", starterCode: "", hints: [], wrongAnswers: [] }),
    );
    expect(checked.ok).toBe(true);
  });

  it("names every wrong field, with the line or answer it is in", () => {
    const checked = checkLessonFields(
      fields({
        title: " ",
        slug: "Not A Slug",
        xp: "4",
        instructionsMd: "x".repeat(LESSON_LIMITS.instructions + 1),
        hints: ["ok", "h".repeat(LESSON_LIMITS.hint + 1)],
        starterCode: "s".repeat(LESSON_LIMITS.code + 1),
        solutionCode: "s".repeat(LESSON_LIMITS.code + 1),
        wrongAnswers: [
          { label: "fine", code: "" },
          { label: "", code: "c".repeat(LESSON_LIMITS.code + 1) },
        ],
      }),
    );
    expect(checked).toEqual({
      ok: false,
      invalid: [
        { field: "title" },
        { field: "slug" },
        { field: "xp" },
        { field: "instructionsMd" },
        { field: "hint", index: 1 },
        { field: "starterCode" },
        { field: "solutionCode" },
        { field: "wrongAnswerLabel", index: 1 },
        { field: "wrongAnswerCode", index: 1 },
      ],
    });
  });

  it.each(["5", "50", " 20 "])("accepts XP %j", (xp) => {
    expect(checkLessonFields(fields({ xp })).ok).toBe(true);
  });

  it.each(["4", "51", "", "10.5", "1e1", "-5", "abc"])("refuses XP %j", (xp) => {
    expect(checkLessonFields(fields({ xp }))).toEqual({ ok: false, invalid: [{ field: "xp" }] });
  });

  it("holds each limit at the limit", () => {
    const checked = checkLessonFields(
      fields({
        title: "t".repeat(LESSON_LIMITS.title),
        slug: "s".repeat(LESSON_LIMITS.slug),
        instructionsMd: "x".repeat(LESSON_LIMITS.instructions),
        hints: Array.from({ length: LESSON_LIMITS.hints }, () => "h".repeat(LESSON_LIMITS.hint)),
        wrongAnswers: Array.from({ length: LESSON_LIMITS.wrongAnswers }, () => ({
          label: "l".repeat(LESSON_LIMITS.wrongAnswerLabel),
          code: "c".repeat(LESSON_LIMITS.code),
        })),
      }),
    );
    expect(checked.ok).toBe(true);
  });

  it("refuses a sixth hint and a fourth wrong answer at the schema", () => {
    const base = lessonDraft.parse({
      chapterId: CHAPTER,
      title: "t",
      slug: "t",
      xp: 10,
      instructionsMd: "",
      hints: [],
      starterCode: "",
      solutionCode: "",
      wrongAnswers: [],
    });
    expect(lessonDraft.safeParse({ ...base, hints: Array(6).fill("h") }).success).toBe(false);
    expect(
      lessonDraft.safeParse({ ...base, wrongAnswers: Array(4).fill({ label: "l", code: "" }) })
        .success,
    ).toBe(false);
    expect(lessonDraft.safeParse({ ...base, extra: 1 }).success).toBe(false);
    expect(lessonDraft.safeParse({ ...base, chapterId: "nope" }).success).toBe(false);
  });
});

describe("slugFromTitle and freeSlug", () => {
  it.each([
    ["Ask, then answer", "ask-then-answer"],
    ["  Café au lait  ", "cafe-au-lait"],
    ["f-strings & you!", "f-strings-you"],
    ["مرحبا", undefined],
    ["---", undefined],
    ["a".repeat(70), "a".repeat(60)],
    [`${"a".repeat(59)} b`, "a".repeat(59)],
  ])("makes %j into %j", (title, slug) => {
    expect(slugFromTitle(title)).toBe(slug);
  });

  it("adds the first free number, and stays within the limit", () => {
    expect(freeSlug("loops", new Set())).toBe("loops");
    expect(freeSlug("loops", new Set(["loops", "loops-2"]))).toBe("loops-3");
    const long = "a".repeat(60);
    expect(freeSlug(long, new Set([long]))).toBe(`${"a".repeat(58)}-2`);
  });
});
