import { expect, type Page } from "@playwright/test";

// The keyboard walkthrough of a whole page (NFR-A11Y-03, WP-7.2): Tab from the
// top until focus comes back to where it started, and compare what it reached
// with every control the page shows, in document order. The workspace's own
// walkthrough, with its named stops, is in e2e/workspace-a11y-runtime.spec.ts.

/** One place the Tab key reached. */
export type Stop = {
  /** The control's place among the page's controls, or -1 for anything else. */
  index: number;
  name: string;
  /** DESIGN.md section 6: a solid 2 px outline. */
  ringed: boolean;
  inEditor: boolean;
  /** Focus on the page itself, or on Next.js's development indicator. */
  outside: boolean;
};

const MARK = "data-keyboard-stop";

/**
 * Numbers every control the Tab key should reach, in document order, and
 * returns their names. A control counts when it is shown, enabled, not inert,
 * and has no negative tabindex. A group of radio buttons is one stop: its
 * checked button, or its first.
 */
export function markControls(page: Page): Promise<string[]> {
  return page.evaluate((mark) => {
    const selector =
      "a[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable='true']";
    const radioGroups = new Set<string>();
    const controls = [...document.querySelectorAll<HTMLElement>(selector)].filter((element) => {
      if (element.closest("[inert], nextjs-portal") !== null) return false;
      if (element.matches(":disabled") || element.tabIndex < 0) return false;
      if (!element.checkVisibility({ visibilityProperty: true })) return false;
      if (element instanceof HTMLInputElement && element.type === "radio" && element.name !== "") {
        if (radioGroups.has(element.name)) return false;
        const checked = document.querySelector<HTMLInputElement>(
          `input[type="radio"][name="${CSS.escape(element.name)}"]:checked`,
        );
        if (checked !== null && checked !== element) return false;
        radioGroups.add(element.name);
      }
      return true;
    });
    for (const element of document.querySelectorAll(`[${mark}]`)) element.removeAttribute(mark);
    return controls.map((element, index) => {
      element.setAttribute(mark, String(index));
      return (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 60);
    });
  }, MARK);
}

/** Where the keyboard is now. The editor draws its ring on its outer element. */
export function focused(page: Page): Promise<Stop> {
  return page.evaluate((mark) => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) {
      return { index: -1, name: "", ringed: false, inEditor: false, outside: true };
    }
    const inEditor = element.classList.contains("cm-content");
    const ringHolder = inEditor ? element.closest(".cm-editor") : element;
    const style = ringHolder === null ? undefined : getComputedStyle(ringHolder);
    return {
      index: Number(element.getAttribute(mark) ?? -1),
      name: (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 60),
      ringed: style !== undefined && style.outlineStyle === "solid" && style.outlineWidth === "2px",
      inEditor,
      outside: element.tagName.toLowerCase() === "nextjs-portal",
    };
  }, MARK);
}

/**
 * Tabs from where focus is until it comes back to the first stop, and returns
 * the stops from the page's first control. After the last control, focus may
 * pass the page itself and the development indicator before it wraps; those
 * are left out. Focus on the page anywhere else is focus lost, and is kept as
 * a stop with index -1.
 */
export async function walk(page: Page, limit: number): Promise<Stop[]> {
  const stops: Stop[] = [];
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press("Tab");
    // CodeMirror marks itself focused a moment after the focus event. With two
    // editors side by side, the one just left may still carry the mark.
    await page.waitForFunction(() => {
      const element = document.activeElement;
      return (
        element === null ||
        !element.classList.contains("cm-content") ||
        element.closest(".cm-editor")?.classList.contains("cm-focused") === true
      );
    });
    const stop = await focused(page);
    // The first control reached; a walk that begins on the last control wraps first.
    const first = stops.find((reached) => reached.index !== -1);
    if (first !== undefined && stop.index === first.index) {
      // From the first control, whatever control the walk began on.
      const start = Math.max(
        0,
        stops.findIndex((reached) => reached.index === 0),
      );
      const ordered = [...stops.slice(start), ...stops.slice(0, start)];
      while (ordered.at(-1)?.outside === true) ordered.pop();
      return ordered;
    }
    stops.push(stop);
    // The editor keeps Tab for indenting; Escape, then Tab, leaves it.
    if (stop.inEditor) await page.keyboard.press("Escape");
  }
  throw new Error(`Focus never came back to the first stop: ${JSON.stringify(stops)}`);
}

/**
 * Walks the page from where focus is: Tab reaches every control once, in
 * document order, each with its focus ring, and focus is never lost.
 */
export async function expectEveryControlReached(page: Page) {
  const controls = await markControls(page);
  // Every control once, then the wrap back to the first.
  const stops = await walk(page, controls.length + 5);
  expect(controls.length).toBeGreaterThan(0);
  expect(stops.map((stop) => `${String(stop.index)} ${stop.name}`)).toEqual(
    controls.map((name, index) => `${String(index)} ${name}`),
  );
  expect(stops.filter((stop) => !stop.ringed).map((stop) => stop.name)).toEqual([]);
}
