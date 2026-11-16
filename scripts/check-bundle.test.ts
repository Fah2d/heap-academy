import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findServerVariables,
  main,
  serverVariableNames,
  serverVariablesOf,
} from "./check-bundle.mjs";

let folder: string | undefined;

afterEach(() => {
  if (folder !== undefined) rmSync(folder, { recursive: true, force: true });
  folder = undefined;
});

function bundle(files: Record<string, string>): string {
  folder = mkdtempSync(join(tmpdir(), "bundle-"));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(folder, name, ".."), { recursive: true });
    writeFileSync(join(folder, name), content);
  }
  return folder;
}

describe("bundle secret check", () => {
  it("[T-12] takes the server variables from .env.example, leaving out the public ones", () => {
    expect(serverVariableNames(readFileSync(".env.example", "utf8"))).toEqual([
      "RESEND_API_KEY",
      "HEAP_RELEASE",
    ]);
    expect(serverVariableNames("# comment\nNEXT_PUBLIC_A=1\nB_SECRET=2\n")).toEqual(["B_SECRET"]);
  });

  it("[T-12] [NFR-SEC-04] finds a server variable's name or value in a browser file", () => {
    const root = bundle({
      "chunks/a.js": 'console.log("re_marker_value_1234")',
      "chunks/nested/b.js": "process.env.RESEND_API_KEY",
      "css/c.css": "body{}",
    });
    const findings = findServerVariables(root, ["RESEND_API_KEY"], {
      RESEND_API_KEY: "re_marker_value_1234",
    });
    expect(findings.map(({ file, what }) => [file.slice(root.length), what])).toEqual([
      ["/chunks/a.js", "the value of RESEND_API_KEY"],
      ["/chunks/nested/b.js", "the name RESEND_API_KEY"],
    ]);
  });

  it("[T-12] passes a bundle without server variables", () => {
    const root = bundle({ "chunks/a.js": 'fetch("/api/health")' });
    expect(
      findServerVariables(root, ["RESEND_API_KEY"], { RESEND_API_KEY: "re_x_1234567" }),
    ).toEqual([]);
  });

  it("[T-12] fails a folder with no file in it, which proves nothing", () => {
    const root = bundle({});
    const errors: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk: string | Uint8Array) => errors.push(String(chunk)) > 0;
    try {
      expect(main([root])).toBe(1);
    } finally {
      process.stderr.write = write;
    }
    expect(errors.join("")).toContain("nothing was checked");
  });

  function quietly(run: () => number): { code: number; errors: string } {
    const errors: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    const out = process.stdout.write.bind(process.stdout);
    process.stderr.write = (chunk: string | Uint8Array) => errors.push(String(chunk)) > 0;
    process.stdout.write = () => true;
    try {
      return { code: run(), errors: errors.join("") };
    } finally {
      process.stderr.write = write;
      process.stdout.write = out;
    }
  }

  it("[T-12] reads the server variables of a pulled environment file, leaving out public and Vercel system ones", () => {
    expect(
      serverVariablesOf(
        [
          'NEXT_PUBLIC_SUPABASE_URL="https://x.supabase.co"',
          'SUPABASE_SECRET_ONLY_IN_VERCEL="sb_secret_value_123"',
          'VERCEL_ENV="production"',
          'VERCEL_OIDC_TOKEN="eyJ.oidc.token"',
        ].join("\n"),
      ),
    ).toEqual({
      SUPABASE_SECRET_ONLY_IN_VERCEL: "sb_secret_value_123",
      VERCEL_OIDC_TOKEN: "eyJ.oidc.token",
    });
  });

  it("[T-12] with --env-file, finds a variable that is set in Vercel but missing from .env.example", () => {
    const root = bundle({ "chunks/a.js": 'const k="sb_secret_value_123"', "env/.env": "" });
    writeFileSync(join(root, "env/.env"), 'ONLY_IN_VERCEL="sb_secret_value_123"\n');
    const chunks = join(root, "chunks");
    const { code, errors } = quietly(() => main([chunks, "--env-file", join(root, "env/.env")]));
    expect(code).toBe(1);
    expect(errors).toContain("the value of ONLY_IN_VERCEL");
    expect(quietly(() => main([chunks])).code).toBe(0);
  });

  it("[T-12] refuses arguments it does not know", () => {
    const root = bundle({ "chunks/a.js": "" });
    expect(quietly(() => main([root, "--env"])).code).toBe(2);
    expect(quietly(() => main([root, "--other", "x"])).code).toBe(2);
  });
});
