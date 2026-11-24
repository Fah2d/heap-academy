import { applyAccount, type Completion, unsynced } from "@/domain/progress";
import type { LessonId } from "@/domain/ids";
import type { DeviceStore } from "./store";

// Sync of the device with the account (FR-PRG-02, FR-PRG-03, FR-PRG-06;
// architecture section 10). The device sends every completion the server has
// not stored; the server answers with the account's full list; the device
// keeps that list through `applyAccount`. A failure leaves every unsynced
// entry on the device, so the next trigger sends it again.

export type MergeCall = (input: {
  completions: Completion[];
}) => Promise<
  | { ok: true; value: { completions: Completion[]; rejected: LessonId[] } }
  | { ok: false; error: string }
>;

export type SyncOutcome =
  { status: "synced"; rejected: LessonId[] } | { status: "failed" } | { status: "signed_out" };

/** Whether the server's answer says the caller is not signed in. */
const SIGNED_OUT = "not_signed_in";

export async function syncOnce(store: DeviceStore, merge: MergeCall): Promise<SyncOutcome> {
  const device = await store.list();
  let answer: Awaited<ReturnType<MergeCall>>;
  try {
    answer = await merge({ completions: unsynced(device) });
  } catch {
    return { status: "failed" };
  }
  if (!answer.ok) {
    return answer.error === SIGNED_OUT ? { status: "signed_out" } : { status: "failed" };
  }
  const { completions, rejected } = answer.value;
  // A completion stored while the call was in flight must not be lost, so the
  // entries are read again before the list is replaced.
  const now = await store.list();
  const refused = new Set(rejected);
  const next = applyAccount(
    now.filter((entry) => !refused.has(entry.lessonId)),
    completions,
  );
  await store.replaceAll(next);
  return { status: "synced", rejected };
}

/** Runs `syncOnce` one at a time: a call during a run waits for that run. */
export function createSyncer(store: DeviceStore, merge: MergeCall) {
  let running: Promise<SyncOutcome> | null = null;
  return {
    run(): Promise<SyncOutcome> {
      running ??= syncOnce(store, merge).finally(() => {
        running = null;
      });
      return running;
    },
  };
}
