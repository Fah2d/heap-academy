import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { lessonEditor } from "../src/messages/admin";
import { workspace as words } from "../src/messages/workspace";
import { saveScreen } from "./screens";

// WP-5.4: the admin's preview (FR-ADM-08; docs/spec/03-experience.md section
// 7.7) on the development-only page /dev/admin/preview, which holds the
// example lesson in the preview inside the admin frame with no database, and
// a lesson that keeps working with the network cut (NFR-REL-02) on
// /dev/workspace. The real route's guard is in the unit tests; its read needs
// the local stack. Runs in the runtime-* projects against the development
// server.
test.describe.configure({ timeout: 120_000 });

const READY_MS = 60_000;

const python = (page: Page) => page.locator("[data-python]");
const editor = (page: Page) => page.locator(".cm-content");
const runButton = (page: Page) => page.getByRole("button", { name: new RegExp(`^${words.run}`) });
const checkButton = (page: Page) =>
  page.getByRole("button", { name: new RegExp(`^${words.check}`) });

async function ready(page: Page) {
  await expect(python(page)).toHaveAttribute("data-python", "ready", { timeout: READY_MS });
}

async function write(page: Page, code: string) {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(code);
}

// A state change has a 160 ms color transition (DESIGN.md section 7); axe and
// the screenshots measure the settled colors.
async function settled(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.effect?.getComputedTiming().iterations === Infinity),
  );
}

/** Every row of one store of the device's database; none when it does not exist. */
function deviceRows(page: Page, store: "code" | "completions") {
  return page.evaluate(
    (name) =>
      new Promise<unknown[]>((resolve, reject) => {
        void indexedDB.databases().then((known) => {
          if (!known.some((database) => database.name === "heap-academy")) {
            resolve([]);
            return;
          }
          const open = indexedDB.open("heap-academy");
          open.onerror = () => {
            reject(open.error ?? new Error("IndexedDB open failed"));
          };
          open.onsuccess = () => {
            const database = open.result;
            if (!database.objectStoreNames.contains(name)) {
              database.close();
              resolve([]);
              return;
            }
            const read = database.transaction(name).objectStore(name).getAll();
            read.onsuccess = () => {
              database.close();
              resolve(read.result);
            };
            read.onerror = () => {
              database.close();
              reject(read.error ?? new Error("IndexedDB read failed"));
            };
          };
        });
      }),
    store,
  );
}

test("[FR-ADM-08] the preview runs and checks the lesson, and keeps and records nothing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dev/admin/preview");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(EXAMPLE_LESSON.title);
  await expect(page.getByText(words.previewBody)).toBeVisible();
  await expect(page.getByRole("link", { name: lessonEditor.backToEditor })).toHaveAttribute(
    "href",
    "/dev/admin",
  );
  await expect(page.getByRole("navigation", { name: words.lessons })).toHaveCount(0);
  await ready(page);

  // The workspace fills the window inside the admin frame; the page does not scroll.
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
  ).toBe(true);

  await write(page, EXAMPLE_LESSON.solution);
  await checkButton(page).click();
  await expect(page.locator("[data-summary]")).toHaveText(words.summary(2, 2));
  await expect(page.locator("[data-completion]")).toHaveText(words.previewComplete);
  // Past the 400 ms a learner's workspace waits before saving typed code.
  await page.waitForTimeout(1_000);
  expect(await deviceRows(page, "code")).toEqual([]);
  expect(await deviceRows(page, "completions")).toEqual([]);
  await settled(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "admin-preview-passed", 1280, { workPackage: "WP-5.4" });

  // The learner's workspace of the same lesson starts from the starter code.
  await page.goto("/dev/workspace");
  await ready(page);
  await expect(page.getByText(words.restored)).toHaveCount(0);
  await expect(page.locator("[data-completion]")).toHaveCount(0);
});

test("[NFR-REL-02] with the network cut after load, Run and Check work and the pass is kept", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dev/workspace");
  await ready(page);
  await context.setOffline(true);

  await write(page, 'print("offline")');
  await runButton(page).click();
  await expect(page.getByTestId("console-output")).toContainText("offline");

  await write(page, EXAMPLE_LESSON.solution);
  await checkButton(page).click();
  await expect(page.locator("[data-completion]")).toHaveText(words.completeFirst(10));
  expect(await deviceRows(page, "completions")).toEqual([
    expect.objectContaining({ code: EXAMPLE_LESSON.solution, synced: false }),
  ]);
  await context.setOffline(false);
});
