import { expect, type Page } from "@playwright/test";

// The keyboard walkthrough of a whole page (NFR-A11Y-03, WP-7.2): Tab from
// where focus is until it wraps, and compare what it reached with every
// control the page shows, in document order. The workspace's own walkthrough,
// with its named stops in reading order, is in e2e/workspace-a11y-runtime.spec.ts.

/** One place the Tab key reached. */
export type Stop = {
  /** The control's place among the page's controls, or -1 for anything else. */
  index: number;
  name: string;
  /**
   * DESIGN.md section 6: a solid 2 px outline in `--color-focus`, offset 2 px,
   * or -2 px inside an overflow container, on a control shown in the viewport.
   */
  ringed: boolean;
  inEditor: boolean;
  /** Focus on the page itself, or on Next.js's development indicator. */
  outside: boolean;
};

const MARK = "data-keyboard-stop";

/**
 * Numbers every control the Tab key should reach, in document order, and
 * returns their names. A control counts when it is shown, enabled, not inert,
 * and has no negative tabindex. The site has no radio buttons; a group of
 * them is one stop, so one would make this list longer than the walk.
 */
export function markControls(page: Page): Promise<string[]> {
  return page.evaluate((mark) => {
    const selector =
      "a[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable='true']";
    const controls = [...document.querySelectorAll<HTMLElement>(selector)].filter(
      (element) =>
        element.closest("[inert], nextjs-portal") === null &&
        !element.matches(":disabled") &&
        element.tabIndex >= 0 &&
        element.checkVisibility({ visibilityProperty: true }),
    );
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
    // The ring's colour as the page resolves the token.
    const probe = document.createElement("span");
    probe.style.outlineColor = "var(--color-focus)";
    document.body.append(probe);
    const focusColor = getComputedStyle(probe).outlineColor;
    probe.remove();
    // A token that resolves to a see-through colour draws no ring.
    const channels = /^rgba?\(([^)]*)\)$/.exec(focusColor)?.[1]?.split(",") ?? [];
    const opaque = channels.length === 3 || (channels.length === 4 && Number(channels[3]) === 1);
    let ringed = false;
    if (ringHolder !== null) {
      const style = getComputedStyle(ringHolder);
      const box = ringHolder.getBoundingClientRect();
      ringed =
        style.outlineStyle === "solid" &&
        style.outlineWidth === "2px" &&
        opaque &&
        style.outlineColor === focusColor &&
        (style.outlineOffset === "2px" || style.outlineOffset === "-2px") &&
        ringHolder.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
        box.width > 0 &&
        box.height > 0 &&
        box.bottom > 0 &&
        box.right > 0 &&
        box.top < window.innerHeight &&
        box.left < window.innerWidth;
    }
    return {
      index: Number(element.getAttribute(mark) ?? -1),
      name: (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 60),
      ringed,
      inEditor,
      outside: element.tagName.toLowerCase() === "nextjs-portal",
    };
  }, MARK);
}

/**
 * Presses Tab once, then waits for the ring to settle: CodeMirror marks
 * itself focused a moment after the focus event (with two editors side by
 * side, the one just left may still carry the mark), and a control with a
 * colour transition (DESIGN.md section 7) fades its ring in from its text
 * colour over 160 ms.
 */
export async function tab(page: Page) {
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => {
    const element = document.activeElement;
    if (element === null) return true;
    const inEditor = element.classList.contains("cm-content");
    const holder = inEditor ? element.closest(".cm-editor") : element;
    if (holder === null || (inEditor && !holder.classList.contains("cm-focused"))) return false;
    return holder
      .getAnimations()
      .every(
        (animation) => !(animation instanceof CSSTransition) || animation.playState !== "running",
      );
  });
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
    await tab(page);
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
 * document order, each with its focus ring, and focus is never lost. The
 * controls are counted once the page's code has loaded, and again after the
 * walk: a control that appeared during the walk fails it rather than going
 * unwalked. A page that builds controls after loading (the code editors)
 * waits for them before calling this.
 */
export async function expectEveryControlReached(page: Page) {
  await page.waitForLoadState("networkidle");
  const controls = await markControls(page);
  // Every control once, then the wrap back to the first.
  const stops = await walk(page, controls.length + 5);
  expect(controls.length).toBeGreaterThan(0);
  expect(stops.map((stop) => `${String(stop.index)} ${stop.name}`)).toEqual(
    controls.map((name, index) => `${String(index)} ${name}`),
  );
  expect(stops.filter((stop) => !stop.ringed).map((stop) => stop.name)).toEqual([]);
  expect(await markControls(page)).toEqual(controls);
}
