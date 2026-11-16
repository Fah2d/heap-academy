// The not-found and error pages (FR-SYS-01, docs/spec/03-experience.md
// section 5.6). Each says what happened and offers the next step.
export const notFound = {
  title: "Page not found",
  heading: "We could not find this page",
  body: "Nothing is at this address. The link may be old, or the address may have a typing mistake.",
  homeLink: "Go to the home page",
} as const;

export const errorPage = {
  title: "This page could not open",
  heading: "This page could not open",
  body: "Something failed on our side while we prepared this page. Try again.",
  retry: "Try again",
  homeLink: "Go to the home page",
  referenceHint: "If it keeps happening, keep this reference.",
  referenceLabel: "Reference",
} as const;
