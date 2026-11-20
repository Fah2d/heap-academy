import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// scripts/apply-migrations.sh with a stand-in `supabase` that records its
// arguments, so the test sees exactly what the deploy would run. Seeding is
// for staging only: a sample lesson in production would be a lesson that
// went live by mistake (T-22).

const script = join(import.meta.dirname, "apply-migrations.sh");
const STAGING_URL = "postgresql://u:p@db.stagingref.supabase.co:5432/postgres?sslmode=require";
const PRODUCTION_URL =
  "postgresql://u:p@db.productionref.supabase.co:5432/postgres?sslmode=require";
const scratch: string[] = [];
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function run(args: string[], env: Record<string, string>) {
  const bin = mkdtempSync(join(tmpdir(), "apply-migrations-"));
  scratch.push(bin);
  const log = join(bin, "args");
  writeFileSync(join(bin, "supabase"), `#!/bin/sh\nprintf '%s\\n' "$@" > "${log}"\n`);
  chmodSync(join(bin, "supabase"), 0o755);
  const inherited = { ...process.env };
  delete inherited["SEED_PROJECT_REF"];
  const result = spawnSync("sh", [script, ...args], {
    cwd: join(import.meta.dirname, ".."),
    encoding: "utf8",
    env: { ...inherited, PATH: `${bin}:${process.env["PATH"] ?? ""}`, ...env },
  });
  const called = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : undefined;
  return { status: result.status, stderr: result.stderr, called };
}

describe("apply-migrations.sh", () => {
  it("[T-22] pushes the migrations without the seed by default", () => {
    const { status, called } = run([], { SUPABASE_DB_URL: PRODUCTION_URL });
    expect(status).toBe(0);
    expect(called).toEqual(["db", "push", "--db-url", PRODUCTION_URL]);
  });

  it("[T-22] adds the seed for the staging project it names", () => {
    const { status, called } = run(["--include-seed"], {
      SUPABASE_DB_URL: STAGING_URL,
      SEED_PROJECT_REF: "stagingref",
    });
    expect(status).toBe(0);
    expect(called).toEqual(["db", "push", "--db-url", STAGING_URL, "--include-seed"]);
  });

  it("[T-22] refuses to seed a database that is not the named staging project", () => {
    const { status, stderr, called } = run(["--include-seed"], {
      SUPABASE_DB_URL: PRODUCTION_URL,
      SEED_PROJECT_REF: "stagingref",
    });
    expect(status).toBe(1);
    expect(stderr).toContain("not seeding");
    expect(called).toBeUndefined();
  });

  it("[T-22] refuses to seed when no staging project is named", () => {
    const { status, stderr, called } = run(["--include-seed"], { SUPABASE_DB_URL: STAGING_URL });
    expect(status).toBe(1);
    expect(stderr).toContain("needs SEED_PROJECT_REF");
    expect(called).toBeUndefined();
  });

  it("[T-22] refuses an unknown option before it connects", () => {
    const { status, stderr, called } = run(["--seed"], { SUPABASE_DB_URL: STAGING_URL });
    expect(status).toBe(1);
    expect(stderr).toContain("unknown option --seed");
    expect(called).toBeUndefined();
  });

  it("[T-12] refuses a connection without TLS before it connects", () => {
    const { status, called } = run([], {
      SUPABASE_DB_URL: "postgresql://u:p@db.stagingref.supabase.co/postgres",
    });
    expect(status).toBe(1);
    expect(called).toBeUndefined();
  });
});
