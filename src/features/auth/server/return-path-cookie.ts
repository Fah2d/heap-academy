import "server-only";

// The cookie that keeps the return path while the browser is at Google
// (FR-AUTH-04). It holds a path already made safe, and the callback makes it
// safe again before it follows it.
export const RETURN_PATH_COOKIE = "heap-return-to";
/** Ten minutes, in seconds: long enough to choose an account at Google. */
export const RETURN_PATH_COOKIE_MAX_AGE = 600;
