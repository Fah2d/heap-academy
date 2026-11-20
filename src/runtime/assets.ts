// Where the runtime's files are served (architecture section 5.1). The base
// path is this one value, so the Pyodide files can move to another host by
// changing it here and in the worker's policy (docs/spec/07-operations.md
// section 9).

/** The Pyodide release in package.json; the runtime build refuses any other. */
export const RUNTIME_VERSION = "314.0.7";

/** Everything the runtime serves is under this path; the page's proxy skips it. */
export const RUNTIME_ROOT = "/_runtime/";

export const RUNTIME_ASSET_BASE_URL = `${RUNTIME_ROOT}pyodide/`;

/**
 * The worker script, compiled from src by scripts/build-runtime.mjs: the
 * worker and the grader modules it imports keep their paths under src.
 */
export const WORKER_DIRECTORY = `${RUNTIME_ROOT}worker/`;
export const WORKER_URL = `${WORKER_DIRECTORY}runtime/worker/python-worker.js`;

/** The folder of this release's files, as the worker's `init` message carries it. */
export const runtimeAssetBase = `${RUNTIME_ASSET_BASE_URL}${RUNTIME_VERSION}/`;
