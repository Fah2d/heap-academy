// Where the runtime's files are served (architecture section 5.1). The base
// path is this one value, so the Pyodide files can move to another host by
// changing it here and in the worker's policy (docs/spec/07-operations.md
// section 9).

/** The Pyodide release in package.json; the runtime build refuses any other. */
export const RUNTIME_VERSION = "314.0.7";

export const RUNTIME_ASSET_BASE_URL = "/_runtime/pyodide/";

/** The worker script, compiled from src/runtime/worker by scripts/build-runtime.mjs. */
export const WORKER_DIRECTORY = "/_runtime/worker/";
export const WORKER_URL = `${WORKER_DIRECTORY}worker/python-worker.js`;

/** The folder of this release's files, as the worker's `init` message carries it. */
export const runtimeAssetBase = `${RUNTIME_ASSET_BASE_URL}${RUNTIME_VERSION}/`;
