import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Identity, UserId } from "@/domain/auth/identity";
import type { RequestId } from "@/infrastructure/http/request-id";
import type { LogEntry } from "@/infrastructure/logging/logger";
import { createActionFactory, type ActionContext } from "./define-action";

vi.mock("server-only", () => ({}));

const LEARNER: Identity = { userId: "0b6d1c2e-3f40-4a5b-8c6d-7e8f9a0b1c2d" as UserId, aal: "aal1" };
const ADMIN: Identity = { ...LEARNER, aal: "aal2" };
const REQUEST_ID = "3f2c1b0a-9e8d-4c7b-a6f5-e4d3c2b1a090" as RequestId;
type Services = { database: string };
const SERVICES: Services = { database: "this request's session client" };

function setup(context: Partial<ActionContext<Services>> = {}) {
  const lines: LogEntry[] = [];
  let clock = 1000;
  const isAdmin = vi.fn(async () => false);
  const identify = vi.fn(async (): Promise<Identity | null> => null);
  const defineAction = createActionFactory<Services>({
    context: async () => ({
      requestId: REQUEST_ID,
      identify,
      isAdmin,
      services: SERVICES,
      ...context,
    }),
    log: (entry) => lines.push(entry),
    now: () => (clock += 5),
  });
  return { defineAction, lines, isAdmin, identify };
}

const input = z.strictObject({ name: z.string().max(10) });
const ok = async () => ({ ok: true as const, value: "ok" });

describe("defineAction", () => {
  it("[NFR-SEC-03] passes the parsed input, the caller, this request's services and ID, and logs one line", async () => {
    const { defineAction, lines } = setup({ identify: async () => LEARNER });
    const run = vi.fn(async (value: { name: string }) => ({
      ok: true as const,
      value: value.name,
    }));
    const action = defineAction({
      name: "say-name",
      access: "signed-in",
      input,
      maxBytes: 100,
      run,
    });

    await expect(action({ name: "Sara" })).resolves.toEqual({ ok: true, value: "Sara" });
    expect(run).toHaveBeenCalledWith(
      { name: "Sara" },
      { caller: LEARNER, services: SERVICES, requestId: REQUEST_ID },
    );
    expect(lines).toEqual([
      {
        level: "info",
        requestId: REQUEST_ID,
        route: "POST /actions/say-name",
        outcome: "ok",
        durationMs: 5,
      },
    ]);
  });

  it("[NFR-SEC-03] refuses a signed-in action without a session, before the use case runs", async () => {
    const { defineAction, lines } = setup();
    const run = vi.fn(ok);
    const action = defineAction({
      name: "say-name",
      access: "signed-in",
      input,
      maxBytes: 100,
      run,
    });

    await expect(action({ name: "Sara" })).resolves.toEqual({ ok: false, error: "not_signed_in" });
    expect(run).not.toHaveBeenCalled();
    expect(lines.map((line) => line.outcome)).toEqual(["error:not-signed-in"]);
  });

  it("[NFR-SEC-06] [FR-ADM-01] answers not found to a learner calling an admin action", async () => {
    const { defineAction, lines, isAdmin } = setup({
      identify: async () => ({ ...LEARNER, aal: "aal2" }),
    });
    const run = vi.fn(ok);
    const action = defineAction({
      name: "save-course",
      access: "admin",
      input,
      maxBytes: 100,
      run,
    });

    await expect(action({ name: "x" })).resolves.toEqual({ ok: false, error: "not_found" });
    expect(isAdmin).toHaveBeenCalledOnce();
    expect(run).not.toHaveBeenCalled();
    expect(lines[0]).toMatchObject({ level: "warn", outcome: "error:not-found" });
  });

  it("[NFR-SEC-06] answers not found to an admin at aal1, whatever the database says", async () => {
    const { defineAction, isAdmin } = setup({
      identify: async () => LEARNER,
      isAdmin: vi.fn(async () => true),
    });
    const run = vi.fn(ok);
    const action = defineAction({
      name: "save-course",
      access: "admin",
      input,
      maxBytes: 100,
      run,
    });

    await expect(action({ name: "x" })).resolves.toEqual({ ok: false, error: "not_found" });
    expect(isAdmin).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("[FR-ADM-01] answers not found to a guest calling an admin action, without asking the database", async () => {
    const { defineAction, isAdmin } = setup();
    const run = vi.fn(ok);
    const action = defineAction({
      name: "save-course",
      access: "admin",
      input,
      maxBytes: 100,
      run,
    });

    await expect(action({ name: "x" })).resolves.toEqual({ ok: false, error: "not_found" });
    expect(isAdmin).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("[FR-ADM-01] answers not found, not invalid input, to a non-admin sending a bad or large input", async () => {
    const { defineAction } = setup({ identify: async () => LEARNER });
    const action = defineAction({
      name: "save-course",
      access: "admin",
      input,
      maxBytes: 20,
      run: ok,
    });

    await expect(action({ name: "x".repeat(100) })).resolves.toEqual({
      ok: false,
      error: "not_found",
    });
    await expect(action({ unknown: true })).resolves.toEqual({ ok: false, error: "not_found" });
  });

  it("[NFR-SEC-06] runs an admin action for an admin at aal2", async () => {
    const { defineAction } = setup({ identify: async () => ADMIN, isAdmin: async () => true });
    const action = defineAction({
      name: "save-course",
      access: "admin",
      input,
      maxBytes: 100,
      run: ok,
    });

    await expect(action({ name: "x" })).resolves.toEqual({ ok: true, value: "ok" });
  });

  it("[NFR-SEC-03] passes a null caller to an action anyone may call", async () => {
    const { defineAction } = setup();
    const run = vi.fn(async (_value: { name: string }, call: { caller: Identity | null }) => ({
      ok: true as const,
      value: call.caller,
    }));
    const action = defineAction({ name: "say-name", access: "anyone", input, maxBytes: 100, run });

    await expect(action({ name: "Sara" })).resolves.toEqual({ ok: true, value: null });
  });

  it.each([
    ["an unknown field", { name: "Sara", userId: LEARNER.userId }],
    ["a field over its limit", { name: "a".repeat(11) }],
    ["the wrong type", { name: 7 }],
    ["no object", "Sara"],
    ["nothing", undefined],
  ])("[NFR-SEC-03] refuses %s as invalid input", async (_name, raw) => {
    const { defineAction } = setup();
    const run = vi.fn(ok);
    const action = defineAction({ name: "say-name", access: "anyone", input, maxBytes: 100, run });

    await expect(action(raw)).resolves.toEqual({ ok: false, error: "invalid_input" });
    expect(run).not.toHaveBeenCalled();
  });

  it("[T-14] refuses an input larger than the limit before parsing it", async () => {
    const { defineAction } = setup();
    const parse = vi.spyOn(input, "safeParse");
    const action = defineAction({
      name: "say-name",
      access: "anyone",
      input,
      maxBytes: 20,
      run: ok,
    });

    // {"name":"Sara"} is 15 bytes; the second one is 21.
    await expect(action({ name: "Sara" })).resolves.toMatchObject({ ok: true });
    parse.mockClear();
    await expect(action({ name: "Sara-Sara!" })).resolves.toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });

  it("[T-14] counts bytes, not characters", async () => {
    const { defineAction } = setup();
    const action = defineAction({
      name: "say-name",
      access: "anyone",
      input,
      maxBytes: 15,
      run: ok,
    });

    // {"name":"Sara"} is 15 bytes; with "é" it is 16.
    await expect(action({ name: "Sara" })).resolves.toMatchObject({ ok: true });
    await expect(action({ name: "Saré" })).resolves.toEqual({ ok: false, error: "invalid_input" });
  });

  it("[T-14] refuses form data, whose JSON form hides its size", async () => {
    const { defineAction } = setup();
    const run = vi.fn(ok);
    const action = defineAction({ name: "say-name", access: "anyone", input, maxBytes: 100, run });
    const form = new FormData();
    form.set("name", "x".repeat(100_000));

    await expect(action(form)).resolves.toEqual({ ok: false, error: "invalid_input" });
    expect(run).not.toHaveBeenCalled();
  });

  it("[T-14] refuses an input with no JSON form", async () => {
    const { defineAction } = setup();
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    const action = defineAction({
      name: "say-name",
      access: "anyone",
      input,
      maxBytes: 100,
      run: ok,
    });

    await expect(action(cyclic)).resolves.toEqual({ ok: false, error: "invalid_input" });
    await expect(action(10n)).resolves.toEqual({ ok: false, error: "invalid_input" });
  });

  it("[NFR-SEC-03] returns the use case's own failure, and logs its code", async () => {
    const { defineAction, lines } = setup();
    const action = defineAction({
      name: "verify-email-code",
      access: "anyone",
      input,
      maxBytes: 100,
      run: async () => ({ ok: false as const, error: "code_rejected" as const }),
    });

    await expect(action({ name: "x" })).resolves.toEqual({ ok: false, error: "code_rejected" });
    expect(lines.map((line) => [line.level, line.outcome])).toEqual([
      ["info", "error:code-rejected"],
    ]);
  });

  it("[NFR-OBS-01] logs once and throws on a programmer error in the use case", async () => {
    const { defineAction, lines } = setup();
    const action = defineAction({
      name: "say-name",
      access: "anyone",
      input,
      maxBytes: 100,
      run: async () => {
        throw new TypeError("broken");
      },
    });

    await expect(action({ name: "x" })).rejects.toThrow("broken");
    expect(lines).toEqual([
      expect.objectContaining({
        level: "error",
        requestId: REQUEST_ID,
        outcome: "error:unexpected",
      }),
    ]);
  });

  it("[NFR-OBS-01] logs and throws when the identity check fails", async () => {
    const { defineAction, lines } = setup({
      identify: async () => {
        throw new Error("claims");
      },
    });
    const action = defineAction({
      name: "say-name",
      access: "anyone",
      input,
      maxBytes: 100,
      run: ok,
    });

    await expect(action({ name: "x" })).rejects.toThrow("claims");
    expect(lines.map((line) => line.outcome)).toEqual(["error:unexpected"]);
  });

  it("[NFR-OBS-01] logs with no request ID when the request's context cannot be built", async () => {
    const lines: LogEntry[] = [];
    const defineAction = createActionFactory<Services>({
      context: async () => {
        throw new Error("headers");
      },
      log: (entry) => lines.push(entry),
      now: () => 0,
    });
    const action = defineAction({
      name: "say-name",
      access: "anyone",
      input,
      maxBytes: 100,
      run: ok,
    });

    await expect(action({ name: "x" })).rejects.toThrow("headers");
    expect(lines).toEqual([
      expect.objectContaining({ requestId: "none", outcome: "error:unexpected" }),
    ]);
  });

  it("[NFR-OBS-01] writes the line once when the logger itself throws", async () => {
    const log = vi.fn(() => {
      throw new Error("log");
    });
    const run = vi.fn(ok);
    const defineAction = createActionFactory<Services>({
      context: async () => ({
        requestId: REQUEST_ID,
        identify: async () => null,
        isAdmin: async () => false,
        services: SERVICES,
      }),
      log,
      now: () => 0,
    });
    const action = defineAction({ name: "say-name", access: "anyone", input, maxBytes: 100, run });

    await expect(action({ name: "x" })).rejects.toThrow("log");
    expect(run).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledOnce();
  });

  it("[NFR-OBS-01] refuses a name the log line cannot carry", () => {
    const { defineAction } = setup();
    expect(() =>
      defineAction({ name: "Say Name", access: "anyone", input, maxBytes: 100, run: ok }),
    ).toThrow("lower-case words");
  });
});
