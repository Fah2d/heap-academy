// The learner's display name (FR-PRF-02). The column holds 1 to 40
// characters (supabase/migrations, profiles).

export const MAX_DISPLAY_NAME = 40;

// Control characters, line breaks, and the characters that reorder text.
const UNSAFE = /[\p{Cc}\p{Zl}\p{Zp}\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;
// Without one of these the name would show as nothing. The blank characters
// are letters or symbols that draw nothing, so they do not count.
const BLANK = /[\u115F\u1160\u2800\u3164\uFFA0]/gu;
const VISIBLE = /[\p{L}\p{N}\p{P}\p{S}]/u;

export type DisplayNameProblem = "empty" | "too_long" | "not_allowed";

export type DisplayNameResult =
  { ok: true; value: string } | { ok: false; problem: DisplayNameProblem };

/** The name as it is stored, or why it cannot be. Length is in code points, as the database counts. */
export function parseDisplayName(text: string): DisplayNameResult {
  const value = text.trim();
  if (value === "") return { ok: false, problem: "empty" };
  if (UNSAFE.test(value) || !VISIBLE.test(value.replace(BLANK, "")))
    return { ok: false, problem: "not_allowed" };
  if ([...value].length > MAX_DISPLAY_NAME) return { ok: false, problem: "too_long" };
  return { ok: true, value };
}
