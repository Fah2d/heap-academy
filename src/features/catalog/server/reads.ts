import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { type ContentResult, publishedCourse, publishedCourses } from "@/content";

// The catalog's reads of published content. Each waits for the request first:
// the build tries to prerender every page, and the page starts rendering
// beside the root layout, so without it the build itself reads the database.
// React's cache lasts one request, so a page and its metadata share one read;
// the framework's data cache in `src/content` keeps the answer between
// requests.
//
// A read that failed throws, so the request ends on the error page with
// status 500 before any of the page is sent. A crawler then comes back later,
// as it does for the sitemap, instead of keeping a page that says nothing was
// found or dropping it for a `noindex` (FR-SEO-01). `src/content` has already
// logged the failure.

function valueOf<Value>(result: ContentResult<Value>, what: string): Value {
  if (!result.ok) throw new Error(`catalog: ${what} could not be read`);
  return result.value;
}

export const catalogCourses = cache(async () => {
  await connection();
  return valueOf(await publishedCourses(), "the published courses");
});

export const catalogCourse = cache(async (slug: string) => {
  await connection();
  return valueOf(await publishedCourse(slug), "a published course");
});
