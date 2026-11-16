import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// Runs the real gitleaks binary with this repository's configuration, as the
// pre-commit hook does. gitleaks is required (the pre-commit hook stops
// without it), so a machine without it fails this test instead of skipping it.
const root = join(import.meta.dirname, "..");
const config = join(root, ".gitleaks.toml");

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function scan(files: Record<string, string>) {
  const directory = mkdtempSync(join(tmpdir(), "secret-scan-"));
  directories.push(directory);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(directory, path, ".."), { recursive: true });
    writeFileSync(join(directory, path), content);
  }
  const report = join(directory, "report.json");
  const result = spawnSync(
    "gitleaks",
    [
      "dir",
      ".",
      "--config",
      config,
      "--no-banner",
      "--report-format",
      "json",
      "--report-path",
      report,
    ],
    { cwd: directory, encoding: "utf8" },
  );
  if (result.error) throw result.error;
  const findings = JSON.parse(readFileSync(report, "utf8")) as Array<{ RuleID: string }>;
  return findings.map((finding) => finding.RuleID).sort();
}

// Derived from a fixed seed at run time, so the test is deterministic and no
// key-shaped value is stored in the repository.
const token = (seed: string, length: number) =>
  createHash("sha256").update(seed).digest("base64url").replace(/[-_]/g, "a").slice(0, length);

describe("secret scan configuration", () => {
  it("[NFR-SEC-04] [T-12] finds a Supabase secret key and a Resend key", () => {
    const code = `const a = "sb_secret_${token("supabase", 40)}";\nconst b = "re_${token("resend-a", 8)}_${token("resend-b", 24)}";\n`;
    expect(scan({ "src/config.ts": code })).toEqual(["resend-api-key", "supabase-secret-key"]);
  });

  it("[NFR-SEC-04] finds nothing in .env.example", () => {
    const example = join(root, ".env.example");
    expect(scan({ "example.txt": readFileSync(example, "utf8") })).toEqual([]);
  });

  it("[NFR-SEC-04] ignores a list of requirement IDs in the specification, and only there", () => {
    // Joined at run time: written out, this line would trip the scan of this file.
    const area = ["AU", "TH"].join("");
    const line = `- Covers: FR-${area}-01 to FR-${area}-06, NFR-COMPAT-02; T-11.\n`;
    expect(scan({ "docs/spec/plan.md": line })).toEqual([]);
    expect(scan({ "src/plan.ts": `// ${line}` })).toEqual(["generic-api-key"]);
  });
});
