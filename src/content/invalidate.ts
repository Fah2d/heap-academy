import "server-only";
import { updateTag } from "next/cache";
import { CONTENT_TAG } from "./published";

/**
 * Expires every cached published-content answer, so the next page view reads
 * the database (FR-ADM-11). Server actions only: `updateTag` lets the admin
 * who made the change read it at once.
 */
export function contentChanged(): void {
  updateTag(CONTENT_TAG);
}
