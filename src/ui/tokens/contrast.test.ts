import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every token pair in use, measured from the token files themselves with the
// WCAG 2 formula, so a changed value that breaks contrast fails here
// (NFR-A11Y-07, DESIGN.md sections 4.3 and 4.4).

const css = ["primitives.css", "semantic.css", "components.css"]
  .map((file) => readFileSync(new URL(`./${file}`, import.meta.url), "utf8"))
  .join("\n");

const declarations = new Map<string, string>();
for (const match of css.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
  const [, name, value] = match;
  // The first declaration wins: the media-query override of --text-code is not a color.
  if (name !== undefined && value !== undefined && !declarations.has(name)) {
    declarations.set(name, value.trim());
  }
}

function resolve(token: string): string {
  const value = declarations.get(token);
  if (value === undefined) throw new Error(`${token} is not declared`);
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  return reference?.[1] !== undefined ? resolve(reference[1]) : value;
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (match?.[1] === undefined) throw new Error(`${hex} is not a six-digit hex color`);
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(match[1]?.slice(offset, offset + 2) ?? "", 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(resolve(foreground)), luminance(resolve(background))].sort(
    (a, b) => b - a,
  );
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

const TEXT = 4.5;
const NON_TEXT = 3;

const surfaces = [
  "--color-bg",
  "--color-surface-editor",
  "--color-surface",
  "--color-surface-raised",
  "--color-surface-hover",
  "--color-selection",
];

// Text pairs from DESIGN.md section 4.3. Subtle text appears only on the
// first three surfaces (placeholder text and line numbers).
const textPairs: Array<[string, string]> = [
  ...[
    "--color-text",
    "--color-text-muted",
    "--color-action",
    "--color-pass",
    "--color-fail",
  ].flatMap((text) => surfaces.map((surface): [string, string] => [text, surface])),
  ["--color-text-subtle", "--color-bg"],
  ["--color-text-subtle", "--color-surface-editor"],
  ["--color-text-subtle", "--color-surface"],
  ["--color-on-action", "--color-action"],
  ["--color-on-action", "--color-action-hover"],
  ["--color-on-action", "--color-action-press"],
  // Syntax colors on the editor and on a selection inside it (section 4.4).
  ...[
    "--syntax-text",
    "--syntax-keyword",
    "--syntax-string",
    "--syntax-number",
    "--syntax-function",
    "--syntax-builtin",
    "--syntax-comment",
    "--syntax-error",
  ].flatMap((syntax): Array<[string, string]> => [
    [syntax, "--color-surface-editor"],
    [syntax, "--editor-selection"],
  ]),
];

const nonTextPairs: Array<[string, string]> = [
  ["--color-border-control", "--color-bg"],
  ["--color-border-control", "--color-surface-editor"],
  ["--color-border-control", "--color-surface"],
  ["--color-border-control", "--color-surface-raised"],
  ["--color-text-muted", "--color-bg"],
  ...[
    "--color-bg",
    "--color-surface",
    "--color-surface-raised",
    "--color-surface-hover",
    "--color-surface-editor",
    "--color-selection-editor",
  ].map((surface): [string, string] => ["--color-focus", surface]),
  ["--color-action", "--color-surface-hover"],
  ["--editor-bracket-match", "--color-surface-editor"],
  ["--editor-bracket-match", "--editor-selection"],
  ["--color-fail", "--color-bg"],
];

describe("token contrast", () => {
  it.each(textPairs)("[NFR-A11Y-07] text %s on %s meets 4.5 to 1", (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(TEXT);
  });

  it.each(nonTextPairs)(
    "[NFR-A11Y-07] boundary %s against %s meets 3 to 1",
    (foreground, background) => {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(NON_TEXT);
    },
  );

  it("[NFR-A11Y-07] measures the values DESIGN.md records", () => {
    expect(contrast("--color-text", "--color-bg").toFixed(2)).toBe("16.94");
    expect(contrast("--color-on-action", "--color-action-press").toFixed(2)).toBe("6.08");
    expect(contrast("--syntax-comment", "--editor-selection").toFixed(2)).toBe("4.51");
  });
});
