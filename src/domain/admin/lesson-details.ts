import { z } from "../schema";
import { SLUG_PATTERN, trimmedText } from "./course-details";

// A lesson's draft as the owner writes it in the lesson editor
// (docs/spec/04-content-system.md section 1.3; docs/spec/03-experience.md
// section 7.4; FR-ADM-04). The editor checks it before it sends, to name the
// field that is wrong; the server action parses it again, and the database
// checks the same limits a third time (migration 20261120120100_content_checks.sql).
// A draft may lack instructions; publishing needs them (section 4.1).

export const LESSON_LIMITS = {
  title: 60,
  slug: 60,
  instructions: 20_000,
  hints: 5,
  hint: 300,
  code: 10_000,
  wrongAnswers: 3,
  wrongAnswerLabel: 80,
  xpMin: 5,
  xpMax: 50,
} as const;

/** Code is kept as written: whitespace is part of a Python program. */
const code = z.string().max(LESSON_LIMITS.code);

export const wrongAnswer = z.strictObject({
  label: trimmedText(1, LESSON_LIMITS.wrongAnswerLabel),
  code,
});

export const lessonDraft = z.strictObject({
  chapterId: z.uuid(),
  title: trimmedText(1, LESSON_LIMITS.title),
  slug: z.string().max(LESSON_LIMITS.slug).pipe(z.string().regex(SLUG_PATTERN)),
  xp: z.number().int().min(LESSON_LIMITS.xpMin).max(LESSON_LIMITS.xpMax),
  instructionsMd: z.string().max(LESSON_LIMITS.instructions),
  hints: z.array(trimmedText(1, LESSON_LIMITS.hint)).max(LESSON_LIMITS.hints),
  starterCode: code,
  solutionCode: code,
  wrongAnswers: z.array(wrongAnswer).max(LESSON_LIMITS.wrongAnswers),
});

export type LessonDraft = z.infer<typeof lessonDraft>;

export type LessonField =
  | "title"
  | "slug"
  | "xp"
  | "instructionsMd"
  | "hint"
  | "starterCode"
  | "solutionCode"
  | "wrongAnswerLabel"
  | "wrongAnswerCode";

/** What the editor's fields hold. Blank hint lines are dropped before sending. */
export type LessonFields = {
  chapterId: string;
  title: string;
  slug: string;
  xp: string;
  instructionsMd: string;
  hints: readonly string[];
  starterCode: string;
  solutionCode: string;
  wrongAnswers: readonly { label: string; code: string }[];
};

export type CheckedLesson =
  | { ok: true; draft: LessonDraft }
  | { ok: false; invalid: { field: LessonField; index?: number }[] };

/** The draft to send, or every field that is wrong, in the order they appear. */
export function checkLessonFields(fields: LessonFields): CheckedLesson {
  const invalid: { field: LessonField; index?: number }[] = [];
  const shape = lessonDraft.shape;
  const xp = /^\d{1,3}$/.test(fields.xp.trim()) ? Number(fields.xp.trim()) : Number.NaN;
  if (!shape.title.safeParse(fields.title).success) invalid.push({ field: "title" });
  if (!shape.slug.safeParse(fields.slug).success) invalid.push({ field: "slug" });
  if (!shape.xp.safeParse(xp).success) invalid.push({ field: "xp" });
  if (!shape.instructionsMd.safeParse(fields.instructionsMd).success) {
    invalid.push({ field: "instructionsMd" });
  }
  const hint = trimmedText(1, LESSON_LIMITS.hint);
  fields.hints.forEach((value, index) => {
    if (value.trim() !== "" && !hint.safeParse(value).success)
      invalid.push({ field: "hint", index });
  });
  if (!code.safeParse(fields.starterCode).success) invalid.push({ field: "starterCode" });
  if (!code.safeParse(fields.solutionCode).success) invalid.push({ field: "solutionCode" });
  fields.wrongAnswers.forEach((answer, index) => {
    if (!wrongAnswer.shape.label.safeParse(answer.label).success) {
      invalid.push({ field: "wrongAnswerLabel", index });
    }
    if (!code.safeParse(answer.code).success) invalid.push({ field: "wrongAnswerCode", index });
  });
  if (invalid.length > 0) return { ok: false, invalid };
  return {
    ok: true,
    draft: lessonDraft.parse({
      chapterId: fields.chapterId,
      title: fields.title,
      slug: fields.slug,
      xp,
      instructionsMd: fields.instructionsMd,
      hints: fields.hints.filter((line) => line.trim() !== ""),
      starterCode: fields.starterCode,
      solutionCode: fields.solutionCode,
      wrongAnswers: fields.wrongAnswers.map(({ label, code }) => ({ label, code })),
    }),
  };
}

/**
 * An address made from a title: lower case, runs of anything else turned into
 * one hyphen, and cut to the limit. Undefined when nothing usable is left, as
 * for a title in another script; the owner then writes the address.
 */
export function slugFromTitle(title: string): string | undefined {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LESSON_LIMITS.slug)
    .replace(/-+$/, "");
  return SLUG_PATTERN.test(slug) ? slug : undefined;
}

/** The first of `base`, `base-2`, `base-3` and so on that is not taken. */
export function freeSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, LESSON_LIMITS.slug - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
