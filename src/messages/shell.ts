// The words of the page frame that every screen shares
// (docs/spec/03-experience.md section 4).
export const shell = {
  productName: "Heap Academy",
  /** The page title: the page's own title, then the product name. */
  titleTemplate: "%s | Heap Academy",
  skipLink: "Skip to the main content",
  description:
    "Short Python lessons that you read, write, and run in your browser, with the test cases in plain view.",
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
