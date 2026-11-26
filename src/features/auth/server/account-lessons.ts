import "server-only";
import type { LessonId } from "@/domain/ids";
import { supabaseCompletionStore } from "@/infrastructure/db/completion-store";
import { createSessionClient } from "@/infrastructure/db/session-client";
import { viewer } from "./viewer";

/**
 * The lessons the signed-in learner's account has completed, so a page is
 * rendered with them (02-architecture.md section 10; FR-PRG-02). Read with
 * the caller's own session. Undefined for a guest, and when the database
 * cannot say: the page then fills progress in from the device.
 */
export async function accountLessons(): Promise<LessonId[] | undefined> {
  const identity = await viewer();
  if (identity === null) return undefined;
  const store = supabaseCompletionStore(await createSessionClient("read-only"));
  return (await store.lessonIds(identity.userId)) ?? undefined;
}
