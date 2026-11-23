import { expect, test, type Page } from "@playwright/test";
import { runtimeDev } from "../src/messages/runtime-dev";
import { BLOCKED_GLOBALS, BLOCKED_NAVIGATOR } from "../src/runtime/lockdown";
import { OUTPUT_LIMIT } from "../src/runtime/protocol";
import { WORKER_URL } from "../src/runtime/assets";

// WP-3.1's "Done when", in Chromium, Firefox and WebKit (the runtime-*
// projects), against the development-only runtime page. Each program runs
// in the real Pyodide worker; nothing is faked.
//
// Loading Pyodide takes seconds, and several tests wait for the 5 second
// limit and a new worker, so these tests have a longer budget than the
// default 30 s. It is set here once, for this file only.
test.describe.configure({ timeout: 120_000 });

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

/** Runs a program and returns its output once it has finished. */
async function outputOf(page: Page, source: string): Promise<string> {
  await runProgram(page, source);
  await expect(outcome(page)).toHaveAttribute("data-outcome", "ok");
  return (await output(page).textContent()) ?? "";
}

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
    expect((await output(page).textContent())?.length).toBe(OUTPUT_LIMIT);
    // A new worker, so nothing the flood left in a buffer reaches the next run.
    await expect(page.getByTestId("runtime-restarts")).toHaveText("1");
    await runProgram(page, 'print("after")');
    await expect(outcome(page)).toHaveAttribute("data-outcome", "ok");
    await expect(output(page)).toHaveText("after\n");
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

  test("[T-01] from Python, network, spawning and shared storage are gone, on the prototype chain too", async ({
    page,
  }) => {
    // The next test proves this log sees the worker's requests in each engine.
    const requests: string[] = [];
    page.context().on("request", (request) => requests.push(request.url()));
    const text = await outputOf(
      page,
      [
        "import js, sys",
        "from pyodide.ffi import jsnull",
        `names = ${JSON.stringify(BLOCKED_GLOBALS)}`,
        `navigator_names = ${JSON.stringify(BLOCKED_NAVIGATOR)}`,
        "print([name for name in names if hasattr(js, name)])",
        "chain = js.Object.getPrototypeOf(js)",
        "while chain is not None and chain is not jsnull:",
        "    print([name for name in names if js.Object.prototype.hasOwnProperty.call(chain, name)])",
        "    chain = js.Object.getPrototypeOf(chain)",
        "print([name for name in navigator_names if hasattr(js.navigator, name)])",
        // Pyodide's own network helpers bind fetch and XMLHttpRequest when
        // they are imported; nothing imported them before the lock-down.
        'print("pyodide.http" in sys.modules)',
        // open_url reads XMLHttpRequest from the worker's scope when called.
        // With it gone, Pyodide 314.0.7 raises NameError (seen under Node,
        // which has no XMLHttpRequest either). Any other error, or none,
        // fails the test.
        "try:",
        "    import pyodide.http",
        '    pyodide.http.open_url("/api/health")',
        '    print("fetched")',
        "except Exception as error:",
        "    print(type(error).__name__)",
      ].join("\n"),
    );
    const lines = text.trim().split("\n");
    expect(lines.length).toBeGreaterThan(4);
    expect(lines.slice(0, -2).every((line) => line === "[]")).toBe(true);
    expect(lines.slice(-2)).toEqual(["False", "NameError"]);
    expect(requests.filter((url) => url.includes("/api/health"))).toEqual([]);
  });

  test("[T-01] Pyodide's own loaders cannot reach the network after the lock-down", async ({
    page,
  }) => {
    const requests: string[] = [];
    page.context().on("request", (request) => requests.push(request.url()));
    // A control: the log must see this engine's worker requests at all, or
    // an empty log below would prove nothing.
    await page.reload();
    await expect(page.getByRole("status")).toHaveAttribute("data-status", "ready", {
      timeout: READY_MS,
    });
    expect(requests.some((url) => url.endsWith("/manifest.json"))).toBe(true);
    // The loaders answer with promises, which settle after the run; the
    // second run reads what they settled with.
    await outputOf(
      page,
      [
        "import sys, pyodide_js",
        "from pyodide.ffi import create_proxy",
        "sys._heap_probe = []",
        "def note(value):",
        "    sys._heap_probe.append(str(value))",
        "attempts = (",
        '    lambda: pyodide_js.loadPackage("micropip"),',
        '    lambda: pyodide_js._api.loadBinaryFile("/api/health"),',
        ")",
        // loadPackage resolves with the packages it loaded, so a resolved
        // value is noted with its length: 0 means nothing arrived.
        "def settled(value):",
        "    try:",
        '        note("resolved %d" % len(value))',
        "    except Exception:",
        '        note("resolved")',
        "for attempt in attempts:",
        "    try:",
        "        attempt().then(create_proxy(settled), create_proxy(note))",
        "    except Exception as error:",
        "        note(error)",
      ].join("\n"),
    );
    // loadPackage installs without importing, and each run removes modules
    // the run imported, so the file system is asked, not sys.modules.
    const probe = await outputOf(
      page,
      [
        "import importlib.util, sys",
        'print(len(sys._heap_probe), importlib.util.find_spec("micropip") is None, sys._heap_probe)',
      ].join("\n"),
    );
    // Both settled, neither with anything loaded, micropip is not installed,
    // and nothing was requested. This build serves no package wheel, so a
    // load would also end with nothing loaded without the lock-down: here the
    // request log is the evidence. The Python checks guard a build that
    // serves wheels.
    expect(probe).toMatch(/^2 True /);
    expect(probe).not.toMatch(/resolved [1-9]/);
    expect(probe).not.toMatch(/'resolved'/);
    expect(requests.filter((url) => /micropip|\/api\/health/.test(url))).toEqual([]);
  });

  test("[T-01] evaluating JavaScript from Python is refused, by the worker's own policy", async ({
    page,
  }) => {
    const refusals = await outputOf(
      page,
      [
        "import js, sys",
        "from pyodide.ffi import create_proxy",
        "from pyodide.code import run_js",
        "sys._heap_policies = []",
        'js.self.addEventListener("securitypolicyviolation", create_proxy(',
        "    lambda event: sys._heap_policies.append(event.originalPolicy)))",
        "attempts = (lambda: js.eval('1 + 1'), lambda: js.Function('return 1')(), lambda: run_js('1 + 1'))",
        "for attempt in attempts:",
        "    try:",
        "        attempt()",
        "        print('evaluated')",
        "    except Exception as error:",
        "        print('EvalError' in str(error))",
        // WebAssembly still compiles: the policy has 'wasm-unsafe-eval'.
        "print(bool(js.WebAssembly.validate(js.Uint8Array.new([0, 97, 115, 109, 1, 0, 0, 0]))))",
      ].join("\n"),
    );
    expect(refusals).toBe("True\nTrue\nTrue\nTrue\n");
    // The violation is reported against the worker's policy, not the page's.
    const policy = await outputOf(page, "import sys\nprint(sys._heap_policies[0])");
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(policy).not.toContain("nonce-");
  });

  test("[FR-RUN-07] a second visit loads the runtime from the cache", async ({ page }) => {
    await page.reload();
    await expect(page.getByRole("status")).toHaveAttribute("data-status", "ready", {
      timeout: READY_MS,
    });
    const transferred = await outputOf(
      page,
      [
        "import js",
        'entries = [entry for entry in js.performance.getEntriesByType("resource") if entry.name.endswith("pyodide.asm.wasm")]',
        'print(entries[0].transferSize if entries else "none")',
      ].join("\n"),
    );
    expect(transferred).toBe("0\n");
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

// A fresh page for each test: nothing loaded the runtime before, so the
// responses are first responses, not revalidations.
test.describe("Python runtime files", () => {
  test("[T-01] the worker script carries its own policy, and the page's has no wasm-unsafe-eval", async ({
    page,
  }) => {
    const workerResponse = page.waitForResponse((response) => response.url().endsWith(WORKER_URL));
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
});
