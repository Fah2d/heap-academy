// The workspace below 768 px (docs/spec/03-experience.md section 6.8;
// FR-WSP-13): whether the screen is that narrow, and how far the on-screen
// keyboard reaches up the layout viewport, so the action bar sits above it.

/** The same width as the styles' `md` step (48 rem, 768 px), not a second number. */
export const NARROW_QUERY = "(width < 48rem)";

type MediaScope = {
  matchMedia: (query: string) => {
    matches: boolean;
    addEventListener: (type: "change", listener: () => void) => void;
    removeEventListener: (type: "change", listener: () => void) => void;
  };
};

/** For `useSyncExternalStore`: is the screen narrower than 768 px now? */
export function narrowScreen(scope: MediaScope) {
  return {
    subscribe(onChange: () => void) {
      const query = scope.matchMedia(NARROW_QUERY);
      query.addEventListener("change", onChange);
      return () => {
        query.removeEventListener("change", onChange);
      };
    },
    snapshot: () => scope.matchMedia(NARROW_QUERY).matches,
  };
}

/** The parts of `window.visualViewport` the inset is worked out from. */
export type VisualViewportSize = { height: number; offsetTop: number };

/**
 * How many CSS pixels at the bottom of the layout viewport the visual
 * viewport does not show: the on-screen keyboard on iOS Safari, which keeps
 * the layout viewport's height and shrinks the visual one. Where the browser
 * resizes the layout viewport instead (Chrome on Android), the two match and
 * the inset is 0. Never negative, and whole pixels, so a scroll by a fraction
 * does not restyle the bar.
 */
export function keyboardInset(
  layoutHeight: number,
  visual: VisualViewportSize | null | undefined,
): number {
  if (visual === null || visual === undefined) return 0;
  return Math.max(0, Math.round(layoutHeight - visual.height - visual.offsetTop));
}

/** The three views below 768 px, in their order on the tab list. */
export const PHONE_VIEWS = ["lesson", "code", "output"] as const;
export type PhoneView = (typeof PHONE_VIEWS)[number];

/**
 * The view an arrow, Home or End key moves to on the tab list (the WAI-ARIA
 * tabs pattern), or undefined for any other key. The arrows wrap around and
 * follow the reading direction.
 */
export function viewAfterKey(
  current: PhoneView,
  key: string,
  direction: "ltr" | "rtl",
): PhoneView | undefined {
  const index = PHONE_VIEWS.indexOf(current);
  const last = PHONE_VIEWS.length - 1;
  const forward = direction === "ltr" ? "ArrowRight" : "ArrowLeft";
  const back = direction === "ltr" ? "ArrowLeft" : "ArrowRight";
  switch (key) {
    case forward:
      return PHONE_VIEWS[index === last ? 0 : index + 1];
    case back:
      return PHONE_VIEWS[index === 0 ? last : index - 1];
    case "Home":
      return PHONE_VIEWS[0];
    case "End":
      return PHONE_VIEWS[last];
    default:
      return undefined;
  }
}
