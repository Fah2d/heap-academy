import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { type ContentResult, publishedCourse, publishedLesson } from "@/content";
import { renderMarkdown } from "@/content/markdown";
import { parseLessonId } from "@/domain/ids";
import { lessonNeighbours } from "@/domain/workspace/neighbours";
import { parseTestCases } from "@/grader/test-case";
import { learnPath, LessonContent, Workspace, type WorkspaceLesson } from "@/features/workspace";
import { requestNonce } from "@/infrastructure/http/nonce";
import { notFound as notFoundWords } from "@/messages/system";
import { workspace as words } from "@/messages/workspace";

type Params = Promise<{ course: string; lesson: string }>;

type Loaded = { lesson: WorkspaceLesson; instructionsMarkdown: string } | null;

function valueOf<Value>(result: ContentResult<Value>, what: string): Value {
  if (!result.ok) throw new Error(`workspace: ${what} could not be read`);
  return result.value;
}

/**
 * One published lesson and its course's order, read with no session through
 * `src/content` (CLAUDE.md rule 9); `null` when either is not published. The
 * test cases are parsed with the grader's schema before anything uses them.
 *
 * A read that failed, stored test cases that do not parse, or a course whose
 * order does not hold the lesson throws, so the request ends on the shared
 * error page with status 500, as the catalog's pages do (WP-5.1, approved by
 * the owner on 2026-11-24). React's cache lasts one request, so the page and
 * its metadata share one read. The request is awaited first, so the build
 * never reads the database.
 */
export const loadLesson = cache(async (courseSlug: string, lessonSlug: string): Promise<Loaded> => {
  await connection();
  // The course is read only once the lesson is known to be published, so an
  // address no lesson can have makes no query at all (T-25).
  const lesson = valueOf(await publishedLesson(courseSlug, lessonSlug), "a published lesson");
  if (lesson === null) return null;
  const course = valueOf(await publishedCourse(courseSlug), "a published course");
  if (course === null) return null;
  const neighbours = lessonNeighbours(course.chapters, lesson.slug);
  if (neighbours === undefined) {
    throw new Error("workspace: the course's order does not hold the lesson");
  }
  const id = parseLessonId(lesson.id);
  if (id === undefined) throw new Error("workspace: a published lesson's ID is not a UUID");
  const tests = parseTestCases(lesson.tests);
  if (!tests.ok) throw new Error("workspace: a published lesson's test cases do not parse");
  return {
    instructionsMarkdown: lesson.instructionsMarkdown,
    lesson: {
      id,
      xp: lesson.xp,
      course: lesson.course,
      slug: lesson.slug,
      title: lesson.title,
      starterCode: lesson.starterCode,
      hints: lesson.hints,
      tests: tests.value,
      neighbours,
    },
  };
});

export async function lessonMetadata(params: Params): Promise<Metadata> {
  const { course, lesson } = await params;
  const loaded = await loadLesson(course, lesson);
  if (loaded === null) return { title: notFoundWords.title, robots: { index: false } };
  return {
    title: words.metaTitle(loaded.lesson.title, loaded.lesson.course.title),
    alternates: { canonical: learnPath(loaded.lesson.course.slug, loaded.lesson.slug) },
  };
}

/**
 * `/learn/[course]/[lesson]` (docs/spec/03-experience.md section 6): the
 * workspace. An address that names no published lesson gets the standard
 * not-found page. The page reads on the server, so it lives here with the
 * other public pages: the workspace feature's index is also imported by the
 * admin's client components and may export nothing that runs only on the
 * server.
 */
export async function LessonPage({ params }: { params: Params }) {
  const { course, lesson } = await params;
  const loaded = await loadLesson(course, lesson);
  if (loaded === null) notFound();
  return (
    <Workspace
      lesson={loaded.lesson}
      nonce={await requestNonce()}
      instructions={<LessonContent document={renderMarkdown(loaded.instructionsMarkdown)} />}
    />
  );
}
