import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  identity: null as unknown,
  ids: [] as string[] | null,
  access: [] as string[],
  asked: [] as string[],
}));
vi.mock("./viewer", () => ({ viewer: () => Promise.resolve(state.identity) }));
vi.mock("@/infrastructure/db/session-client", () => ({
  createSessionClient: (access: string) => {
    state.access.push(access);
    return Promise.resolve({});
  },
}));
vi.mock("@/infrastructure/db/completion-store", () => ({
  supabaseCompletionStore: () => ({
    lessonIds: (userId: string) => {
      state.asked.push(userId);
      return Promise.resolve(state.ids);
    },
  }),
}));

const { accountLessons } = await import("./account-lessons");

const userId = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  state.identity = { userId };
  state.ids = ["00000000-0000-4000-8000-00000000000a"];
  state.access = [];
  state.asked = [];
});

describe("[FR-PRG-02] [T-08] accountLessons", () => {
  it("reads nothing for a guest", async () => {
    state.identity = null;
    expect(await accountLessons()).toBeUndefined();
    expect(state.access).toEqual([]);
  });

  it("reads the verified caller's lessons with a session client that sets no cookie", async () => {
    expect(await accountLessons()).toEqual(state.ids);
    expect(state.asked).toEqual([userId]);
    expect(state.access).toEqual(["read-only"]);
  });

  it("is undefined when the database cannot say", async () => {
    state.ids = null;
    expect(await accountLessons()).toBeUndefined();
  });
});
