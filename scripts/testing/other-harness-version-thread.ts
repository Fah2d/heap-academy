// A stand-in for the Node runner's thread (src/grader/node-runner/thread.ts).
// It answers every test case with a well-formed passing result from another
// harness version, so the runner's version check can be tested without
// changing the harness.

import { parentPort } from "node:worker_threads";

const port = parentPort;
if (port === null) throw new Error("this stand-in must run as a worker thread");
const result = JSON.stringify({
  version: "another-version",
  stage: "after_code",
  output: "",
  truncated: false,
  error: null,
});
port.on("message", () => {
  port.postMessage({ type: "result", text: result });
});
port.postMessage({ type: "ready", runtimeVersion: "stand-in" });
