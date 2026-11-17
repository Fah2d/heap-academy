// The network lock-down (architecture section 5.6, threat T-01). The worker
// shares the app's origin, so a program a learner was tricked into pasting
// could otherwise call the app with the learner's session. Once the runtime
// has loaded what it needs, these names are removed from the worker's global
// scope and from every object on its prototype chain: `fetch`, for one, lives
// on WorkerGlobalScope.prototype, not on the global object itself.
//
// This is hardening, not a boundary: the worker script's own policy
// (`connect-src 'self'`, no `unsafe-eval`) is the second layer, and the
// residual risks are in docs/spec/06-security-privacy.md section 6.

/** Network, spawning, cross-context channels, and storage shared with the page's origin. */
export const BLOCKED_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "WebSocketStream",
  "EventSource",
  "WebTransport",
  "Worker",
  "SharedWorker",
  "importScripts",
  "BroadcastChannel",
  "caches",
  // IndexedDB belongs to the origin, so a later feature's drafts or progress
  // stored there would be readable by a pasted program.
  "indexedDB",
  // The page reads the worker's messages through the protocol parser, but a
  // program has no reason to post its own. The worker keeps a bound copy.
  "postMessage",
] as const;

/**
 * On the worker's navigator: a beacon is a request, a service worker outlives
 * the page, and `storage` (the origin's private file system), `storageBuckets`
 * and `locks` are shared with every page of the origin.
 */
export const BLOCKED_NAVIGATOR = [
  "sendBeacon",
  "serviceWorker",
  "storage",
  "storageBuckets",
  "locks",
] as const;

export type LockdownResult = { ok: true } | { ok: false; remaining: string[] };

/** Every object from `target` up its prototype chain, `target` first. */
function chain(target: object): object[] {
  const objects: object[] = [];
  for (let current: object | null = target; current !== null;) {
    objects.push(current);
    current = Object.getPrototypeOf(current) as object | null;
  }
  return objects;
}

function remove(target: object, names: readonly string[]): void {
  for (const object of chain(target)) {
    for (const name of names) {
      if (Object.hasOwn(object, name)) Reflect.deleteProperty(object, name);
    }
  }
}

/**
 * Removes the blocked names and reports any that can still be reached, so
 * the worker can refuse to run a program when the lock-down did not hold.
 */
export function lockDown(scope: object): LockdownResult {
  const navigator: unknown = Reflect.get(scope, "navigator");
  remove(scope, BLOCKED_GLOBALS);
  const remaining: string[] = BLOCKED_GLOBALS.filter((name) => name in scope);
  if (typeof navigator === "object" && navigator !== null) {
    remove(navigator, BLOCKED_NAVIGATOR);
    for (const name of BLOCKED_NAVIGATOR) {
      if (name in navigator) remaining.push(`navigator.${name}`);
    }
  }
  return remaining.length === 0 ? { ok: true } : { ok: false, remaining };
}
