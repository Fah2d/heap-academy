import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { SLUG_PATTERN } from "@/domain/admin/course-details";
import { createPublicClient, type PublicClient } from "@/infrastructure/db/public-client";
import { log } from "@/infrastructure/logging/logger";
import { contentLogRoute } from "@/infrastructure/logging/route";

// Published content for public pages (docs/spec/02-architecture.md sections
// 7.3 and 12; FR-ADM-11). Read with the session-less client, so row level
// security returns only what is published, and kept in the framework's data
// cache under one tag. An admin action that changes content expires the tag
// (src/content/invalidate.ts); the minute's revalidation is the backstop.

export const CONTENT_TAG = "content";

/** Seconds a cached answer may be served before it is read again (FR-ADM-11). */
export const CONTENT_REVALIDATE_SECONDS = 60;

const courseRow = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  lessons: z.array(z.object({ slug: z.string() })),
});

export type PublishedCourseSummary = {
  slug: string;
  title: string;
  summary: string;
  lessonCount: number;
};

const courseDetail = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  outcomes: z.array(z.string()),
  chapters: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      summary: z.string(),
      position: z.number().int(),
      lessons: z.array(
        z.object({ slug: z.string(), title: z.string(), position: z.number().int() }),
      ),
    }),
  ),
});

export type PublishedCourse = {
  slug: string;
  title: string;
  summary: string;
  outcomes: string[];
  chapters: {
    id: string;
    title: string;
    summary: string;
    lessons: { slug: string; title: string }[];
  }[];
};

const lessonRow = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  xp: z.number().int(),
  instructions_md: z.string(),
  hints: z.array(z.string()),
  starter_code: z.string(),
  tests: z.array(z.unknown()),
  courses: z.object({ slug: z.string(), title: z.string() }),
});

/**
 * One published lesson as a learner may read it (02-architecture.md section
 * 7.3): never its solution or wrong answers, which live in an admin-only
 * table. The test cases are left as stored; the workspace parses them with
 * the grader's schema, which `content` may not import.
 */
export type PublishedLesson = {
  id: string;
  slug: string;
  title: string;
  xp: number;
  instructionsMarkdown: string;
  hints: string[];
  starterCode: string;
  tests: unknown[];
  course: { slug: string; title: string };
};

export type ContentResult<Value> = { ok: true; value: Value } | { ok: false };

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

/** Every published course in the owner's order, with its published lesson count. */
export async function readPublishedCourses(db: PublicClient): Promise<PublishedCourseSummary[]> {
  const { data, error } = await db
    .from("courses")
    .select("slug, title, summary, lessons(slug)")
    .order("position")
    .order("title");
  if (error !== null) throw new Error(`published courses: ${error.code}`);
  return z
    .array(courseRow)
    .parse(data)
    .map((row) => ({
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      lessonCount: row.lessons.length,
    }));
}

/** One published course with its chapters and published lessons in order, or null. */
export async function readPublishedCourse(
  db: PublicClient,
  slug: string,
): Promise<PublishedCourse | null> {
  const { data, error } = await db
    .from("courses")
    .select(
      "slug, title, summary, outcomes, chapters(id, title, summary, position, lessons(slug, title, position))",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error !== null) throw new Error(`published course: ${error.code}`);
  if (data === null) return null;
  const course = courseDetail.parse(data);
  return {
    slug: course.slug,
    title: course.title,
    summary: course.summary,
    outcomes: course.outcomes,
    chapters: [...course.chapters].sort(byPosition).map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary,
      lessons: [...chapter.lessons].sort(byPosition).map(({ slug: lesson, title }) => ({
        slug: lesson,
        title,
      })),
    })),
  };
}

/** One published lesson of a published course, or null. */
export async function readPublishedLesson(
  db: PublicClient,
  courseSlug: string,
  lessonSlug: string,
): Promise<PublishedLesson | null> {
  const { data, error } = await db
    .from("lessons")
    .select(
      "id, slug, title, xp, instructions_md, hints, starter_code, tests, courses!inner(slug, title)",
    )
    .eq("slug", lessonSlug)
    .eq("courses.slug", courseSlug)
    .maybeSingle();
  if (error !== null) throw new Error(`published lesson: ${error.code}`);
  if (data === null) return null;
  const row = lessonRow.parse(data);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    xp: row.xp,
    instructionsMarkdown: row.instructions_md,
    hints: row.hints,
    starterCode: row.starter_code,
    tests: row.tests,
    course: { slug: row.courses.slug, title: row.courses.title },
  };
}

const cachedCourses = unstable_cache(
  () => readPublishedCourses(createPublicClient()),
  ["published-courses"],
  { tags: [CONTENT_TAG], revalidate: CONTENT_REVALIDATE_SECONDS },
);

const cachedCourse = unstable_cache(
  (slug: string) => readPublishedCourse(createPublicClient(), slug),
  ["published-course"],
  { tags: [CONTENT_TAG], revalidate: CONTENT_REVALIDATE_SECONDS },
);

const cachedLesson = unstable_cache(
  (courseSlug: string, lessonSlug: string) =>
    readPublishedLesson(createPublicClient(), courseSlug, lessonSlug),
  ["published-lesson"],
  { tags: [CONTENT_TAG], revalidate: CONTENT_REVALIDATE_SECONDS },
);

// A failed read throws inside the cache, so it is never kept; the page gets
// a failure it can show honestly, and the server logs it (02-architecture.md
// section 13: no silent catch).
async function settle<Value>(
  query: "published-courses" | "published-course" | "published-lesson",
  read: () => Promise<Value>,
): Promise<ContentResult<Value>> {
  try {
    return { ok: true, value: await read() };
  } catch {
    log({
      level: "error",
      requestId: "none",
      route: contentLogRoute(query),
      outcome: "content-read-failed",
    });
    return { ok: false };
  }
}

/** The longest course or lesson address (docs/spec/04-content-system.md section 1.1). */
const MAX_SLUG = 60;

const isSlug = (slug: string) => slug.length <= MAX_SLUG && SLUG_PATTERN.test(slug);

export function publishedCourses(): Promise<ContentResult<PublishedCourseSummary[]>> {
  return settle("published-courses", cachedCourses);
}

/**
 * One published course by its address. An address that no course can have
 * is answered at once, so a made-up one costs no query and no cache entry.
 */
export function publishedCourse(slug: string): Promise<ContentResult<PublishedCourse | null>> {
  if (!isSlug(slug)) {
    return Promise.resolve({ ok: true, value: null });
  }
  return settle("published-course", () => cachedCourse(slug));
}

/**
 * One published lesson by its course's address and its own. An address that
 * no lesson can have is answered at once, with no query and no cache entry.
 */
export function publishedLesson(
  courseSlug: string,
  lessonSlug: string,
): Promise<ContentResult<PublishedLesson | null>> {
  if (!isSlug(courseSlug) || !isSlug(lessonSlug)) {
    return Promise.resolve({ ok: true, value: null });
  }
  return settle("published-lesson", () => cachedLesson(courseSlug, lessonSlug));
}
