// The addresses of the public catalog pages (docs/spec/03-experience.md
// section 3), written once for links, canonical addresses and the sitemap.

export const HOME_PATH = "/";
export const COURSES_PATH = "/courses";

export function coursePath(slug: string): string {
  return `${COURSES_PATH}/${slug}`;
}

/** A lesson's workspace; the workspace's own `learnPath` is its twin (a test keeps them equal). */
export function lessonPath(course: string, lesson: string): string {
  return `/learn/${course}/${lesson}`;
}
