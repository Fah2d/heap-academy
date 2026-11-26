// The workspace's keyboard shortcuts (FR-WSP-12, docs/spec/03-experience.md
// section 6.2): Run is Ctrl or Cmd + Enter, Check adds Shift. On Windows and
// Linux the system key is left alone, because the system takes it. A held
// key does not run the program again, and Enter that ends text being
// composed (an input method) is not a shortcut.

export type ShortcutAction = "run" | "check";

/** The parts of a keyboard event the shortcuts read. */
export type KeyPress = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  repeat: boolean;
  isComposing: boolean;
};

export function workspaceShortcut(press: KeyPress, apple: boolean): ShortcutAction | undefined {
  if (press.key !== "Enter" || press.altKey || press.repeat || press.isComposing) return undefined;
  const primary = apple ? press.metaKey || press.ctrlKey : press.ctrlKey && !press.metaKey;
  if (!primary) return undefined;
  return press.shiftKey ? "check" : "run";
}

/** The value of `aria-keyshortcuts` for an action's button. */
export function ariaKeyShortcuts(action: ShortcutAction, apple: boolean): string {
  const keys = action === "check" ? "Shift+Enter" : "Enter";
  return apple ? `Meta+${keys} Control+${keys}` : `Control+${keys}`;
}
