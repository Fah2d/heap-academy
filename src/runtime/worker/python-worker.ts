import { lockDown } from "../lockdown.ts";
import { createWorkerCore } from "./core.ts";

// The Python worker's entry: a module worker, compiled by the TypeScript
// compiler to public/_runtime/worker/ and served with its own policy
// (ADR-0033; docs/spec/06-security-privacy.md section 5.1). Turbopack would
// build a classic worker, which Pyodide 314 does not support (E-03).
//
// References the worker needs after the lock-down are taken before it.

const scope = globalThis;
const post = scope.postMessage.bind(scope);
// Held now: Python can replace the global after the lock-down.
const setLater = scope.setTimeout.bind(scope);
const originalFetch = scope.fetch.bind(scope);

function countFetchedBytes(onBytes: (bytes: number) => void): () => void {
  const counting = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const response = await originalFetch(input, init);
    if (response.body === null) return response;
    const counter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        onBytes(chunk.byteLength);
        controller.enqueue(chunk);
      },
    });
    // The headers come along, so a WebAssembly file keeps its media type.
    return new Response(response.body.pipeThrough(counter), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
  Reflect.set(scope, "fetch", counting);
  return () => {
    Reflect.set(scope, "fetch", originalFetch);
  };
}

const core = createWorkerCore({
  post: (message) => {
    post(message);
  },
  now: () => performance.now(),
  fetchJson: async (url) => {
    const response = await originalFetch(url);
    if (!response.ok) throw new Error(`status ${String(response.status)}`);
    return (await response.json()) as unknown;
  },
  importModule: (url) => import(url) as Promise<unknown>,
  countFetchedBytes,
  lockDown: () => lockDown(scope),
  later: (callback) => {
    setLater(callback, 0);
  },
});

// Only the page's messages count. Python can reach `dispatchEvent` and make
// its own message event, to answer its own input request or start a run the
// page never sent; such an event is never trusted, and Python cannot change
// that (WP-3.2 security review 1).
scope.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (!event.isTrusted) return;
  core.receive(event.data);
});
