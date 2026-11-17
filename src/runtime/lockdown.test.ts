import { describe, expect, it } from "vitest";
import { BLOCKED_GLOBALS, BLOCKED_NAVIGATOR, lockDown } from "./lockdown.ts";

// A stand-in for a worker's global scope: fetch on the prototype, as on
// WorkerGlobalScope.prototype, and constructors on the object itself.
function fakeScope() {
  const eventTarget = { addEventListener() {} };
  const workerGlobalScope = Object.create(eventTarget, {
    fetch: { value: () => "request", configurable: true, writable: true },
    importScripts: { value: () => undefined, configurable: true, writable: true },
  }) as object;
  const navigatorPrototype = Object.create(null, {
    sendBeacon: { value: () => true, configurable: true },
    serviceWorker: { get: () => ({}), configurable: true },
    userAgent: { value: "test", configurable: true },
  }) as object;
  const scope = Object.create(workerGlobalScope) as Record<string, unknown>;
  Object.assign(scope, {
    XMLHttpRequest: class {},
    WebSocket: class {},
    EventSource: class {},
    Worker: class {},
    postMessage: () => undefined,
    setTimeout: () => 0,
    navigator: Object.create(navigatorPrototype) as object,
  });
  return scope;
}

describe("network lock-down", () => {
  it("[T-01] removes network and spawning APIs from the scope and its prototype chain", () => {
    const scope = fakeScope();
    expect(lockDown(scope)).toEqual({ ok: true });
    for (const name of BLOCKED_GLOBALS) expect(name in scope, name).toBe(false);
    const navigator = scope["navigator"] as object;
    for (const name of BLOCKED_NAVIGATOR) expect(name in navigator, name).toBe(false);
  });

  it("[T-01] leaves what the runtime still needs", () => {
    const scope = fakeScope();
    lockDown(scope);
    expect(typeof scope["setTimeout"]).toBe("function");
    expect("addEventListener" in scope).toBe(true);
    expect(Reflect.get(scope["navigator"] as object, "userAgent")).toBe("test");
  });

  it("[T-01] reports a name it could not remove, so the worker refuses to run", () => {
    const scope = fakeScope();
    Object.defineProperty(scope, "fetch", { value: () => "pinned", configurable: false });
    expect(lockDown(scope)).toEqual({ ok: false, remaining: ["fetch"] });
  });

  it("[T-01] removes them from a real global object's chain too", () => {
    // Node puts fetch and WebSocket on globalThis; a copy of its chain is used
    // so this test does not take them from the test runner.
    const scope = Object.create(
      Object.create(null, Object.getOwnPropertyDescriptors(globalThis)),
    ) as object;
    Object.defineProperty(scope, "fetch", { value: globalThis.fetch, configurable: true });
    expect(lockDown(scope).ok).toBe(true);
    expect("fetch" in scope).toBe(false);
    expect("WebSocket" in scope).toBe(false);
    expect(typeof globalThis.fetch).toBe("function");
  });
});
