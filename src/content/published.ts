import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { SLUG_PATTERN } from "@/domain/admin/course-details";
import {
  createPublicClient,
  publicDatabaseAddress,
  type PublicClient,
} from "@/infrastructure/db/public-client";
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
  chapters: z.array(
    z.object({
      position: z.number().int(),
      lessons: z.array(z.object({ id: z.uuid(), slug: z.string(), position: z.number().int() })),
    }),
  ),
});

export type PublishedCourseSummary = {
  slug: string;
  title: string;
  summary: string;
  lessonCount: number;
  /** Every published lesson in course order, for the learner's progress (FR-CAT-02). */
  lessons: { id: string; slug: string }[];
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
        z.object({
          id: z.uuid(),
          slug: z.string(),
          title: z.string(),
          xp: z.number().int(),
          position: z.number().int(),
        }),
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
    lessons: { id: string; slug: string; title: string; xp: number }[];
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

/**
 * Every published course in the owner's order, with its published lesson
 * count. A course with no published lesson is left out (FR-CAT-04): the
 * publish guard refuses to publish one, but its lessons can be unpublished
 * after it.
 */
export async function readPublishedCourses(db: PublicClient): Promise<PublishedCourseSummary[]> {
  const { data, error } = await db
    .from("courses")
    .select("slug, title, summary, chapters(position, lessons(id, slug, position))")
    .order("position")
    .order("title");
  if (error !== null) throw new Error(`published courses: ${error.code}`);
  return z
    .array(courseRow)
    .parse(data)
    .map((row) => ({
      row,
      lessons: [...row.chapters]
        .sort(byPosition)
        .flatMap((chapter) => [...chapter.lessons].sort(byPosition))
        .map(({ id, slug }) => ({ id, slug })),
    }))
    .filter(({ lessons }) => lessons.length > 0)
    .map(({ row, lessons }) => ({
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      lessonCount: lessons.length,
      lessons,
    }));
}

/**
 * One published course with its chapters and published lessons in order, or
 * null. A chapter with no published lesson is left out, and a course with
 * none at all is null, as it is in the course list (FR-CAT-04).
 */
export async function readPublishedCourse(
  db: PublicClient,
  slug: string,
): Promise<PublishedCourse | null> {
  const { data, error } = await db
    .from("courses")
    .select(
      "slug, title, summary, outcomes, chapters(id, title, summary, position, lessons(id, slug, title, xp, position))",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error !== null) throw new Error(`published course: ${error.code}`);
  if (data === null) return null;
  const course = courseDetail.parse(data);
  const chapters = [...course.chapters]
    .sort(byPosition)
    .filter((chapter) => chapter.lessons.length > 0)
    .map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary,
      lessons: [...chapter.lessons].sort(byPosition).map(({ id, slug: lesson, title, xp }) => ({
        id,
        slug: lesson,
        title,
        xp,
      })),
    }));
  if (chapters.length === 0) return null;
  return {
    slug: course.slug,
    title: course.title,
    summary: course.summary,
    outcomes: course.outcomes,
    chapters,
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

// Every cached reader is made here. The database's address is read once per
// call, put first in the cache arguments, so it is part of every cache key,
// and the same value builds the client. The cache is kept on disk
// (.next/cache) and shared by every server of one build, and an answer read
// from one database must never answer for another. Every reader shares the
// one callback below, whose source is part of the framework's key, so its key
// part alone keeps it apart from the others and may be used only once.
const readerKeyParts = new Set<string>();

export function cachedReader<Args extends unknown[], Value>(
  keyPart: string,
  read: (db: PublicClient, ...args: Args) => Promise<Value>,
): (...args: Args) => Promise<Value> {
  if (readerKeyParts.has(keyPart)) throw new Error(`content cache: key part ${keyPart} is taken`);
  readerKeyParts.add(keyPart);
  const cached = unstable_cache(
    (database: string, ...args: Args) => read(createPublicClient(database), ...args),
    [keyPart],
    { tags: [CONTENT_TAG], revalidate: CONTENT_REVALIDATE_SECONDS },
  );
  return (...args: Args) => cached(publicDatabaseAddress(), ...args);
}

// A key part names the shape of its answer as well as the query: when an
// answer's shape changes, its key part takes the next number, so an answer
// cached by an earlier build is never read as the new shape. Version 2: lesson
// IDs on a course summary, and each lesson's ID and XP on a course (WP-5.4).
const cachedCourses = cachedReader("published-courses-2", readPublishedCourses);

const cachedCourse = cachedReader("published-course-2", readPublishedCourse);

const cachedLesson = cachedReader("published-lesson", readPublishedLesson);

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
  return settle("published-courses", () => cachedCourses());
}

/**
 * One published course by its address. An address that no course can have
 * is answered at once, and a well-formed one that is not in the cached course
 * list is answered from that list, so a made-up address costs no course
 * query and no cache entry (T-14, T-25).
 */
export async function publishedCourse(
  slug: string,
): Promise<ContentResult<PublishedCourse | null>> {
  if (!isSlug(slug)) return { ok: true, value: null };
  const listed = await publishedCourses();
  if (!listed.ok) return listed;
  if (!listed.value.some((course) => course.slug === slug)) return { ok: true, value: null };
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
