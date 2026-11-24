import type { LessonId } from "@/domain/ids";
import { type Completion, MAX_SYNC_COMPLETIONS, sendable } from "@/domain/progress";
import type { ProgressStore } from "./progress-store";

// Sync of the device's completions with the account (FR-PRG-02, FR-PRG-03,
// FR-PRG-06, NFR-REL-01; docs/spec/02-architecture.md section 10). It runs
// on start (sign-in or page load) and when the tab becomes visible, and a
// failed attempt is tried again with a growing wait until it is stored. The
// server calls are ports: the page passes the two server actions in.

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type SyncPorts = {
  mergeProgress: (input: {
    completions: Completion[];
  }) => Promise<Result<{ completions: Completion[]; rejected: LessonId[] }>>;
  recordCompletion: (input: Completion) => Promise<Result<null>>;
  /** True while the tab is shown. */
  isVisible: () => boolean;
  /** Calls `listener` when the tab becomes visible; returns the way to stop. */
  onVisible: (listener: () => void) => () => void;
  setTimer: (callback: () => void, milliseconds: number) => unknown;
  clearTimer: (timer: unknown) => void;
};

export type SyncState = "idle" | "syncing" | "waiting";

export type ProgressSync = {
  /** A pass the device already has: stored on the server now, or by a later sync. */
  send: (completion: Completion) => Promise<void>;
  /** Sends every unsynced completion now. Resolves true once all are stored. */
  sync: () => Promise<boolean>;
  state: () => SyncState;
  stop: () => void;
};

export const RETRY_FIRST_MS = 2_000;
export const RETRY_LAST_MS = 60_000;

/**
 * Next refuses a server action body over 1 MB, so a batch is limited by size
 * as well as by count. One completion always fits.
 */
export const MAX_BATCH_BYTES = 900_000;

function firstBatch(pending: readonly Completion[]): Completion[] {
  const encoder = new TextEncoder();
  let bytes = 0;
  const batch: Completion[] = [];
  for (const completion of pending.slice(0, MAX_SYNC_COMPLETIONS)) {
    bytes += encoder.encode(JSON.stringify(completion)).length + 1;
    if (batch.length > 0 && bytes > MAX_BATCH_BYTES) break;
    batch.push(completion);
  }
  return batch;
}

export function startProgressSync(
  store: ProgressStore,
  ports: SyncPorts,
  onChange: (state: SyncState) => void = () => {},
): ProgressSync {
  let running: Promise<boolean> | undefined;
  let again = false;
  let timer: unknown;
  let wait = RETRY_FIRST_MS;
  let stopped = false;
  let state: SyncState = "idle";
  // A sync and a pass never overlap: a stale account list must not be applied
  // over a pass that was marked synced while the list was being read.
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(job: () => Promise<T>): Promise<T> => {
    const next = queue.then(job, job);
    queue = next.catch(() => undefined);
    return next;
  };

  const set = (next: SyncState) => {
    state = next;
    onChange(state);
  };

  const retryLater = () => {
    if (stopped) return;
    if (timer !== undefined) ports.clearTimer(timer);
    set("waiting");
    timer = ports.setTimer(() => {
      timer = undefined;
      void sync();
    }, wait);
    wait = Math.min(wait * 2, RETRY_LAST_MS);
  };

  const attempt = async (): Promise<boolean> => {
    const since = await store.epoch();
    const pending = await store.pending();
    const batch = firstBatch(pending);
    let result: Awaited<ReturnType<SyncPorts["mergeProgress"]>>;
    try {
      result = await ports.mergeProgress({ completions: batch });
    } catch {
      return false;
    }
    if (!result.ok) return false;
    await store.applySync(result.value.completions, result.value.rejected, since);
    if (pending.length > batch.length) again = true;
    return true;
  };

  const sync = (): Promise<boolean> => {
    if (stopped) return Promise.resolve(false);
    if (running !== undefined) {
      // A pass recorded while a sync is in flight is sent by the next one.
      again = true;
      return running;
    }
    if (timer !== undefined) {
      ports.clearTimer(timer);
      timer = undefined;
    }
    set("syncing");
    running = (async () => {
      let stored = false;
      try {
        do {
          again = false;
          stored = await exclusive(attempt);
        } while (again && stored);
      } catch {
        stored = false;
      }
      running = undefined;
      if (stored) {
        wait = RETRY_FIRST_MS;
        set("idle");
      } else retryLater();
      return stored;
    })();
    return running;
  };

  const stopListening = ports.onVisible(() => {
    if (ports.isVisible()) void sync();
  });
  void sync();

  return {
    send: async (completion) => {
      // Read now, not when its turn comes: a pass made before a sign-out is
      // not sent after it.
      const since = await store.epoch();
      await exclusive(async () => {
        if ((await store.epoch()) !== since) return;
        let outcome: Awaited<ReturnType<SyncPorts["recordCompletion"]>>;
        try {
          outcome = await ports.recordCompletion(sendable(completion));
        } catch {
          retryLater();
          return;
        }
        if (outcome.ok) {
          await store.markSynced(completion.lessonId, since);
          onChange(state);
        } else if (outcome.error === "lesson_unavailable") {
          await store.drop([completion.lessonId], since);
          onChange(state);
        } else retryLater();
      });
    },
    sync,
    state: () => state,
    stop() {
      stopped = true;
      stopListening();
      if (timer !== undefined) ports.clearTimer(timer);
      timer = undefined;
    },
  };
}
