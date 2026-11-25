// The addresses of the public catalog pages (docs/spec/03-experience.md
// section 3), written once for links, canonical addresses and the sitemap.

export const HOME_PATH = "/";
export const COURSES_PATH = "/courses";

export function coursePath(slug: string): string {
  return `${COURSES_PATH}/${slug}`;
}
