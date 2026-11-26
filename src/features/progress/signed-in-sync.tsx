import { ProgressSync } from "./client/progress-sync";

/**
 * The progress sync for a signed-in learner; render it only for one. The
 * actions are imported when it renders, not with this module: the feature's
 * index is also loaded by client code, which must not load a server module.
 */
export async function SignedInProgressSync() {
  const { mergeProgress, recordCompletion } = await import("./server/actions");
  return <ProgressSync mergeProgress={mergeProgress} recordCompletion={recordCompletion} />;
}
