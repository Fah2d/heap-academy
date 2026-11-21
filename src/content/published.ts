import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { createPublicClient, type PublicClient } from "@/infrastructure/db/public-client";

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
// a failure it can show honestly.
async function settle<Value>(read: () => Promise<Value>): Promise<ContentResult<Value>> {
  try {
    return { ok: true, value: await read() };
  } catch {
    return { ok: false };
  }
}

export function publishedCourses(): Promise<ContentResult<PublishedCourseSummary[]>> {
  return settle(cachedCourses);
}

export function publishedCourse(slug: string): Promise<ContentResult<PublishedCourse | null>> {
  return settle(() => cachedCourse(slug));
}
