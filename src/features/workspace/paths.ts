// The workspace's addresses (docs/spec/03-experience.md section 3).

export function learnPath(course: string, lesson: string): string {
  return `/learn/${course}/${lesson}`;
}

/** The course page the workspace links back to (FR-WSP-11), built by WP-5.1. */
export function courseBackPath(course: string): string {
  return `/courses/${course}`;
}
