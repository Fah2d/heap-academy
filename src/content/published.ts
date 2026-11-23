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
    .select("slug, title, summary, lessons(slug)")
    .order("position")
    .order("title");
  if (error !== null) throw new Error(`published courses: ${error.code}`);
  return z
    .array(courseRow)
    .parse(data)
    .filter((row) => row.lessons.length > 0)
    .map((row) => ({
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      lessonCount: row.lessons.length,
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
      "slug, title, summary, outcomes, chapters(id, title, summary, position, lessons(slug, title, position))",
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
      lessons: [...chapter.lessons].sort(byPosition).map(({ slug: lesson, title }) => ({
        slug: lesson,
        title,
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

// A failed read throws inside the cache, so it is never kept; the page gets
// a failure it can show honestly, and the server logs it (02-architecture.md
// section 13: no silent catch).
async function settle<Value>(
  query: "published-courses" | "published-course",
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

/** The longest course address (docs/spec/04-content-system.md section 1.1). */
const MAX_SLUG = 60;

export function publishedCourses(): Promise<ContentResult<PublishedCourseSummary[]>> {
  return settle("published-courses", cachedCourses);
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
  if (slug.length > MAX_SLUG || !SLUG_PATTERN.test(slug)) return { ok: true, value: null };
  const listed = await publishedCourses();
  if (!listed.ok) return listed;
  if (!listed.value.some((course) => course.slug === slug)) return { ok: true, value: null };
  return settle("published-course", () => cachedCourse(slug));
}
