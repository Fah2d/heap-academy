import { expect, test, type Page } from "@playwright/test";
import { runtimeDev } from "../src/messages/runtime-dev";

// WP-3.1's "Done when", in Chromium, Firefox and WebKit (the runtime-*
// projects), against the development-only runtime page. Each program runs
// in the real Pyodide worker; nothing is faked.

const READY_MS = 60_000;

async function open(page: Page) {
  await page.goto("/dev/runtime");
  await expect(page.getByRole("status")).toHaveAttribute("data-status", "ready", {
    timeout: READY_MS,
  });
}

async function runProgram(page: Page, source: string, stdin = "") {
  await expect(page.getByRole("status")).toHaveAttribute("data-status", "ready", {
    timeout: READY_MS,
  });
  await page.getByLabel(runtimeDev.program).fill(source);
  await page.getByLabel(runtimeDev.input).fill(stdin);
  await page.getByRole("button", { name: runtimeDev.run }).click();
}

const outcome = (page: Page) => page.locator("[data-outcome]");
const output = (page: Page) => page.getByTestId("runtime-output");

test.describe("Python runtime", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("[FR-RUN-01] runs a program with batch input and shows its output", async ({ page }) => {
    await runProgram(page, 'name = input()\nprint("Hello,", name)', "Ada");
    await expect(outcome(page)).toHaveAttribute("data-outcome", "ok");
    await expect(output(page)).toHaveText("Hello, Ada\n");
  });

  test("[FR-RUN-01] streams output while the program is still running", async ({ page }) => {
    // A busy wait, so the worker cannot yield between the two prints.
    await runProgram(
      page,
      'import time\nprint("first")\nend = time.time() + 2\nwhile time.time() < end: pass\nprint("second")',
    );
    await expect(output(page)).toHaveText("first\n");
    await expect(page.getByRole("status")).toHaveAttribute("data-status", "running");
    await expect(outcome(page)).toHaveAttribute("data-outcome", "ok", { timeout: 10_000 });
    await expect(output(page)).toHaveText("first\nsecond\n");
  });

  test("[FR-RUN-01] reports an error with the learner's line", async ({ page }) => {
    await runProgram(page, "a = 1\nprint(b)");
    await expect(outcome(page)).toHaveAttribute("data-outcome", "runtime");
    await expect(outcome(page)).toContainText(runtimeDev.line(2));
    await expect(output(page)).toContainText("NameError");
  });

  test("[FR-RUN-02] [NFR-REL-03] stops while True: pass at the limit, and the next run works within 5 s", async ({
    page,
  }) => {
    await runProgram(page, "while True: pass");
    await expect(outcome(page)).toHaveAttribute("data-outcome", "time_limit", { timeout: 15_000 });
    const stoppedAt = Date.now();
    await expect(page.getByRole("status")).toHaveAttribute("data-status", "ready", {
      timeout: 5_000,
    });
    expect(Date.now() - stoppedAt).toBeLessThan(5_000);
    await expect(page.getByTestId("runtime-restarts")).toHaveText("1");
    await runProgram(page, 'print("again")');
    await expect(outcome(page)).toHaveAttribute("data-outcome", "ok");
    await expect(output(page)).toHaveText("again\n");
  });

  test("[FR-RUN-02] Stop ends a run at once", async ({ page }) => {
    await runProgram(page, "while True: pass");
    await expect(page.getByRole("status")).toHaveAttribute("data-status", "running");
    await page.getByRole("button", { name: runtimeDev.stop }).click();
    await expect(outcome(page)).toHaveAttribute("data-outcome", "stopped");
  });

  test("[FR-RUN-03] caps a print flood at 64,000 characters and says so", async ({ page }) => {
    await runProgram(page, 'while True:\n    print("x" * 99)');
    await expect(outcome(page)).toHaveAttribute("data-outcome", "output_limit", {
      timeout: 15_000,
    });
    await expect(outcome(page)).toHaveAttribute("data-truncated", "true");
    expect((await output(page).textContent())?.length).toBe(64_000);
  });

  test("[FR-RUN-06] [NFR-REL-03] recovers from a memory bomb without a reload", async ({
    page,
  }) => {
    await runProgram(page, 'data = []\nwhile True:\n    data.append(" " * 10_000_000)');
    // Either Python's MemoryError, or the browser ending the worker.
    await expect(outcome(page)).toHaveAttribute("data-outcome", /^(?:memory|crashed)$/, {
      timeout: 30_000,
    });
    const failedAt = Date.now();
    await expect(page.getByRole("status")).toHaveAttribute("data-status", "ready", {
      timeout: 5_000,
    });
    expect(Date.now() - failedAt).toBeLessThan(5_000);
    await runProgram(page, 'print("recovered")');
    await expect(output(page)).toHaveText("recovered\n");
  });

  test("[T-01] from Python, network and spawning APIs are gone, on the prototype chain too", async ({
    page,
  }) => {
    await runProgram(
      page,
      [
        "import js",
        'names = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "Worker", "importScripts", "BroadcastChannel", "postMessage"]',
        "print([name for name in names if hasattr(js, name)])",
        "chain = js.Object.getPrototypeOf(js)",
        "while chain is not None and str(chain) != 'jsnull':",
        "    print([name for name in names if js.Object.prototype.hasOwnProperty.call(chain, name)])",
        "    chain = js.Object.getPrototypeOf(chain)",
        'print(hasattr(js.navigator, "sendBeacon"))',
      ].join("\n"),
    );
    await expect(outcome(page)).toHaveAttribute("data-outcome", "ok");
    const lines = ((await output(page).textContent()) ?? "").trim().split("\n");
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.slice(0, -1).every((line) => line === "[]")).toBe(true);
    expect(lines.at(-1)).toBe("False");
  });

  test("[T-01] evaluating JavaScript from Python is refused by the worker's own policy", async ({
    page,
  }) => {
    await runProgram(
      page,
      [
        "import js",
        "for attempt in (lambda: js.eval('1 + 1'), lambda: js.Function('return 1')()):",
        "    try:",
        "        attempt()",
        "        print('evaluated')",
        "    except Exception as error:",
        "        print('refused')",
        "from pyodide.code import run_js",
        "try:",
        "    run_js('1 + 1')",
        "    print('evaluated')",
        "except Exception:",
        "    print('refused')",
        // WebAssembly still compiles: the policy has 'wasm-unsafe-eval'.
        "print(bool(js.WebAssembly.validate(js.Uint8Array.new([0, 97, 115, 109, 1, 0, 0, 0]))))",
      ].join("\n"),
    );
    await expect(outcome(page)).toHaveAttribute("data-outcome", "ok");
    await expect(output(page)).toHaveText("refused\nrefused\nrefused\nTrue\n");
  });

  test("[T-01] the worker script carries its own policy, and the page's has no wasm-unsafe-eval", async ({
    page,
  }) => {
    const workerResponse = page.waitForResponse((response) =>
      response.url().endsWith("/_runtime/worker/worker/python-worker.js"),
    );
    const pageResponse = await page.goto("/dev/runtime");
    const policy = (await workerResponse).headers()["content-security-policy"] ?? "";
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(pageResponse?.headers()["content-security-policy"]).not.toContain("wasm-unsafe-eval");
    await expect(page.getByRole("status")).toHaveAttribute("data-status", "ready", {
      timeout: READY_MS,
    });
  });

  test("[FR-RUN-07] serves the runtime files immutable, under their version", async ({ page }) => {
    const wasm = page.waitForResponse((response) => response.url().endsWith("pyodide.asm.wasm"));
    await page.goto("/dev/runtime");
    const response = await wasm;
    expect(response.url()).toMatch(/\/_runtime\/pyodide\/\d+\.\d+\.\d+\/pyodide\.asm\.wasm$/);
    expect(response.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  test("[FR-RUN-01] the page stays responsive during a busy loop: no frame gap of 50 ms", async ({
    page,
  }) => {
    await runProgram(page, "while True: pass");
    await expect(page.getByRole("status")).toHaveAttribute("data-status", "running");
    const longestGap = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let last = performance.now();
          let longest = 0;
          const end = last + 2_000;
          const frame = (time: number) => {
            longest = Math.max(longest, time - last);
            last = time;
            if (time < end) requestAnimationFrame(frame);
            else resolve(longest);
          };
          requestAnimationFrame(frame);
        }),
    );
    expect(longestGap).toBeLessThan(50);
    await page.getByRole("button", { name: runtimeDev.stop }).click();
  });

  test("[NFR-SEC-01] drops nothing in a normal session", async ({ page }) => {
    await runProgram(page, 'print("ok")');
    await expect(outcome(page)).toHaveAttribute("data-outcome", "ok");
    await expect(page.getByTestId("runtime-dropped")).toHaveText("0");
  });
});
