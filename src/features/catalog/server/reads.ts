import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { publishedCourse, publishedCourses } from "@/content";

// The catalog's reads of published content. Each waits for the request first:
// the build tries to prerender every page, and the page starts rendering
// beside the root layout, so without it the build itself reads the database.
// React's cache lasts one request, so a page and its metadata share one read;
// the framework's data cache in `src/content` keeps the answer between
// requests.
export const catalogCourses = cache(async () => {
  await connection();
  return publishedCourses();
});

export const catalogCourse = cache(async (slug: string) => {
  await connection();
  return publishedCourse(slug);
});
