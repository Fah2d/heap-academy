import "server-only";
import type { MetadataRoute } from "next";
import { publishedCourses } from "@/content";
import { SITE_ORIGIN } from "../site";
import { COURSES_PATH, coursePath, HOME_PATH } from "../paths";

/**
 * Every public page at its production address (FR-SEO-01), from the cached
 * published content. When the courses cannot be read it throws, so the
 * crawler gets an error and comes back, rather than a sitemap that has lost
 * every course. The read failure is already logged in `src/content`.
 */
export async function catalogSitemap(): Promise<MetadataRoute.Sitemap> {
  const courses = await publishedCourses();
  if (!courses.ok) throw new Error("sitemap: the published courses could not be read");
  const paths = [
    HOME_PATH,
    COURSES_PATH,
    ...courses.value.map((course) => coursePath(course.slug)),
    "/privacy",
    "/terms",
  ];
  return paths.map((path) => ({ url: new URL(path, SITE_ORIGIN).href }));
}
