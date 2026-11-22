// Words of a lesson's instructions as learners and the dashboard preview show
// them (docs/spec/04-content-system.md section 5).

export const lessonContent = {
  /** The copy control on a code block. */
  copyCode: "Copy code",
  copied: "Copied",
  copyFailed: "Could not copy. Select the code and copy it.",
  /** Read after a link's text: every link opens in a new tab. */
  opensInNewTab: "(opens in a new tab)",
  /** The accessible name of a code block. */
  codeBlock: (language: string | undefined) =>
    language === undefined ? "Code" : `Code in ${language}`,
} as const;

/** Words of the code editor (docs/spec/03-experience.md section 7.4). */
export const codeEditor = {
  /** Said by screen readers on entering the editor. */
  leaveHint: "Press Escape, then Tab, to leave the editor.",
} as const;
