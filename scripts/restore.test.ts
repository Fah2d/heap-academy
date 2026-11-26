import { EventEmitter, once } from "node:events";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  attestationArgs,
  holdsPassword,
  main,
  pipeInto,
  pipeRestore,
  restore,
  runProblems,
  WORKFLOW_PATH,
} from "./restore.mjs";

// scripts/restore.mjs (ADR-0030): an artifact of any run but a successful
// scheduled run of backup.yml on main in this repository, or one whose
// provenance fails, is refused before anything is decrypted. The tools are
// fakes that record each call.

const REPO = "owner/heap-academy";
const GOOD_RUN = {
  path: WORKFLOW_PATH,
  event: "schedule",
  head_branch: "main",
  conclusion: "success",
  repository: { full_name: REPO },
};
const OPTIONS = { repo: REPO, run: "123", key: "/keys/backup.key", target: "postgresql://x" };

function tools(
  overrides: {
    run?: unknown;
    download?: number;
    files?: string[];
    attestation?: number;
    mode?: number;
    restored?: number;
  } = {},
) {
  const calls: string[] = [];
  const lines: string[] = [];
  return {
    calls,
    lines,
    tools: {
      run: (command: string, args: string[]) => {
        calls.push([command, ...args].join(" "));
        if (args[0] === "api") {
          return { status: 0, stdout: JSON.stringify(overrides.run ?? GOOD_RUN) };
        }
        if (args[0] === "run") return { status: overrides.download ?? 0, stdout: "" };
        return { status: overrides.attestation ?? 0, stdout: "" };
      },
      restore: (key: string, file: string) => {
        calls.push(`decrypt ${key} ${file}`);
        return Promise.resolve(overrides.restored ?? 0);
      },
      folder: () => "/tmp/heap-restore-x",
      files: () => overrides.files ?? ["backup.age"],
      mode: () => overrides.mode ?? 0o600,
      say: (line: string) => {
        lines.push(line);
      },
    },
  };
}

const decrypted = (calls: string[]) => calls.some((call) => call.startsWith("decrypt"));

describe("restore.mjs", () => {
  it("[NFR-REL-05] [T-24] restores a successful scheduled run of backup.yml on main after its provenance passes", async () => {
    const fake = tools();
    await expect(restore(OPTIONS, fake.tools)).resolves.toBe(0);
    expect(fake.calls).toEqual([
      `gh api repos/${REPO}/actions/runs/123`,
      `gh run download 123 -R ${REPO} -n backup -D /tmp/heap-restore-x`,
      `gh ${attestationArgs("/tmp/heap-restore-x/backup.age", REPO).join(" ")}`,
      "decrypt /keys/backup.key /tmp/heap-restore-x/backup.age",
    ]);
  });

  it("[T-24] checks provenance against the backup workflow on main, on GitHub's runners", () => {
    expect(attestationArgs("f", REPO)).toEqual([
      "attestation",
      "verify",
      "f",
      "--repo",
      REPO,
      "--signer-workflow",
      `${REPO}/.github/workflows/backup.yml`,
      "--source-ref",
      "refs/heads/main",
      "--deny-self-hosted-runners",
    ]);
  });

  it.each([
    ["another workflow", { path: ".github/workflows/ci.yml" }],
    ["a run started by hand", { event: "workflow_dispatch" }],
    ["a run started by a push", { event: "push" }],
    ["a run on another branch", { head_branch: "wp/attack" }],
    ["a run in a fork", { repository: { full_name: "someone/heap-academy" } }],
    ["a failed run", { conclusion: "failure" }],
  ])("[T-24] refuses %s before downloading or decrypting anything", async (_case, change) => {
    const fake = tools({ run: { ...GOOD_RUN, ...change } });
    await expect(restore(OPTIONS, fake.tools)).resolves.toBe(1);
    expect(fake.calls).toEqual([`gh api repos/${REPO}/actions/runs/123`]);
    expect(fake.lines[0]).toMatch(/^restore: refused: /);
  });

  it("[T-24] judges the run by its file path, not its display name", () => {
    expect(
      runProblems({ ...GOOD_RUN, name: "Backup", path: ".github/workflows/other.yml" }, REPO),
    ).toEqual([`the run is not of ${WORKFLOW_PATH}`]);
  });

  it("[T-24] refuses a file whose provenance fails, before decrypting", async () => {
    const fake = tools({ attestation: 1 });
    await expect(restore(OPTIONS, fake.tools)).resolves.toBe(1);
    expect(decrypted(fake.calls)).toBe(false);
    expect(fake.lines).toEqual([
      "restore: refused: the file's provenance does not pass gh attestation verify",
    ]);
  });

  it("[T-24] refuses an artifact with other files in it, and a key others can read", async () => {
    const extra = tools({ files: ["backup.age", "run.sh"] });
    await expect(restore(OPTIONS, extra.tools)).resolves.toBe(1);
    expect(decrypted(extra.calls)).toBe(false);
    const open = tools({ mode: 0o644 });
    await expect(restore(OPTIONS, open.tools)).resolves.toBe(1);
    expect(decrypted(open.calls)).toBe(false);
  });

  it("[NFR-REL-05] reports a restore that stopped, which committed nothing", async () => {
    const fake = tools({ restored: 3 });
    await expect(restore(OPTIONS, fake.tools)).resolves.toBe(1);
    expect(fake.lines.at(-1)).toContain("nothing was committed");
  });

  it("[T-24] refuses a run ID or repository that is not one", async () => {
    const fake = tools();
    await expect(
      main(["--repo", REPO, "--run", "123; rm -rf", "--key", "k", "--target", "t"], fake.tools),
    ).resolves.toBe(2);
    await expect(
      main(["--repo", "a b", "--run", "1", "--key", "k", "--target", "t"], fake.tools),
    ).resolves.toBe(2);
    expect(fake.calls).toEqual([]);
  });
});

// The real pipe, with fake `age` and `psql` on the PATH. psql commits when its
// input ends, and a SQL stream cut between two statements is valid SQL: the
// rehearsal of 2026-11-26 committed the accounts of a dump cut at 6,000 bytes
// (docs/reports/pull-requests/WP-7.3-part-6.md). So psql must hear the end
// only when age, which refuses cut-off ciphertext, finished cleanly.
describe("restore.mjs pipe", () => {
  let dir: string;
  let path: string | undefined;

  function tool(name: string, body: string) {
    const file = join(dir, name);
    writeFileSync(file, `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(file, 0o755);
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "restore-pipe-"));
    path = process.env["PATH"];
    process.env["PATH"] = `${dir}:/usr/bin:/bin`;
    process.env["FAKE_DIR"] = dir;
    // age: prints two statements, then succeeds or fails as told.
    tool(
      "age",
      `printf '%s\\n' "$@" > "$FAKE_DIR/age.args"
echo "insert into t values (1);"
echo "insert into t values (2);"
[[ -f "$FAKE_DIR/age.fail" ]] && exit 1
exit 0`,
    );
    // psql: keeps what it reads, and marks a commit only when its input ends.
    tool(
      "psql",
      `printf '%s\\n' "$@" > "$FAKE_DIR/psql.args"
echo "$PGOPTIONS" > "$FAKE_DIR/psql.options"
while IFS= read -r line; do echo "$line" >> "$FAKE_DIR/psql.in"; done
echo committed > "$FAKE_DIR/psql.committed"`,
    );
  });

  afterEach(() => {
    if (path === undefined) delete process.env["PATH"];
    else process.env["PATH"] = path;
    delete process.env["FAKE_DIR"];
    rmSync(dir, { recursive: true, force: true });
  });

  it("[NFR-REL-05] [T-24] commits a stream age finished, in one transaction with triggers off", async () => {
    await expect(pipeRestore("/keys/k", "/tmp/backup.age", "postgresql://x")).resolves.toBe(0);
    expect(readFileSync(join(dir, "age.args"), "utf8")).toBe(
      "--decrypt\n--identity\n/keys/k\n/tmp/backup.age\n",
    );
    expect(readFileSync(join(dir, "psql.args"), "utf8")).toBe(
      "-v\nON_ERROR_STOP=1\n--quiet\npostgresql://x\n",
    );
    expect(readFileSync(join(dir, "psql.options"), "utf8")).toBe(
      "-c session_replication_role=replica\n",
    );
    expect(readFileSync(join(dir, "psql.in"), "utf8")).toBe(
      "BEGIN;\ninsert into t values (1);\ninsert into t values (2);\nCOMMIT;\n",
    );
    expect(existsSync(join(dir, "psql.committed"))).toBe(true);
  });

  it("[NFR-REL-05] [T-24] stops psql before it commits when age fails, and reports age's exit", async () => {
    writeFileSync(join(dir, "age.fail"), "");
    await expect(pipeRestore("/keys/k", "/tmp/backup.age", "postgresql://x")).resolves.toBe(1);
    expect(existsSync(join(dir, "psql.committed"))).toBe(false);
    // psql may be killed before it reads a line; whatever it read has no COMMIT.
    const read = existsSync(join(dir, "psql.in")) ? readFileSync(join(dir, "psql.in"), "utf8") : "";
    expect(read).not.toContain("COMMIT");
  });
});

// The same rule at the level of the streams, where the order of events is
// the test's own: with the fake processes above, whether psql reads its end
// or is killed first is a race between two processes.
describe("restore.mjs pipeInto", () => {
  function processes() {
    const killed: string[] = [];
    const received: string[] = [];
    const age = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      kill: (signal: NodeJS.Signals) => {
        killed.push(`age ${signal}`);
      },
    });
    const stdin = new PassThrough();
    stdin.on("data", (chunk: Buffer) => received.push(chunk.toString()));
    const psql = Object.assign(new EventEmitter(), {
      stdin,
      kill: (signal: NodeJS.Signals) => {
        killed.push(`psql ${signal}`);
        psql.emit("close", null);
      },
    });
    return { age, psql, killed, received };
  }

  it("[NFR-REL-05] [T-24] psql gets BEGIN, age's output, and COMMIT only once age exits cleanly", async () => {
    const { age, psql, killed, received } = processes();
    const done = pipeInto(age, psql);
    age.stdout.end("insert into t values (1);\n");
    await once(age.stdout, "end");
    expect(psql.stdin.writableEnded).toBe(false);
    expect(received.join("")).toBe("BEGIN;\ninsert into t values (1);\n");
    age.emit("close", 0);
    expect(psql.stdin.writableEnded).toBe(true);
    psql.emit("close", 0);
    await expect(done).resolves.toBe(0);
    expect(received.join("")).toBe("BEGIN;\ninsert into t values (1);\nCOMMIT;\n");
    expect(killed).toEqual([]);
  });

  it("[NFR-REL-05] [T-24] a failed age kills psql with no COMMIT sent, and its exit is reported", async () => {
    const { age, psql, killed, received } = processes();
    const done = pipeInto(age, psql);
    age.stdout.end("insert into t values (1);\n");
    await once(age.stdout, "end");
    age.emit("close", 1);
    expect(killed).toEqual(["psql SIGTERM"]);
    await expect(done).resolves.toBe(1);
    expect(received.join("")).not.toContain("COMMIT");
  });

  it("[NFR-REL-05] psql that stops reading stops age, and psql's exit is reported", async () => {
    const { age, psql, killed } = processes();
    const done = pipeInto(age, psql);
    psql.stdin.emit("error", Object.assign(new Error("write EPIPE"), { code: "EPIPE" }));
    expect(killed).toEqual(["age SIGTERM"]);
    psql.emit("close", 3);
    age.emit("close", 0);
    await expect(done).resolves.toBe(3);
  });
});

describe("restore.mjs target", () => {
  it.each([
    ["postgresql://postgres:secret@host:5432/postgres", true],
    ["host=db user=postgres password=secret", true],
    ["postgresql://postgres@host:5432/postgres?sslmode=require", false],
    ["host=db user=postgres", false],
  ])("[T-12] %s holds a password: %s", (target, expected) => {
    expect(holdsPassword(target)).toBe(expected);
  });

  it("[T-12] refuses a target with a password before anything runs", async () => {
    const fake = tools();
    await expect(
      main(
        ["--repo", REPO, "--run", "1", "--key", "k", "--target", "postgresql://u:secret@h/db"],
        fake.tools,
      ),
    ).resolves.toBe(2);
    expect(fake.calls).toEqual([]);
  });
});
