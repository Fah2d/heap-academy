"use client";

import { structure as words } from "@/messages/admin";
import { Button } from "@/ui";
import type { ActionOutcome, MoveDirection } from "../types";

// Pieces shared by the course list and the course editor
// (docs/spec/03-experience.md section 7.3): the sentence for a refused
// change, and Move up and Move down, which work with a keyboard. There is no
// drag and drop in this release.

/** The sentence for an action's failure code; anything unknown is "try again". */
export function structureFailureText(error: string): string {
  return Object.hasOwn(words.failure, error)
    ? words.failure[error as keyof typeof words.failure]
    : words.failure.unavailable;
}

/** Calls an action, turning a thrown error (the network, a server crash) into a failure. */
export async function settle<Value>(
  call: () => Promise<ActionOutcome<Value>>,
): Promise<ActionOutcome<Value>> {
  try {
    return await call();
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export type MoveButtonsProps = {
  /** The item's name, read with the button: "Move up: Variables". */
  name: string;
  /** The item's ID: after a move, focus goes back to the same button. */
  itemId: string;
  isFirst: boolean;
  isLast: boolean;
  /** A change is being saved: the buttons keep focus and ignore presses. */
  isPending: boolean;
  onMove: (direction: MoveDirection) => void;
};

export function MoveButtons({
  name,
  itemId,
  isFirst,
  isLast,
  isPending,
  onMove,
}: MoveButtonsProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        aria-label={words.moveUp(name)}
        data-move={`${itemId}:up`}
        isDisabled={isFirst}
        isPending={isPending}
        onPress={() => onMove("up")}
      >
        {words.moveUpShort}
      </Button>
      <Button
        variant="secondary"
        aria-label={words.moveDown(name)}
        data-move={`${itemId}:down`}
        isDisabled={isLast}
        isPending={isPending}
        onPress={() => onMove("down")}
      >
        {words.moveDownShort}
      </Button>
    </div>
  );
}

/**
 * After a move the list renders again in its new order. Focus goes back to
 * the button that was pressed, or to the other one when the item reached an
 * end and that button is now disabled.
 */
export function focusMoved(root: HTMLElement | null, itemId: string, direction: MoveDirection) {
  if (root === null) return;
  const other: MoveDirection = direction === "up" ? "down" : "up";
  for (const which of [direction, other]) {
    const button = root.querySelector<HTMLButtonElement>(`[data-move="${itemId}:${which}"]`);
    if (button !== null && !button.disabled) {
      button.focus();
      return;
    }
  }
}
