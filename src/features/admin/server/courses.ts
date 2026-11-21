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

const lessonRow = z.object({ id: z.uuid(), title: z.string(), status, position: z.number().int() });
const editorRow = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  outcomes: z.array(z.string()),
  status,
  updated_at: z.string(),
  chapters: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      summary: z.string(),
      position: z.number().int(),
      lessons: z.array(lessonRow),
    }),
  ),
});

export type EditorLesson = { id: string; title: string; status: CourseStatus };
export type EditorChapter = { id: string; title: string; summary: string; lessons: EditorLesson[] };
export type EditorCourse = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  outcomes: string[];
  status: CourseStatus;
  /** The row's version: a save names it, and is refused if the row is newer (FR-ADM-10). */
  loadedAt: string;
  chapters: EditorChapter[];
};

export type EditorCourseResult = { ok: true; course: EditorCourse | null } | { ok: false };

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

export function editorCourse(row: unknown): EditorCourseResult {
  if (row === null) return { ok: true, course: null };
  const parsed = editorRow.safeParse(row);
  if (!parsed.success) return { ok: false };
  const course = parsed.data;
  return {
    ok: true,
    course: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      outcomes: course.outcomes,
      status: course.status,
      loadedAt: course.updated_at,
      chapters: [...course.chapters].sort(byPosition).map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        summary: chapter.summary,
        lessons: [...chapter.lessons]
          .sort(byPosition)
          .map((lesson) => ({ id: lesson.id, title: lesson.title, status: lesson.status })),
      })),
    },
  };
}

/** One course with its chapters and lessons in order, as the editor shows it. */
export async function courseForEditor(db: SessionClient, id: string): Promise<EditorCourseResult> {
  const { data, error } = await db
    .from("courses")
    .select(
      "id, slug, title, summary, outcomes, status, updated_at, chapters(id, title, summary, position, lessons(id, title, status, position))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error !== null) return { ok: false };
  return editorCourse(data);
}
