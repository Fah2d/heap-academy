import { describe, expect, it } from "vitest";
import { canMoveStatus, type ContentStatus, moveInOrder, statusMoves } from "./structure";

describe("statusMoves [FR-ADM-03, FR-ADM-09]", () => {
  it("follows the states of the content system, section 4.3", () => {
    const all: ContentStatus[] = ["draft", "published", "archived"];
    const allowed = all.flatMap((from) =>
      all.filter((to) => canMoveStatus(from, to)).map((to) => `${from}>${to}`),
    );
    expect(allowed).toEqual([
      "draft>published",
      "draft>archived",
      "published>draft",
      "published>archived",
      "archived>draft",
    ]);
    expect(statusMoves("archived")).toEqual(["draft"]);
  });
});

describe("moveInOrder [FR-ADM-03]", () => {
  const order = ["a", "b", "c"];

  it("swaps with the neighbour", () => {
    expect(moveInOrder(order, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveInOrder(order, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("refuses to move past either end, or an item that is not there", () => {
    expect(moveInOrder(order, "a", "up")).toBeUndefined();
    expect(moveInOrder(order, "c", "down")).toBeUndefined();
    expect(moveInOrder(order, "x", "up")).toBeUndefined();
  });

  it("leaves the given order untouched", () => {
    moveInOrder(order, "b", "up");
    expect(order).toEqual(["a", "b", "c"]);
  });
});
