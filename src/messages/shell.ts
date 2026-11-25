// The words of the page frame that every screen shares
// (docs/spec/03-experience.md section 4).
export const shell = {
  productName: "Heap Academy",
  /** The page title: the page's own title, then the product name. */
  titleTemplate: "%s | Heap Academy",
  skipLink: "Skip to the main content",
  mainNavigation: "Main",
  accountNavigation: "Account",
  /** The footer's links, on every page (FR-SYS-03). */
  footer: {
    privacy: "Privacy",
    terms: "Terms",
  },
  /** The default description, and the home page's (`home.description`). */
  description:
    "Short Python lessons that you read, write, and run in your browser, with every test case shown.",
} as const;

/**
 * A page title from the template, for the error pages, which set their own
 * `<title>` because the metadata API does not reach them.
 */
export function pageTitle(title: string): string {
  // A function, so a "$" in the title is kept as written, not read as a
  // replacement pattern.
  return shell.titleTemplate.replace("%s", () => title);
}
