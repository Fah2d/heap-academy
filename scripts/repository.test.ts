import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import prettier from "prettier";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(root, path), "utf8"));

describe("TypeScript settings", () => {
  it("[NFR-MAINT-01] turns on strict mode and every extra flag of the handbook", () => {
    const configPath = join(root, "tsconfig.json");
    const { config } = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path));
    const { options } = ts.parseJsonConfigFileContent(config, ts.sys, root);
    expect(options).toMatchObject({
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      noImplicitOverride: true,
      noFallthroughCasesInSwitch: true,
      noPropertyAccessFromIndexSignature: true,
      verbatimModuleSyntax: true,
    });
  });
});

describe("lint for type escapes", () => {
  const eslint = new ESLint({
    overrideConfig: [{ files: ["**/*.{ts,tsx}"], ...tseslint.configs.disableTypeChecked }],
  });
  const ruleIds = async (code: string, path = "src/features/x/server/a.ts") => {
    const [result] = await eslint.lintText(code, { filePath: path });
    return (result?.messages ?? []).map((message) => message.ruleId);
  };

  it.each([
    ["any", "export const a = (x: any) => x;", "@typescript-eslint/no-explicit-any"],
    [
      "a non-null assertion",
      "declare const x: string | undefined; export const a = x!;",
      "@typescript-eslint/no-non-null-assertion",
    ],
    ["@ts-ignore", "// @ts-ignore\nexport const a = 1;", "@typescript-eslint/ban-ts-comment"],
    [
      "@ts-expect-error without a reason",
      "// @ts-expect-error\nexport const a: string = 1;",
      "@typescript-eslint/ban-ts-comment",
    ],
    [
      "a lint suppression without a reason",
      "// eslint-disable-next-line no-eval\neval('1');",
      "@eslint-community/eslint-comments/require-description",
    ],
  ])("[NFR-MAINT-01] fails lint for %s", async (_name, code, rule) => {
    expect(await ruleIds(code)).toContain(rule);
  });

  it("[NFR-MAINT-01] allows a non-null assertion in a test", async () => {
    const code = "declare const x: string | undefined; export const a = x!;";
    expect(await ruleIds(code, "src/features/x/server/a.test.ts")).not.toContain(
      "@typescript-eslint/no-non-null-assertion",
    );
  });
});

describe("dependencies", () => {
  it("[NFR-SEC-05] pins every direct dependency to an exact version", () => {
    const manifest = readJson("package.json") as Record<string, Record<string, string> | undefined>;
    const versions = { ...manifest["dependencies"], ...manifest["devDependencies"] };
    expect(Object.keys(versions).length).toBeGreaterThan(0);
    for (const [name, version] of Object.entries(versions)) {
      expect(version, name).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("[NFR-SEC-05] refuses install scripts that are not allowlisted and versions younger than a day", () => {
    const workspace = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
    expect(workspace).toMatch(/^strictDepBuilds: true$/m);
    expect(workspace).toMatch(/^minimumReleaseAge: 1440$/m);
    expect(workspace).toMatch(/^minimumReleaseAgeStrict: true$/m);
    expect(workspace).not.toMatch(/minimumReleaseAgeExclude/);
  });
});

describe("bundling", () => {
  // package.json "sideEffects" lets the bundler drop a module that nothing
  // uses a value from (WP-7.2: CodeMirror left the public pages that way). A
  // module whose work happens at import is then dropped too: without
  // src/domain/schema.ts's z.config, Zod probes with `new Function` and the
  // script policy reports it (NFR-SEC-02).
  it("[NFR-PERF-01] [NFR-SEC-02] keeps every module that configures Zod at import", () => {
    const manifest = readJson("package.json") as { sideEffects?: unknown };
    expect(Array.isArray(manifest.sideEffects)).toBe(true);
    const listed = manifest.sideEffects as string[];
    const configuring = readdirSync(join(root, "src"), { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) => /^z\.config\(/m.test(readFileSync(join(root, "src", file), "utf8")))
      .map((file) => `./src/${file}`);
    expect(configuring).toEqual(["./src/domain/schema.ts"]);
    for (const file of configuring) expect(listed).toContain(file);
  });
});

describe("the generated runtime folder", () => {
  // scripts/build-runtime.mjs (WP-3.1) writes Pyodide's files and the compiled
  // worker to public/_runtime. A copy left in a checkout must not break the
  // type check, lint, or format step of a branch that does not build it.
  const generated = "public/_runtime/worker/worker.js";

  it("[NFR-MAINT-01] is outside the TypeScript project", () => {
    const configPath = join(root, "tsconfig.json");
    const { config } = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path));
    const { fileNames, raw } = ts.parseJsonConfigFileContent(config, ts.sys, root);
    expect((raw as { exclude?: string[] }).exclude).toContain("public/_runtime");
    expect(fileNames.filter((name) => name.includes("/public/_runtime/"))).toEqual([]);
  });

  it("[NFR-MAINT-01] is ignored by ESLint", async () => {
    expect(await new ESLint({ cwd: root }).isPathIgnored(join(root, generated))).toBe(true);
  });

  it("[NFR-MAINT-01] is ignored by Prettier", async () => {
    const info = await prettier.getFileInfo(join(root, generated), {
      ignorePath: [join(root, ".prettierignore")],
    });
    expect(info.ignored).toBe(true);
  });
});
