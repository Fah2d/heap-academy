import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DESIGN.md section 5: the mono stack ends in a metric-matched fallback. This
// recomputes the overrides the way next/font computes its own fallbacks
// (next/dist/compiled/@next/font/dist/local/get-fallback-metrics-from-font-file.js).

type Metrics = {
  unitsPerEm: number;
  advance: number;
  ascent: number;
  descent: number;
  lineGap: number;
};

/**
 * Measured with Next.js's fontkit from the system font files (macOS 26).
 * Menlo Bold (in Menlo.ttc) and Courier New Bold measure the same as their
 * regular faces, so one record covers both weights.
 */
const MENLO: Metrics = { unitsPerEm: 2048, advance: 1233, ascent: 1901, descent: -483, lineGap: 0 };
const COURIER_NEW: Metrics = {
  unitsPerEm: 2048,
  advance: 1229,
  ascent: 1705,
  descent: -615,
  lineGap: 0,
};

const require = createRequire(import.meta.url);
type Font = {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  lineGap: number;
  glyphsForString: (text: string) => { advanceWidth: number }[];
};
const fontkit = (
  require("next/dist/compiled/@next/font/dist/fontkit") as { default: (buffer: Buffer) => Font }
).default;

function plexMono(weight: 400 | 600): Metrics {
  const font = fontkit(
    readFileSync(join("src/ui/fonts", `ibm-plex-mono-latin-${weight}-normal.woff2`)),
  );
  // A monospace face: every glyph has the same advance.
  const advances = new Set(font.glyphsForString("aiMW0 _").map((glyph) => glyph.advanceWidth));
  expect(advances.size).toBe(1);
  return {
    unitsPerEm: font.unitsPerEm,
    advance: [...advances][0] ?? 0,
    ascent: font.ascent,
    descent: font.descent,
    lineGap: font.lineGap,
  };
}

/** As next/font writes it: a percentage with two decimals. */
const percent = (value: number) => Number(Math.abs(value * 100).toFixed(2));

/** The four overrides of a face as numbers, so `27.50%` and `27.5%` compare equal. */
function numbers(declarations: Record<string, string | undefined>): Record<string, number> {
  return Object.fromEntries(
    ["size-adjust", "ascent-override", "descent-override", "line-gap-override"].map((name) => {
      const value = declarations[name] ?? "";
      expect(value, name).toMatch(/^\d+(?:\.\d+)?%$/);
      return [name, Number.parseFloat(value)];
    }),
  );
}

function overrides(main: Metrics, fallback: Metrics) {
  const size = main.advance / main.unitsPerEm / (fallback.advance / fallback.unitsPerEm);
  return {
    "size-adjust": percent(size),
    "ascent-override": percent(main.ascent / (main.unitsPerEm * size)),
    "descent-override": percent(main.descent / (main.unitsPerEm * size)),
    "line-gap-override": percent(main.lineGap / (main.unitsPerEm * size)),
  };
}

const css = readFileSync("src/ui/tokens/font-fallbacks.css", "utf8");

function face(family: string, weight: 400 | 600): Record<string, string> {
  const blocks = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)]
    .map((match) => match[1] ?? "")
    .filter(
      (body) =>
        body.includes(`font-family: ${family};`) && body.includes(`font-weight: ${weight};`),
    );
  expect(blocks, `${family} ${weight}`).toHaveLength(1);
  const block = blocks[0];
  return Object.fromEntries(
    [...(block ?? "").matchAll(/([a-z-]+):\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2]?.trim(),
    ]),
  );
}

describe("mono fallback", () => {
  it.each([400, 600] as const)(
    "[NFR-PERF-01] scales Menlo to Plex Mono's advance and line metrics at weight %i",
    (weight) => {
      expect(numbers(face("plex-mono-fallback-menlo", weight))).toEqual(
        overrides(plexMono(weight), MENLO),
      );
    },
  );

  it.each([400, 600] as const)(
    "[NFR-PERF-01] scales Courier New, and Liberation Mono with it, the same way at weight %i",
    (weight) => {
      const courier = face("plex-mono-fallback-courier", weight);
      expect(numbers(courier)).toEqual(overrides(plexMono(weight), COURIER_NEW));
      expect(courier["src"]).toContain(
        weight === 600 ? 'local("Liberation Mono Bold")' : 'local("Liberation Mono")',
      );
    },
  );

  it("[NFR-PERF-01] draws bold code from each font's real bold, not a synthesized one", () => {
    expect(face("plex-mono-fallback-menlo", 600)["src"]).toBe(
      'local("Menlo Bold"), local("Menlo-Bold")',
    );
    expect(face("plex-mono-fallback-courier", 600)["src"]).toContain(
      'local("CourierNewPS-BoldMT")',
    );
    expect(face("plex-mono-fallback-courier", 400)["src"]).not.toContain("Bold");
  });

  it("[NFR-PERF-01] uses Courier New metrics that match Next.js's own font data", () => {
    const capsize = require("next/dist/server/capsize-font-metrics.json") as Record<
      string,
      { unitsPerEm: number; xWidthAvg: number; ascent: number; descent: number; lineGap: number }
    >;
    const { unitsPerEm, xWidthAvg, ascent, descent, lineGap } = capsize["courierNew"] ?? {
      unitsPerEm: 0,
      xWidthAvg: 0,
      ascent: 0,
      descent: 0,
      lineGap: 0,
    };
    expect({ unitsPerEm, advance: xWidthAvg, ascent, descent, lineGap }).toEqual(COURIER_NEW);
  });

  it("[NFR-PERF-01] shares one set of metrics between the two Plex Mono weights", () => {
    expect(plexMono(600)).toEqual(plexMono(400));
  });

  it("[NFR-PERF-01] puts the matched fallbacks ahead of the system monospace", () => {
    const fonts = readFileSync("src/features/shell/fonts.ts", "utf8");
    const order = ["plex-mono-fallback-menlo", "plex-mono-fallback-courier", "ui-monospace"].map(
      (name) => fonts.indexOf(`"${name}"`),
    );
    expect(order.every((position) => position > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(readFileSync("src/ui/styles.css", "utf8")).toContain(
      '@import "./tokens/font-fallbacks.css";',
    );
  });

  it("[ADR-0031] ships the @fontsource files byte for byte, so their source is locked", () => {
    for (const [family, weights] of [
      ["sans", [400, 500, 600]],
      ["mono", [400, 600]],
    ] as const) {
      for (const weight of weights) {
        const name = `ibm-plex-${family}-latin-${weight}-normal.woff2`;
        const shipped = readFileSync(join("src/ui/fonts", name));
        const source = readFileSync(
          require.resolve(`@fontsource/ibm-plex-${family}/files/${name}`),
        );
        expect(shipped.equals(source), name).toBe(true);
      }
    }
  });
});
