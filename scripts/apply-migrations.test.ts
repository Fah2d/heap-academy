import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// scripts/apply-migrations.sh with a stand-in `supabase` that records its
// arguments, so the test sees exactly what the deploy would run.

const script = join(import.meta.dirname, "apply-migrations.sh");
const scratch: string[] = [];
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function run(
  args: string[],
  url = "postgresql://u:p@db.example.test:5432/postgres?sslmode=require",
) {
  const bin = mkdtempSync(join(tmpdir(), "apply-migrations-"));
  scratch.push(bin);
  const log = join(bin, "args");
  writeFileSync(join(bin, "supabase"), `#!/bin/sh\nprintf '%s\\n' "$@" > "${log}"\n`);
  chmodSync(join(bin, "supabase"), 0o755);
  const result = spawnSync("sh", [script, ...args], {
    cwd: join(import.meta.dirname, ".."),
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env["PATH"] ?? ""}`, SUPABASE_DB_URL: url },
  });
  let called: string[] | undefined;
  try {
    called = readFileSync(log, "utf8").trim().split("\n");
  } catch {
    called = undefined;
  }
  return { status: result.status, stderr: result.stderr, called };
}

describe("apply-migrations.sh", () => {
  it("[NFR-SEC-03] pushes the migrations without the seed by default", () => {
    const { status, called } = run([]);
    expect(status).toBe(0);
    expect(called).toEqual([
      "db",
      "push",
      "--db-url",
      "postgresql://u:p@db.example.test:5432/postgres?sslmode=require",
    ]);
  });

  it("[NFR-SEC-03] adds the seed only when asked", () => {
    const { status, called } = run(["--include-seed"]);
    expect(status).toBe(0);
    expect(called?.at(-1)).toBe("--include-seed");
  });

  it("[NFR-SEC-03] refuses an unknown option before it connects", () => {
    const { status, stderr, called } = run(["--seed"]);
    expect(status).toBe(1);
    expect(stderr).toContain("unknown option --seed");
    expect(called).toBeUndefined();
  });

  it("[NFR-SEC-03] refuses a connection without TLS before it connects", () => {
    const { status, called } = run(["--include-seed"], "postgresql://u:p@db.example.test/postgres");
    expect(status).toBe(1);
    expect(called).toBeUndefined();
  });
});
