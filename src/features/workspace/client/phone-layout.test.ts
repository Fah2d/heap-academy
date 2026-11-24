import { describe, expect, it, vi } from "vitest";
import { keyboardInset, NARROW_QUERY, narrowScreen } from "./phone-layout";

describe("[FR-WSP-13] the narrow screen", () => {
  it("asks for the styles' md step, 48 rem", () => {
    expect(NARROW_QUERY).toBe("(width < 48rem)");
  });

  it("reads the query now, and listens for changes until unsubscribed", () => {
    const add = vi.fn();
    const remove = vi.fn();
    const matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: add,
      removeEventListener: remove,
    }));
    const screen = narrowScreen({ matchMedia });
    expect(screen.snapshot()).toBe(true);
    const onChange = () => undefined;
    const stop = screen.subscribe(onChange);
    expect(add).toHaveBeenCalledWith("change", onChange);
    stop();
    expect(remove).toHaveBeenCalledWith("change", onChange);
    expect(matchMedia).toHaveBeenCalledWith(NARROW_QUERY);
  });
});

describe("[FR-WSP-13] the action bar above the on-screen keyboard", () => {
  it("is 0 with no visual viewport", () => {
    expect(keyboardInset(800, undefined)).toBe(0);
    expect(keyboardInset(800, null)).toBe(0);
  });

  it("is 0 when the visual viewport fills the layout viewport", () => {
    expect(keyboardInset(800, { height: 800, offsetTop: 0 })).toBe(0);
  });

  it("is the height the keyboard covers (iOS Safari keeps the layout height)", () => {
    expect(keyboardInset(800, { height: 460, offsetTop: 0 })).toBe(340);
  });

  it("counts a visual viewport scrolled down inside the layout viewport", () => {
    expect(keyboardInset(800, { height: 460, offsetTop: 100 })).toBe(240);
  });

  it("is never negative, and in whole pixels", () => {
    expect(keyboardInset(800, { height: 820, offsetTop: 0 })).toBe(0);
    expect(keyboardInset(800, { height: 459.6, offsetTop: 0 })).toBe(340);
  });
});
