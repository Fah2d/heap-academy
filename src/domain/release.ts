// The release a build was made from: the full commit SHA the deploy workflow
// builds, or "local" everywhere else. The server puts it on every log line
// and in the health answer; the browser sends its own with an error report,
// so a tab still running an older bundle after a deploy is logged under the
// bundle it runs (docs/spec/07-operations.md section 4.2). Not secret: the
// health answer already returns it and the repository is public.

export const RELEASE_LOCAL = "local";

export const RELEASE_PATTERN = /^(?:[0-9a-f]{40}|local)$/;

export function isRelease(value: unknown): value is string {
  return typeof value === "string" && RELEASE_PATTERN.test(value);
}
