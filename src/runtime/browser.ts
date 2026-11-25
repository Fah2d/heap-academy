import { WORKER_URL } from "./assets.ts";
import type { WorkerLike } from "./controller.ts";

/**
 * Starts the Python worker as a module worker: Pyodide 314 loads only in one
 * (E-03). The URL is a plain string, so the bundler leaves it alone (ADR-0033).
 */
export function createPythonWorker(): WorkerLike {
  return new Worker(WORKER_URL, { type: "module", name: "python" });
}
