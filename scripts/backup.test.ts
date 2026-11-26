import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// scripts/backup.sh (ADR-0030), run by bash with fake `pg_dump` and `age` on
// the PATH: the fakes record what they were given, so the tests see what the
// script hands each tool and what it prints.

const SCRIPT = join(process.cwd(), "scripts", "backup.sh");
// Shaped like an age public key (the 58 characters of its alphabet); the fake
// age takes any. Plainly not a key, like the password marker.
const KEY = `age1${"q".repeat(58)}`;
const PASSWORD = "the-password-marker";
const HOST = "aws-0-eu-central-1.pooler.example.test";
const USER = "backup_reader.projectref";

let dir: string;

/** A fake tool: a bash script. */
function tool(name: string, body: string) {
  const path = join(dir, "bin", name);
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path, 0o755);
}

function run(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync("bash", [SCRIPT, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: {
      NODE_ENV: "test",
      PATH: `${join(dir, "bin")}:/usr/bin:/bin`,
      BACKUP_AGE_RECIPIENT: KEY,
      BACKUP_DB_HOST: HOST,
      BACKUP_DB_USER: USER,
      BACKUP_DB_PASSWORD: PASSWORD,
      ...env,
    },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "backup-test-"));
  spawnSync("mkdir", ["-p", join(dir, "bin"), join(dir, "ops")]);
  writeFileSync(join(dir, "ops", "backup-recipient.age.pub"), `${KEY}\n`);
  // pg_dump: records its arguments and environment, then prints rows, or
  // fails the way a refused login does, naming the host and the user.
  tool(
    "pg_dump",
    `printf '%s\\n' "$@" > "${"$"}{FAKE_DIR}/pg_dump.args"
env > "${"$"}{FAKE_DIR}/pg_dump.env"
if [[ -n "${"$"}{FAKE_FAIL:-}" ]]; then
  echo "pg_dump: error: connection to server at \\"$PGHOST\\", port 5432 failed: FATAL: password authentication failed for user \\"$PGUSER\\" ($PGPASSWORD)" >&2
  exit 1
fi
echo "COPY public.courses (id) FROM stdin;"`,
  );
  // age: writes a header and its input to --output, unless told to break.
  tool(
    "age",
    `printf '%s\\n' "$@" > "${"$"}{FAKE_DIR}/age.args"
out=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--output" ]]; then out="$2"; shift; fi
  shift
done
if [[ -n "${"$"}{FAKE_PLAIN:-}" ]]; then cat > "$out"; exit 0; fi
{ echo "age-encryption.org/v1"; cat; } > "$out"`,
  );
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const fake = () => ({ FAKE_DIR: dir });

describe("backup.sh recipient", () => {
  it("[T-24] prints the committed key when the environment's copy matches", () => {
    expect(run(["recipient"], fake())).toEqual({ status: 0, output: `${KEY}\n` });
  });

  it("[T-24] fails when the environment's copy differs from the committed key", () => {
    const other = `age1${"z".repeat(58)}`;
    const result = run(["recipient"], { ...fake(), BACKUP_AGE_RECIPIENT: other });
    expect(result.status).toBe(1);
    expect(result.output).toContain("differs from the production-backup environment's");
  });

  it("[T-24] fails when no key is committed, or the committed one is not an age key", () => {
    rmSync(join(dir, "ops", "backup-recipient.age.pub"));
    expect(run(["recipient"], fake()).status).toBe(1);
    writeFileSync(join(dir, "ops", "backup-recipient.age.pub"), "ssh-ed25519 AAAA\n");
    expect(run(["recipient"], fake()).output).toContain("is not an age public key");
  });
});

describe("backup.sh dump", () => {
  it("[NFR-REL-05] [T-24] writes only age ciphertext, encrypted to the committed key, of the three schemas' data", () => {
    const result = run(["dump", "backup.age"], fake());
    expect(result.status).toBe(0);
    expect(readFileSync(join(dir, "backup.age"), "utf8")).toMatch(/^age-encryption\.org\/v1\n/);
    expect(readFileSync(join(dir, "age.args"), "utf8").split("\n")).toEqual([
      "--encrypt",
      "--recipient",
      KEY,
      "--output",
      "backup.age",
      "",
    ]);
    const args = readFileSync(join(dir, "pg_dump.args"), "utf8").split("\n");
    expect(args).toEqual(
      expect.arrayContaining([
        "--data-only",
        "--schema=public",
        "--schema=private",
        "--schema=auth",
        "--exclude-table-data=auth.schema_migrations",
      ]),
    );
  });

  it("[T-12] [T-24] leaves out what a restore must not bring back: sessions, tokens, codes, challenges and the audit log", () => {
    run(["dump", "backup.age"], fake());
    const args = readFileSync(join(dir, "pg_dump.args"), "utf8").split("\n");
    expect(args).toEqual(
      expect.arrayContaining(
        [
          "sessions",
          "refresh_tokens",
          "mfa_amr_claims",
          "mfa_challenges",
          "one_time_tokens",
          "flow_state",
          "saml_relay_states",
          "audit_log_entries",
        ].map((table) => `--exclude-table-data=auth.${table}`),
      ),
    );
    const env = readFileSync(join(dir, "pg_dump.env"), "utf8");
    expect(env).toContain(`PGUSER=${USER}`);
    expect(env).toContain("PGSSLMODE=require");
  });

  it("[T-12] [T-24] a refused login prints no password, host or user, and leaves no file", () => {
    const result = run(["dump", "backup.age"], { ...fake(), FAKE_FAIL: "1" });
    expect(result.status).toBe(1);
    expect(result.output).toContain("the dump failed");
    for (const secret of [PASSWORD, HOST, USER]) expect(result.output).not.toContain(secret);
    expect(existsSync(join(dir, "backup.age"))).toBe(false);
  });

  it("[T-12] hands the password to pg_dump only in its environment, never as an argument", () => {
    run(["dump", "backup.age"], fake());
    expect(readFileSync(join(dir, "pg_dump.args"), "utf8")).not.toContain(PASSWORD);
    expect(readFileSync(join(dir, "pg_dump.env"), "utf8")).toContain(`PGPASSWORD=${PASSWORD}`);
  });

  it("[T-24] prints no add-mask line: the host, the user and the password are secrets the runner hides", () => {
    const result = run(["dump", "backup.age"], { ...fake(), GITHUB_ACTIONS: "true" });
    expect(result.status).toBe(0);
    expect(result.output).not.toContain("::add-mask::");
    for (const secret of [PASSWORD, HOST, USER]) expect(result.output).not.toContain(secret);
  });

  it("[T-24] fails, and removes the file, when the output is not age ciphertext", () => {
    const result = run(["dump", "backup.age"], { ...fake(), FAKE_PLAIN: "1" });
    expect(result.status).toBe(1);
    expect(result.output).toContain("is not age ciphertext");
    expect(existsSync(join(dir, "backup.age"))).toBe(false);
  });

  it("[T-24] refuses to run without the connection's parts, or over an existing file", () => {
    expect(run(["dump", "backup.age"], { ...fake(), BACKUP_DB_PASSWORD: "" }).output).toContain(
      "BACKUP_DB_PASSWORD is not set",
    );
    writeFileSync(join(dir, "backup.age"), "old");
    expect(run(["dump", "backup.age"], fake()).output).toContain("already exists");
    expect(existsSync(join(dir, "pg_dump.args"))).toBe(false);
  });
});
