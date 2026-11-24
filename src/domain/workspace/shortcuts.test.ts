import { describe, expect, it } from "vitest";
import { ariaKeyShortcuts, type KeyPress, workspaceShortcut } from "./shortcuts";

// Run is Ctrl or Cmd + Enter; Check adds Shift (FR-WSP-12,
// docs/spec/03-experience.md section 6.2).

const press = (overrides: Partial<KeyPress>): KeyPress => ({
  key: "Enter",
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  repeat: false,
  isComposing: false,
  ...overrides,
});

describe("workspaceShortcut [FR-WSP-12]", () => {
  it("runs with Ctrl + Enter and checks with Ctrl + Shift + Enter on Windows and Linux", () => {
    expect(workspaceShortcut(press({ ctrlKey: true }), false)).toBe("run");
    expect(workspaceShortcut(press({ ctrlKey: true, shiftKey: true }), false)).toBe("check");
  });

  it("runs with Cmd + Enter and checks with Cmd + Shift + Enter on Apple systems", () => {
    expect(workspaceShortcut(press({ metaKey: true }), true)).toBe("run");
    expect(workspaceShortcut(press({ metaKey: true, shiftKey: true }), true)).toBe("check");
  });

  it("also takes Ctrl on Apple systems, where Ctrl + Enter is no browser key", () => {
    expect(workspaceShortcut(press({ ctrlKey: true }), true)).toBe("run");
  });

  it("ignores the system key on Windows and Linux, which the system keeps for itself", () => {
    expect(workspaceShortcut(press({ metaKey: true }), false)).toBeUndefined();
    expect(workspaceShortcut(press({ ctrlKey: true, metaKey: true }), false)).toBeUndefined();
  });

  it("ignores Enter alone, Shift + Enter, Alt, other keys, held keys and text being composed", () => {
    expect(workspaceShortcut(press({}), false)).toBeUndefined();
    expect(workspaceShortcut(press({ shiftKey: true }), true)).toBeUndefined();
    expect(workspaceShortcut(press({ ctrlKey: true, altKey: true }), false)).toBeUndefined();
    expect(workspaceShortcut(press({ ctrlKey: true, key: "s" }), false)).toBeUndefined();
    expect(workspaceShortcut(press({ ctrlKey: true, repeat: true }), false)).toBeUndefined();
    expect(workspaceShortcut(press({ metaKey: true, isComposing: true }), true)).toBeUndefined();
  });
});

describe("ariaKeyShortcuts [FR-WSP-12]", () => {
  it("names the keys in the form aria-keyshortcuts takes", () => {
    expect(ariaKeyShortcuts("run", false)).toBe("Control+Enter");
    expect(ariaKeyShortcuts("check", false)).toBe("Control+Shift+Enter");
    expect(ariaKeyShortcuts("run", true)).toBe("Meta+Enter Control+Enter");
    expect(ariaKeyShortcuts("check", true)).toBe("Meta+Shift+Enter Control+Shift+Enter");
  });
});
