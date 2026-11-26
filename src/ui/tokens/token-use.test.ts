import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Every token a utility names, as in `min-h-(--challenge-height)`, has a
// declaration inside a style rule of the token files. A custom property
// written straight inside `@media`, outside any rule, is dropped by the
// browser and the build, so the utility would read an undefined value
// (WP-5.2 code review 1, BLOCKER 1).

const tokens = fileURLToPath(new URL(".", import.meta.url));
const src = join(tokens, "..", "..");

/** Custom properties declared inside a rule (a selector or `@theme`), not straight inside an at-rule. */
function declaredInRules(css: string): Set<string> {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const declared = new Set<string>();
  const stack: boolean[] = [];
  let start = 0;
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];
    if (char === "{") {
      const prelude = text.slice(start, at).trim();
      stack.push(!prelude.startsWith("@") || prelude.startsWith("@theme"));
      start = at + 1;
    } else if (char === "}" || char === ";") {
      const statement = text.slice(start, at).trim();
      const match = /^(--[\w-]+)\s*:/.exec(statement);
      if (match?.[1] !== undefined && stack[stack.length - 1] === true) declared.add(match[1]);
      if (char === "}") stack.pop();
      start = at + 1;
    }
  }
  return declared;
}

function sources(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const css = ["primitives.css", "semantic.css", "components.css"]
  .map((file) => readFileSync(join(tokens, file), "utf8"))
  .join("\n");

describe("tokens named by utilities", () => {
  it("finds a declaration only inside a rule", () => {
    const declared = declaredInRules(":root { --a: 1; } @media (x) { :root { --b: 2; } --c: 3; }");
    expect([...declared].sort()).toEqual(["--a", "--b"]);
  });

  it("are each declared inside a rule of the token files", () => {
    const declared = declaredInRules(css);
    const used = new Set(
      sources(src).flatMap((file) =>
        [...readFileSync(file, "utf8").matchAll(/-\((--[\w-]+)\)/g)].map((match) => match[1] ?? ""),
      ),
    );
    expect(used.size).toBeGreaterThan(0);
    expect([...used].filter((name) => !declared.has(name))).toEqual([]);
  });
});

// The theme replaces Tailwind's spacing scale with named steps (`--spacing-1`
// to `--spacing-8` and a few named sizes), so a step outside it, such as
// `min-h-64`, makes no CSS at all and the element has no floor (WP-5.2).
const SIZED =
  /(?<![\w-])(?:[a-z]+:)*-?(?:min-|max-)?(?:[hw]|size|inset(?:-[xy])?|top|bottom|left|right|start|end|basis|gap(?:-[xy])?|space-[xy]|scroll-[mp][xytblrse]?|[mp][xytblrse]?|[mp][bi][se])-(\d+(?:\.\d+)?)(?![\w.-])/g;

function offScale(text: string, declared: Set<string>): string[] {
  return [...text.matchAll(SIZED)]
    .filter((match) => !declared.has(`--spacing-${match[1] ?? ""}`))
    .map((match) => match[0]);
}

describe("numeric spacing and size utilities", () => {
  it("finds a step the theme does not declare", () => {
    const declared = new Set(["--spacing-2", "--spacing-4"]);
    expect(offScale('className="p-4 md:min-h-64 w-48 gap-2 -mbs-9 h-full"', declared)).toEqual([
      "md:min-h-64",
      "w-48",
      "-mbs-9",
    ]);
  });

  it("each name a step of the theme's spacing scale", () => {
    const declared = declaredInRules(css);
    const found = sources(src).flatMap((file) =>
      offScale(readFileSync(file, "utf8"), declared).map((utility) => `${file}: ${utility}`),
    );
    expect(found).toEqual([]);
  });
});
