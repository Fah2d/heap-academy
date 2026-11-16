import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Lints snippets through the repository's real configuration, as if they were
// files at the given paths. Type information is turned off because the files
// do not exist on disk; the rules under test do not need it.
const eslint = new ESLint({
  overrideConfig: [{ files: ["**/*.{ts,tsx}"], ...tseslint.configs.disableTypeChecked }],
});

async function ruleIds(path: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath: path });
  // A snippet that does not parse would make every "allows" case pass.
  const fatal = result?.messages.find((message) => message.fatal);
  if (fatal) throw new Error(`${path} did not parse: ${fatal.message}`);
  return (result?.messages ?? []).map((message) => message.ruleId ?? message.message);
}

describe("module boundaries", () => {
  const boundary = "heap/module-boundaries";

  it.each([
    ["src/domain/streak.ts", 'import { x } from "@/infrastructure/db/client";'],
    ["src/domain/streak.ts", 'import { x } from "../grader/compare";'],
    ["src/grader/compare.ts", 'import { x } from "@/runtime/protocol";'],
    ["src/ui/button.tsx", 'import { x } from "@/messages/common";'],
    ["src/runtime/controller.ts", 'import { x } from "@/content/queries";'],
    ["src/content/queries.ts", 'import { x } from "@/features/catalog";'],
    ["src/infrastructure/db/client.ts", 'import { x } from "@/content/queries";'],
    ["src/features/catalog/components/list.tsx", 'import { x } from "@/app/layout";'],
    ["src/app/page.tsx", 'import { x } from "@/infrastructure/env/schema";'],
    ["src/messages/common.ts", 'import { x } from "@/domain/ids";'],
    ["src/domain/ids.ts", 'export { x } from "@/ui/button";'],
    ["src/domain/ids.ts", 'const m = await import("@/infrastructure/db/client");'],
  ])("[NFR-MAINT-05] fails lint for a forbidden import in %s", async (path, code) => {
    expect(await ruleIds(path, code)).toContain(boundary);
  });

  it("[NFR-MAINT-05] lets a feature import another feature only through its index.ts", async () => {
    const from = "src/features/workspace/components/editor.tsx";
    expect(await ruleIds(from, 'import { x } from "@/features/progress/server/merge";')).toContain(
      boundary,
    );
    expect(await ruleIds(from, 'import { x } from "@/features/progress";')).not.toContain(boundary);
    expect(await ruleIds(from, 'import { x } from "../../progress/index";')).not.toContain(
      boundary,
    );
  });

  it("[NFR-MAINT-05] keeps client components away from infrastructure and server folders", async () => {
    const client = "src/features/workspace/components/run-button.tsx";
    expect(
      await ruleIds(client, '"use client";\nimport { x } from "@/infrastructure/env/schema";'),
    ).toContain(boundary);
    expect(await ruleIds(client, '"use client";\nimport { x } from "../server/save";')).toContain(
      boundary,
    );
    expect(await ruleIds(client, '"use client";\nimport "server-only";')).toContain(boundary);
    expect(await ruleIds(client, 'import { x } from "../server/save";')).not.toContain(boundary);
  });

  it("[NFR-MAINT-05] allows the privileged client only in the account deletion use case", async () => {
    const code = 'import { x } from "@/infrastructure/db/privileged";';
    // Each file imports server-only, so only the privileged import can be reported.
    expect(
      await ruleIds("src/features/admin/server/publish.ts", `import "server-only";\n${code}`),
    ).toContain(boundary);
    expect(
      await ruleIds("src/infrastructure/db/client.ts", `import "server-only";\n${code}`),
    ).toContain(boundary);
    expect(
      await ruleIds(
        "src/features/profile/server/delete-account-helper.ts",
        `import "server-only";\n${code}`,
      ),
    ).toContain(boundary);
    expect(
      await ruleIds(
        "src/features/profile/index.ts",
        `export { x } from "@/infrastructure/db/privileged";`,
      ),
    ).toContain(boundary);
    expect(
      await ruleIds(
        "src/features/profile/server/delete-account.ts",
        `import "server-only";\n${code}`,
      ),
    ).not.toContain(boundary);
  });

  it("[NFR-MAINT-05] treats a feature's client folder as client code without the directive", async () => {
    const hook = "src/features/workspace/client/use-save.ts";
    expect(await ruleIds(hook, 'import { x } from "@/infrastructure/db/client";')).toContain(
      boundary,
    );
    expect(await ruleIds(hook, 'import { x } from "../server/save";')).toContain(boundary);
  });

  it.each(["src/features/workspace/server/save.ts", "src/infrastructure/db/client.ts"])(
    '[NFR-MAINT-05] requires import "server-only" in %s',
    async (path) => {
      expect(await ruleIds(path, "export const a = 1;")).toContain(boundary);
      expect(await ruleIds(path, 'import "server-only";\nexport const a = 1;')).not.toContain(
        boundary,
      );
    },
  );

  it("[NFR-MAINT-05] finds src from the rule's own location, whatever the working directory", async () => {
    const elsewhere = new ESLint({
      cwd: join(import.meta.dirname, "../../src"),
      overrideConfigFile: join(import.meta.dirname, "../../eslint.config.mjs"),
      overrideConfig: [{ files: ["**/*.{ts,tsx}"], ...tseslint.configs.disableTypeChecked }],
    });
    const [result] = await elsewhere.lintText('import { x } from "@/infrastructure/db/client";', {
      filePath: join(import.meta.dirname, "../../src/domain/streak.ts"),
    });
    expect(result?.messages.map((message) => message.ruleId)).toContain(boundary);
  });

  it.each([
    ['import { useState } from "react";'],
    ['import { cookies } from "next/headers";'],
    ['import { createClient } from "@supabase/supabase-js";'],
    ['import { readFileSync } from "node:fs";'],
    ['import "server-only";'],
  ])("[NFR-MAINT-05] keeps src/domain free of framework and I/O imports: %s", async (code) => {
    expect(await ruleIds("src/domain/streak.ts", code)).toContain(boundary);
    expect(await ruleIds("src/grader/compare.ts", code)).toContain(boundary);
  });

  it.each([
    [
      "src/features/workspace/server/run.ts",
      'import "server-only";\nimport { x } from "@/runtime/controller";',
    ],
    [
      "src/features/workspace/server/run.ts",
      'import "server-only";\nimport { x } from "../../../grader/compare";',
    ],
    ["src/runtime/controller.ts", 'import { x } from "@/grader/compare";'],
    ["src/content/queries.ts", 'import { x } from "@/infrastructure/db/public";'],
    ["src/infrastructure/db/client.ts", 'import "server-only";\nimport { x } from "@/domain/ids";'],
    ["src/app/page.tsx", 'import { x } from "@/features/catalog";'],
    ["src/app/layout.tsx", 'import "@/ui/tokens.css";'],
    ["src/instrumentation.ts", 'import { x } from "@/infrastructure/env/schema";'],
    ["src/domain/streak.ts", 'import { x } from "./ids";'],
    ["src/domain/streak.ts", 'import { z } from "zod";'],
  ])("[NFR-MAINT-05] allows a permitted import in %s", async (path, code) => {
    expect(await ruleIds(path, code)).not.toContain(boundary);
  });

  it.each([
    ["Date.now()", "const t = Date.now();"],
    ["new Date()", "const t = new Date();"],
    ["Math.random()", "const r = Math.random();"],
    ["fetch", 'void fetch("/x");'],
    ["globalThis.fetch", 'void globalThis.fetch("/x");'],
    ["setTimeout", "setTimeout(() => undefined, 1);"],
    ["structuredClone", "const c = structuredClone({});"],
  ])(
    "[NFR-MAINT-05] keeps time, randomness, and I/O out of src/domain: %s",
    async (_name, code) => {
      const ids = await ruleIds("src/domain/streak.ts", code);
      expect(
        ids.some((id) => id === "no-restricted-syntax" || id === "no-restricted-globals"),
      ).toBe(true);
    },
  );
});

describe("no raw HTML", () => {
  it.each([
    [
      "src/features/x/components/a.tsx",
      "export const A = () => <div dangerouslySetInnerHTML={{ __html: s }} />;",
    ],
    ["src/features/x/client/b.ts", "element.innerHTML = s;"],
    ["src/features/x/client/b.ts", "element.outerHTML = s;"],
    ["src/features/x/client/b.ts", 'element.insertAdjacentHTML("beforeend", s);'],
    ["src/features/x/client/b.ts", "document.write(s);"],
    ["src/domain/c.ts", "element.innerHTML = s;"],
  ])("[T-06] fails lint for a raw HTML sink in %s", async (path, code) => {
    const ids = await ruleIds(
      path,
      `declare const s: string; declare const element: HTMLElement;\n${code}`,
    );
    expect(ids).toContain("no-restricted-syntax");
  });

  it("[T-06] allows setting text content", async () => {
    const ids = await ruleIds(
      "src/features/x/client/b.ts",
      "declare const element: HTMLElement; element.textContent = 'safe';",
    );
    expect(ids).not.toContain("no-restricted-syntax");
  });
});

describe("no inline strings", () => {
  const rule = "heap/no-inline-strings";
  const file = "src/features/catalog/components/list.tsx";

  it.each([
    ["text", "export const A = () => <p>Start the lesson</p>;"],
    ["expression", 'export const A = () => <p>{"Start"}</p>;'],
    ["template", "export const A = () => <p>{`Start`}</p>;"],
    ["aria-label", 'export const A = () => <button aria-label="Close" />;'],
    ["alt", 'export const A = () => <img alt="Logo" src="/a.png" />;'],
    ["placeholder", 'export const A = () => <input placeholder="Email" />;'],
    ["title", 'export const A = () => <abbr title="Experience points" />;'],
    [
      "a ternary",
      'export const A = ({ ok }: { ok: boolean }) => <p>{ok ? "Passed" : "Failed"}</p>;',
    ],
    ["a fallback", 'export const A = ({ n }: { n?: string }) => <p>{n ?? "Guest"}</p>;'],
    ["a joined string", 'export const A = ({ n }: { n: number }) => <p>{n + " passed"}</p>;'],
    [
      "an attribute ternary",
      'export const A = ({ ok }: { ok: boolean }) => <img alt={ok ? "Open" : "Closed"} src="/a.png" />;',
    ],
    [
      "a component prop",
      'declare const Notice: (p: { heading: string }) => null;\nexport const A = () => <Notice heading="Saved" />;',
    ],
    [
      "a component prop with spaces",
      'declare const Notice: (p: { heading: string }) => null;\nexport const A = () => <Notice heading="try again" />;',
    ],
  ])("[NFR-I18N-01] fails lint for inline %s", async (_name, code) => {
    expect(await ruleIds(file, code)).toContain(rule);
  });

  it.each([
    ["src/app/page.tsx", 'export const metadata = { title: "Heap Academy" };'],
    [
      "src/app/layout.tsx",
      'export const metadata = { openGraph: { description: "Learn Python" } };',
    ],
    [
      "src/app/courses/page.tsx",
      'export function generateMetadata() { return { title: "Courses" }; }',
    ],
    ["src/app/sitemap.ts", 'export const metadata = { keywords: ["python"] };'],
  ])("[NFR-I18N-01] fails lint for inline page metadata in %s", async (path, code) => {
    expect(await ruleIds(path, code)).toContain(rule);
  });

  it.each([
    [
      "a message",
      'import { m } from "@/messages/catalog";\nexport const A = () => <p>{m.start}</p>;',
    ],
    ["a class name", 'export const A = () => <p className="text-start" />;'],
    ["a separator", "export const A = () => <span>·</span>;"],
    ["whitespace", "export const A = () => <p> </p>;"],
    [
      "a setting prop",
      'declare const Button: (p: { variant: string; tone: string }) => null;\nexport const A = () => <Button variant="primary" tone="quiet" />;',
    ],
    [
      "an identifier-like prop",
      'declare const Icon: (p: { glyph: string }) => null;\nexport const A = () => <Icon glyph="check" />;',
    ],
    [
      "metadata from messages",
      'import { m } from "@/messages/home";\nexport const metadata = { title: m.title, alternates: { canonical: "/" } };',
    ],
  ])("[NFR-I18N-01] allows %s", async (_name, code) => {
    expect(await ruleIds(file, code)).not.toContain(rule);
  });
});

describe("logical properties", () => {
  const rule = "heap/logical-properties";
  const file = "src/ui/panel.tsx";

  it.each([
    'export const A = () => <div className="ml-4" />;',
    'export const A = () => <div className="md:hover:pr-2 flex" />;',
    'export const A = () => <div className="-left-3" />;',
    'export const A = () => <div className="text-right" />;',
    'export const A = () => <div className="rounded-tl-lg" />;',
    'export const A = () => <div className="border-l-2" />;',
    'export const A = () => <div className={cn("p-2", active && "mr-1")} />;',
    "export const A = () => <div className={`gap-2 ${x} pl-3`} />;",
    "export const A = () => <div style={{ marginLeft: 4 }} />;",
    'export const A = () => <div style={{ textAlign: "left" }} />;',
  ])("[NFR-I18N-02] fails lint for a physical property: %s", async (code) => {
    expect(
      await ruleIds(
        file,
        `declare const cn: (...a: unknown[]) => string; declare const active: boolean; declare const x: string;\n${code}`,
      ),
    ).toContain(rule);
  });

  it.each([
    'export const A = () => <div className="ms-4 pe-2 start-0 text-start rounded-s-lg border-s-2" />;',
    'export const A = () => <div className="mx-4 px-2 inset-x-0 text-center" />;',
    "export const A = () => <div style={{ marginInlineStart: 4 }} />;",
  ])("[NFR-I18N-02] allows logical and symmetric properties: %s", async (code) => {
    expect(await ruleIds(file, code)).not.toContain(rule);
  });

  it("[NFR-I18N-02] fails lint for physical classes kept in a variable in a primitive", async () => {
    expect(
      await ruleIds("src/ui/variants.ts", 'export const button = "ml-4 text-left";'),
    ).toContain(rule);
    expect(
      await ruleIds("src/ui/variants.ts", 'export const button = "ms-4 text-start";'),
    ).not.toContain(rule);
  });

  it.each([
    ".panel { margin-left: 4px; }",
    ".panel { padding-right: 4px; }",
    ".panel { left: 0; }",
  ])("[NFR-I18N-02] fails lint for an inline-axis side in a stylesheet: %s", async (css) => {
    expect(await ruleIds("src/ui/tokens/sample.css", css)).toContain(
      "css/prefer-logical-properties",
    );
  });

  it.each([
    ".panel { margin-inline-start: 4px; }",
    ".panel { margin-top: 4px; inset-block-start: 0; }",
    ".panel { width: 100%; min-height: 100dvh; }",
  ])(
    "[NFR-I18N-02] allows block-axis sides and sizes in a stylesheet, as in classes: %s",
    async (css) => {
      expect(await ruleIds("src/ui/tokens/sample.css", css)).toEqual([]);
    },
  );
});

describe("no raw values", () => {
  const rule = "heap/no-raw-values";
  const cssRule = "heap/no-raw-css-values";
  const component = "src/features/catalog/components/course-row.tsx";

  it.each([
    'export const A = () => <div className="p-[13px]" />;',
    'export const A = () => <div className="md:hover:bg-[#fff]" />;',
    'export const A = () => <div className="rounded-[6px] flex" />;',
    'export const A = () => <div className="text-[rgb(0_0_0)]" />;',
    'export const A = () => <div className="[mask-type:luminance]" />;',
    'export const A = () => <div className={cn("p-2", active && "gap-[3px]")} />;',
    "export const A = () => <div style={{ padding: 12 }} />;",
    'export const A = () => <div style={{ color: "#fff" }} />;',
    'export const A = () => <div style={{ borderRadius: "4px" }} />;',
    'export const A = () => <div style={{ boxShadow: "0 1px 2px rgb(0 0 0 / 0.5)" }} />;',
  ])("[ADR-0015] fails lint for a raw value in a component: %s", async (code) => {
    expect(
      await ruleIds(
        component,
        `declare const cn: (...a: unknown[]) => string; declare const active: boolean;\n${code}`,
      ),
    ).toContain(rule);
  });

  it.each([
    'export const A = () => <div className="p-4 bg-surface rounded-control text-text-muted" />;',
    'export const A = () => <div className="data-[state=open]:p-2 group-data-[x]:gap-1" />;',
    'export const A = () => <div className="duration-(--motion-base) min-h-target" />;',
    'export const A = () => <div style={{ padding: "var(--space-4)", flexGrow: 1 }} />;',
    "export const A = () => <div style={{ margin: 0 }} />;",
  ])("[ADR-0015] allows token utilities and token references: %s", async (code) => {
    expect(await ruleIds(component, code)).not.toContain(rule);
  });

  it("[ADR-0015] fails lint for raw classes kept in a variable in a primitive", async () => {
    expect(await ruleIds("src/ui/variants.ts", 'export const b = "px-[10px]";')).toContain(rule);
    expect(await ruleIds("src/ui/variants.ts", 'export const b = "px-4";')).not.toContain(rule);
  });

  it.each([
    ".panel { color: #fff; }",
    ".panel { background: rgb(0 0 0 / 0.5); }",
    ".panel { padding: 12px; }",
    ".panel { border-radius: 0.25rem; }",
    ".panel { font-size: 13px; }",
    ".panel { box-shadow: 0 8px 24px black; }",
    ".panel { --local-gap: 4px; }",
  ])("[ADR-0015] fails lint for a raw value in a stylesheet: %s", async (css) => {
    expect(await ruleIds("src/ui/base.css", css)).toContain(cssRule);
  });

  it.each([
    ".panel { color: var(--color-text); padding: var(--space-4); }",
    ".panel { outline: 2px solid var(--color-focus); outline-offset: 2px; }",
    ".panel { margin: 0; min-block-size: 100dvh; font-size: 100%; }",
  ])("[ADR-0015] allows tokens, hairlines, and proportions in a stylesheet: %s", async (css) => {
    expect(await ruleIds("src/ui/base.css", css)).not.toContain(cssRule);
  });

  it("[ADR-0015] allows raw values only in the token files", async () => {
    expect(await ruleIds("src/ui/tokens/primitives.css", ":root { --gray-950: #0e0e10; }")).toEqual(
      [],
    );
  });
});
