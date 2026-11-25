import "server-only";
import { z } from "zod";
import type { SessionClient } from "@/infrastructure/db/session-client";

// The dashboard's course list (docs/spec/03-experience.md section 7.2). It
// reads through the admin's own session, so row level security decides: an
// admin at aal2 sees every course and lesson, anyone else only what is
// published (docs/spec/02-architecture.md section 8.2).

const status = z.enum(["draft", "published", "archived"]);

const courseRow = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  status,
  lessons: z.array(z.object({ status })),
});

export type CourseStatus = z.infer<typeof status>;

export type AdminCourse = {
  id: string;
  slug: string;
  title: string;
  status: CourseStatus;
  publishedLessons: number;
  draftLessons: number;
};

export type AdminCourses = { ok: true; courses: AdminCourse[] } | { ok: false };

export function summarizeCourses(rows: unknown): AdminCourses {
  const parsed = z.array(courseRow).safeParse(rows);
  if (!parsed.success) return { ok: false };
  return {
    ok: true,
    courses: parsed.data.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      publishedLessons: row.lessons.filter((lesson) => lesson.status === "published").length,
      draftLessons: row.lessons.filter((lesson) => lesson.status === "draft").length,
    })),
  };
}

/** Every course in the admin's order, with its lesson counts. */
export async function listCoursesForAdmin(db: SessionClient): Promise<AdminCourses> {
  const { data, error } = await db
    .from("courses")
    .select("id, slug, title, status, lessons(status)")
    .order("position")
    .order("title");
  if (error !== null) return { ok: false };
  return summarizeCourses(data);
}
