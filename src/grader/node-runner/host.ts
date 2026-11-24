// Loads Pyodide under Node and evaluates the harness: the part of the Node
// runner (docs/spec/04-content-system.md section 3.2) that runs inside its
// worker thread. Tests and scripts only (ADR-0032); no production path runs
// learner or lesson code outside the learner's browser.
//
// Erasable TypeScript only: Node loads this file in the thread with its own
// type stripping, without the test tool's transform.

import { loadPyodide } from "pyodide";
import { HARNESS_SOURCE, HARNESS_VERSION } from "../harness.ts";

export type HarnessHost = {
  runtimeVersion: string;
  harnessVersion: string;
  /** Runs one test case and returns the harness's JSON text, unparsed. */
  check: (source: string, stdin: string, afterCode: string) => unknown;
};

export async function loadHarness(): Promise<HarnessHost> {
  const pyodide = await loadPyodide();
  // The harness captures what learner code writes. Anything that still
  // reaches Pyodide's own streams is dropped, not printed into the test log.
  pyodide.setStdout({ batched: () => {} });
  pyodide.setStderr({ batched: () => {} });
  const check: unknown = pyodide.runPython(HARNESS_SOURCE);
  if (typeof check !== "function") throw new Error("the harness did not evaluate to a function");
  return {
    runtimeVersion: pyodide.version,
    harnessVersion: HARNESS_VERSION,
    check: (source, stdin, afterCode) =>
      Reflect.apply(check, undefined, [source, stdin, afterCode]) as unknown,
  };
}
