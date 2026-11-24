import { z } from "zod";
import { parseLessonId, type LessonId } from "@/domain/ids";
import { applyAccount, unsynced, type Completion, type DeviceCompletion } from "@/domain/progress";

// The progress store on the device (FR-PRG-01, FR-PRG-06, NFR-REL-01;
// docs/spec/02-architecture.md section 10). A pass is written here first and
// shown at once; it stays marked unsynced until the server has stored it.
// The backend is a port: IndexedDB in the browser, memory when storage is
// unavailable.

/**
 * Where the list lives. `update` is one atomic read-modify-write, so two
 * tabs never overwrite each other's entries.
 */
export type DeviceBackend = {
  /** False for memory: progress will not survive closing the tab. */
  durable: boolean;
  read: () => Promise<unknown>;
  update: (change: (current: unknown) => DeviceCompletion[]) => Promise<void>;
};

const entry = z.object({
  lessonId: z.string().transform((value) => parseLessonId(value)),
  // The bounds of the server's input: one entry past them would fail every
  // sync. NUL is refused by the database's text type.
  completedAt: z.number().int().min(0).max(9_999_999_999_999),
  code: z
    .string()
    .max(20_000)
    .refine((value) => !value.includes("\u0000")),
  synced: z.boolean(),
});

/** The stored value as a list; an entry that is not a completion is left out. */
export function parseDeviceList(raw: unknown): DeviceCompletion[] {
  if (!Array.isArray(raw)) return [];
  const list: DeviceCompletion[] = [];
  for (const item of raw) {
    const parsed = entry.safeParse(item);
    if (parsed.success && parsed.data.lessonId !== undefined) {
      list.push({ ...parsed.data, lessonId: parsed.data.lessonId });
    }
  }
  return dedupe(list);
}

function dedupe(list: readonly DeviceCompletion[]): DeviceCompletion[] {
  const byLesson = new Map<LessonId, DeviceCompletion>();
  for (const item of list) {
    const known = byLesson.get(item.lessonId);
    // A synced entry is the server's copy: it wins over an unsynced one.
    if (known === undefined || (item.synced && !known.synced)) byLesson.set(item.lessonId, item);
  }
  return [...byLesson.values()].sort((a, b) => (a.lessonId < b.lessonId ? -1 : 1));
}

export type ProgressStore = {
  durable: boolean;
  list: () => Promise<DeviceCompletion[]>;
  /** Writes a pass to the device first. A lesson the device has stays as it is. */
  record: (completion: Completion) => Promise<void>;
  /** What the next sync sends. */
  pending: () => Promise<Completion[]>;
  /** The server stored this lesson. */
  markSynced: (lessonId: LessonId) => Promise<void>;
  /** The server answered a sync: apply the account's list, drop refused lessons. */
  settle: (account: readonly Completion[], rejected: readonly LessonId[]) => Promise<void>;
  /** The database refused this lesson, so it is no longer there to complete. */
  drop: (lessonIds: readonly LessonId[]) => Promise<void>;
};

export function createProgressStore(backend: DeviceBackend): ProgressStore {
  const change = (apply: (list: DeviceCompletion[]) => DeviceCompletion[]) =>
    backend.update((raw) => apply(parseDeviceList(raw)));
  return {
    durable: backend.durable,
    list: async () => parseDeviceList(await backend.read()),
    pending: async () => unsynced(parseDeviceList(await backend.read())),
    record: (completion) =>
      change((list) =>
        list.some((item) => item.lessonId === completion.lessonId)
          ? list
          : dedupe([...list, { ...completion, synced: false }]),
      ),
    markSynced: (lessonId) =>
      change((list) =>
        list.map((item) => (item.lessonId === lessonId ? { ...item, synced: true } : item)),
      ),
    settle: (account, rejected) =>
      change((list) =>
        applyAccount(
          list.filter((item) => !rejected.includes(item.lessonId)),
          account,
        ),
      ),
    drop: (lessonIds) =>
      change((list) => list.filter((item) => !lessonIds.includes(item.lessonId))),
  };
}

/** A backend that keeps the list in memory. */
export function memoryBackend(): DeviceBackend {
  let value: unknown = [];
  return {
    durable: false,
    read: async () => value,
    update: async (apply) => {
      value = apply(value);
    },
  };
}
