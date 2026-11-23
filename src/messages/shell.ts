// The words of the page frame that every screen shares
// (docs/spec/03-experience.md section 4).
export const shell = {
  productName: "Heap Academy",
  /** The page title: the page's own title, then the product name. */
  titleTemplate: "%s | Heap Academy",
  skipLink: "Skip to the main content",
  mainNavigation: "Main",
  accountNavigation: "Account",
  /** The default description, and the home page's (`home.description`). */
  description:
    "Short Python lessons that you read, write, and run in your browser, with every test case shown.",
} as const;
