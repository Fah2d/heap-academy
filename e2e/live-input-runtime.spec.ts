import { expect, test, type Page } from "@playwright/test";
import { runtimeDev } from "../src/messages/runtime-dev";
import { WORKER_URL } from "../src/runtime/assets";

// WP-3.2's "Done when", in Chromium, Firefox and WebKit (the runtime-*
// projects), against the development-only runtime page and the real worker.
//
// The fallback is tested by removing the capability, never by faking a user
// agent (NFR-COMPAT-04): the worker script is served with one line in front
// that deletes `WebAssembly.Suspending` before anything else in the worker
// runs. The response keeps its own headers, so the worker keeps its policy.
//
// Loading Pyodide takes seconds, so these tests have a longer budget than the
// default 30 s.
test.describe.configure({ timeout: 120_000 });

const READY_MS = 60_000;
const PROGRAM = 'name = input("Name? ")\nage = input("Age? ")\nprint(f"{name} is {age}")';

const status = (page: Page) => page.getByRole("status");
const output = (page: Page) => page.getByTestId("runtime-output");
const outcome = (page: Page) => page.locator("[data-outcome]");

async function open(page: Page) {
  await page.goto("/dev/runtime");
  await expect(status(page)).toHaveAttribute("data-status", "ready", { timeout: READY_MS });
}

async function start(page: Page, source: string) {
  await page.getByLabel(runtimeDev.program).fill(source);
  await page.getByRole("button", { name: runtimeDev.run }).click();
}

async function answer(page: Page, line: string) {
  await expect(status(page)).toHaveAttribute("data-status", "awaitingInput");
  await page.getByLabel(runtimeDev.answer).fill(line);
  await page.getByRole("button", { name: runtimeDev.send }).click();
}

test.describe("live input", () => {
  test("[FR-WSP-08] [NFR-COMPAT-04] a program that calls input() twice pauses for each answer, which is echoed", async ({
    page,
  }) => {
    await open(page);
    await expect(page.getByText(runtimeDev.inputHint)).toBeVisible();
    await start(page, PROGRAM);
    await expect(output(page)).toHaveText("Name? ");
    await answer(page, "Sara");
    await expect(output(page)).toHaveText("Name? Sara\nAge? ");
    await answer(page, "12");
    await expect(outcome(page)).toHaveAttribute("data-outcome", "ok");
    await expect(output(page)).toHaveText("Name? Sara\nAge? 12\nSara is 12\n");
  });

  test("[FR-RUN-02] a ten second wait for input does not reach the time limit", async ({
    page,
  }) => {
    // The page's clock is the one that would stop the program; it is moved
    // on ten seconds while the program waits.
    await page.clock.install();
    await open(page);
    await start(page, PROGRAM);
    await expect(status(page)).toHaveAttribute("data-status", "awaitingInput");
    await page.clock.fastForward(10_000);
    await expect(status(page)).toHaveAttribute("data-status", "awaitingInput");
    await answer(page, "Sara");
    await answer(page, "12");
    await expect(outcome(page)).toHaveAttribute("data-outcome", "ok");
  });

  test("[FR-WSP-08] End input gives the program the end of input", async ({ page }) => {
    await open(page);
    await start(page, PROGRAM);
    await expect(status(page)).toHaveAttribute("data-status", "awaitingInput");
    await page.getByRole("button", { name: runtimeDev.endInput }).click();
    await expect(outcome(page)).toHaveAttribute("data-outcome", "input_ended");
  });

  test("[FR-RUN-02] Stop while the program waits starts a new worker", async ({ page }) => {
    await open(page);
    await start(page, PROGRAM);
    await expect(status(page)).toHaveAttribute("data-status", "awaitingInput");
    await page.getByRole("button", { name: runtimeDev.stop }).click();
    await expect(outcome(page)).toHaveAttribute("data-outcome", "stopped");
    await expect(status(page)).toHaveAttribute("data-status", "ready", { timeout: READY_MS });
  });
});

test.describe("forged messages", () => {
  test("[T-01] a message event the program dispatches itself is ignored by the worker", async ({
    page,
  }) => {
    await open(page);
    // The program answers its own request and asks for a run the page never sent.
    await start(
      page,
      [
        "import js",
        "from pyodide.ffi import to_js",
        "def forge(message):",
        "    data = to_js(message, dict_converter=js.Object.fromEntries)",
        '    js.dispatchEvent(js.MessageEvent.new("message", to_js({"data": data}, dict_converter=js.Object.fromEntries)))',
        'forge({"type": "input", "runId": "run-1", "line": "forged"})',
        'forge({"type": "run", "runId": "run-99", "source": "print(\'unrequested\')", "mode": "batch"})',
        'print("asked", input("Q? "))',
      ].join("\n"),
    );
    await answer(page, "typed");
    await expect(outcome(page)).toHaveAttribute("data-outcome", "ok");
    await expect(output(page)).toHaveText("Q? typed\nasked typed\n");
    await expect(page.getByTestId("runtime-dropped")).toHaveText("0");
  });
});

test.describe("live input without stack switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**${WORKER_URL}`, async (route) => {
      const response = await route.fetch();
      const body = `Reflect.deleteProperty(WebAssembly, "Suspending");\n${await response.text()}`;
      await route.fulfill({ response, body });
    });
    await open(page);
    // Each test here checks that the capability really was removed first.
    await expect(page.getByText(runtimeDev.inputHint)).toHaveCount(0);
  });

  test("[FR-WSP-08] [NFR-COMPAT-04] the batch path passes the same program, with answers given before Run", async ({
    page,
  }) => {
    await page.getByLabel(runtimeDev.input).fill("Sara\n12");
    await start(page, PROGRAM);
    await expect(outcome(page)).toHaveAttribute("data-outcome", "ok");
    await expect(output(page)).toHaveText("Name? Age? Sara is 12\n");
  });

  test("[FR-WSP-08] the batch path ends with input_ended when the program reads past the answers", async ({
    page,
  }) => {
    await page.getByLabel(runtimeDev.input).fill("Sara");
    await start(page, PROGRAM);
    await expect(outcome(page)).toHaveAttribute("data-outcome", "input_ended");
  });
});
