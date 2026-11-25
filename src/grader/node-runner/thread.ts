// The Node runner's worker thread: loads the harness, then runs one test case
// per message. The runner on the main thread owns the clock and terminates
// this thread at the time limit, as the page does with the browser worker.

import { parentPort } from "node:worker_threads";
import { loadHarness } from "./host.ts";

const port = parentPort;
if (port === null) throw new Error("the Node runner's thread must run as a worker thread");
const host = await loadHarness();
port.on("message", (message: { source: string; stdin: string; afterCode: string }) => {
  port.postMessage({
    type: "result",
    text: host.check(message.source, message.stdin, message.afterCode),
  });
});
port.postMessage({ type: "ready", runtimeVersion: host.runtimeVersion });
