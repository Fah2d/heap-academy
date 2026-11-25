// The rules of course structure that do not need the database
// (docs/spec/04-content-system.md section 4.3, docs/spec/03-experience.md
// section 7.3; FR-ADM-03, FR-ADM-09). The database enforces the publish rule
// again; these keep the dashboard from offering a move it would refuse.

export type ContentStatus = "draft" | "published" | "archived";

/** Section 4.3: the moves between statuses. Archived comes back only as a draft. */
const MOVES: Readonly<Record<ContentStatus, readonly ContentStatus[]>> = {
  draft: ["published", "archived"],
  published: ["draft", "archived"],
  archived: ["draft"],
};

export function statusMoves(from: ContentStatus): readonly ContentStatus[] {
  return MOVES[from];
}

export function canMoveStatus(from: ContentStatus, to: ContentStatus): boolean {
  return MOVES[from].includes(to);
}

export type Direction = "up" | "down";

/**
 * The order after moving one item a place up or down, or undefined when it
 * cannot move: it is first and goes up, last and goes down, or not there.
 */
export function moveInOrder<Id>(
  order: readonly Id[],
  id: Id,
  direction: Direction,
): Id[] | undefined {
  const index = order.indexOf(id);
  if (index === -1) return undefined;
  const other = direction === "up" ? index - 1 : index + 1;
  if (other < 0 || other >= order.length) return undefined;
  const next = [...order];
  next[index] = order[other] as Id;
  next[other] = id;
  return next;
}
