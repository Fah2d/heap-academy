// The IDs the pure rules work with. A lesson's ID is a UUID that never
// changes (docs/spec/04-content-system.md section 1.3), so a completion stays
// attached to its lesson through renames and moves (FR-PRG-07).

declare const lessonIdBrand: unique symbol;

export type LessonId = string & { readonly [lessonIdBrand]: true };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A lesson ID in its canonical form: a lower-case UUID. Anything else is not one. */
export function parseLessonId(value: unknown): LessonId | undefined {
  return typeof value === "string" && UUID.test(value) ? (value as LessonId) : undefined;
}
