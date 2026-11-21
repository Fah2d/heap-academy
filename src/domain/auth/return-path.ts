// Where sign-in sends the learner afterwards (FR-AUTH-04, T-11,
// docs/spec/02-architecture.md section 11.1). Only a path on this site is
// accepted; anything else falls back to the course list.

export const DEFAULT_RETURN_PATH = "/courses";

const MAX_LENGTH = 512;
// A base the path is resolved against, to resolve dot segments the way a
// browser does.
const BASE = "https://return-path.invalid";
// Browsers drop tabs and newlines from a URL and treat a backslash as a slash,
// so "/\t/evil.example" and "/\\evil.example" both mean "//evil.example".
const UNSAFE_CHARACTER = /[\u0000- \u007f\\]/;
// Returning into sign-in would only show the form again.
const SIGN_IN_PATHS = [/^\/sign-in(?:[/?#]|$)/, /^\/auth(?:[/?#]|$)/];

/** The path to send the learner to after sign-in. */
export function safeReturnPath(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return DEFAULT_RETURN_PATH;
  if (raw.length === 0 || raw.length > MAX_LENGTH) return DEFAULT_RETURN_PATH;
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_RETURN_PATH;
  if (UNSAFE_CHARACTER.test(raw)) return DEFAULT_RETURN_PATH;

  // Resolving dot segments can make a new leading "//": "/.//evil.example"
  // becomes "//evil.example", which a browser reads as another site. So the
  // resolved path is checked again, not only the raw one.
  const url = new URL(raw, BASE);
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (path.startsWith("//")) return DEFAULT_RETURN_PATH;
  if (SIGN_IN_PATHS.some((pattern) => pattern.test(path))) return DEFAULT_RETURN_PATH;
  return path;
}
