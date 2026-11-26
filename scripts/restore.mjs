#!/usr/bin/env node
// The restore of ADR-0030 (runbook docs/runbooks/restore.md), run by the
// owner on a separate machine, never in CI or on the development machine.
//
// Usage:
//   restore.mjs --repo OWNER/REPO --run <run ID> --key <age identity file> --target <database URL>
//
// In order, and nothing is decrypted until every check has passed:
//   1. The run is a successful scheduled run of .github/workflows/backup.yml
//      (by its file path, not its name) on main, in this repository.
//   2. Its `backup` artifact is downloaded into a new private folder.
//   3. The file's provenance passes `gh attestation verify`, signed by that
//      workflow on refs/heads/main, on a GitHub-hosted runner.
//   4. The identity file is readable by its owner alone (mode 0600).
//   5. `age -d` is piped straight into `psql -v ON_ERROR_STOP=1`, between a
//      BEGIN this script writes first and a COMMIT it writes only after age
//      finished cleanly. No plaintext is written, and a cut-off stream, a
//      failed decryption or this script dying restores nothing.
//
// Needs gh (signed in), age and psql on the PATH. The target URL is a
// database whose migrations ran and which holds no rows yet. It must hold no
// password, which a command line leaves in the shell's history and in the
// process list: psql asks for it on the terminal. This script prints the URL
// nowhere.
//
// Exit codes: 0 restored, 1 a check or the restore failed, 2 usage error.

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const WORKFLOW_PATH = ".github/workflows/backup.yml";
export const ARTIFACT = "backup";

/**
 * Why a run cannot be restored from, or an empty list.
 * @param {unknown} run  the answer of `gh api repos/OWNER/REPO/actions/runs/ID`
 * @param {string} repo
 * @returns {string[]}
 */
export function runProblems(run, repo) {
  const value =
    typeof run === "object" && run !== null ? /** @type {Record<string, unknown>} */ (run) : {};
  const repository =
    typeof value["repository"] === "object" && value["repository"] !== null
      ? /** @type {Record<string, unknown>} */ (value["repository"])
      : {};
  /** @type {string[]} */
  const problems = [];
  if (value["path"] !== WORKFLOW_PATH) problems.push(`the run is not of ${WORKFLOW_PATH}`);
  if (value["event"] !== "schedule") problems.push("the run was not started by the schedule");
  if (value["head_branch"] !== "main") problems.push("the run is not on main");
  if (repository["full_name"] !== repo) problems.push(`the run is not in ${repo}`);
  if (value["conclusion"] !== "success") problems.push("the run did not succeed");
  return problems;
}

/** The arguments of `gh attestation verify` for a downloaded file. */
export function attestationArgs(/** @type {string} */ file, /** @type {string} */ repo) {
  return [
    "attestation",
    "verify",
    file,
    "--repo",
    repo,
    "--signer-workflow",
    `${repo}/${WORKFLOW_PATH}`,
    "--source-ref",
    "refs/heads/main",
    "--deny-self-hosted-runners",
  ];
}

/**
 * @typedef {{
 *   run: (command: string, args: string[]) => { status: number | null, stdout: string },
 *   restore: (key: string, file: string, target: string) => Promise<number>,
 *   folder: () => string,
 *   files: (folder: string) => string[],
 *   mode: (file: string) => number,
 *   say: (line: string) => void,
 * }} Tools
 */

/**
 * Joins a running `age -d` to a running psql. psql runs with no
 * --single-transaction, which would commit whenever its input ends, also
 * when this process dies and the pipe closes. Instead psql gets BEGIN
 * first, then age's output, and COMMIT only after age finished cleanly; age
 * refuses cut-off ciphertext. In every other case psql's input ends, or psql
 * is killed, inside the open transaction, and the server rolls it back.
 * Resolves with age's exit code if it failed, else psql's.
 * @param {{ stdout: import("node:stream").Readable, kill: (signal: NodeJS.Signals) => unknown, on: (event: "close", listener: (code: number | null) => void) => unknown }} age
 * @param {{ stdin: import("node:stream").Writable, kill: (signal: NodeJS.Signals) => unknown, on: (event: "close", listener: (code: number | null) => void) => unknown }} psql
 * @returns {Promise<number>}
 */
export const pipeInto = (age, psql) =>
  new Promise((resolve) => {
    // psql stopped reading (it failed, or was stopped): stop decrypting too.
    // Its own exit code is then the answer.
    psql.stdin.on("error", () => {
      age.kill("SIGTERM");
    });
    psql.stdin.write("BEGIN;\n");
    age.stdout.pipe(psql.stdin, { end: false });
    let ageStatus = 0;
    age.on("close", (code) => {
      ageStatus = code ?? 1;
      if (ageStatus === 0) psql.stdin.end("COMMIT;\n");
      else psql.kill("SIGTERM");
    });
    psql.on("close", (code) => {
      resolve(ageStatus !== 0 ? ageStatus : (code ?? 1));
    });
  });

/**
 * Decrypts the file into the target: `age -d` piped into psql in one
 * transaction (pipeInto).
 * @param {string} key
 * @param {string} file
 * @param {string} target
 * @returns {Promise<number>}
 */
export const pipeRestore = (key, file, target) =>
  pipeInto(
    spawn("age", ["--decrypt", "--identity", key, file], {
      stdio: ["ignore", "pipe", "inherit"],
    }),
    spawn("psql", ["-v", "ON_ERROR_STOP=1", "--quiet", target], {
      stdio: ["pipe", "inherit", "inherit"],
      // The dump holds data only, for tables the migrations made. With
      // replica, triggers such as the profile a new account gets do not
      // fire again for rows the dump already has.
      env: { ...process.env, PGOPTIONS: "-c session_replication_role=replica" },
    }),
  );

/**
 * Whether a connection string carries a password, as a URL
 * (`postgresql://user:password@host`) or as keywords (`password=...`).
 * @param {string} target
 */
export function holdsPassword(target) {
  if (/(^|\s)password\s*=/i.test(target)) return true;
  try {
    return new URL(target).password !== "";
  } catch {
    // Not a URL: a keyword string, whose password the test above looked for.
    return false;
  }
}

/** @type {Tools} */
const realTools = {
  run: (command, args) => {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    });
    return { status: result.status, stdout: result.stdout ?? "" };
  },
  restore: pipeRestore,
  folder: () => mkdtempSync(join(tmpdir(), "heap-restore-")),
  files: (folder) => readdirSync(folder),
  mode: (file) => statSync(file).mode & 0o777,
  say: (line) => process.stdout.write(`${line}\n`),
};

/**
 * @param {{ repo: string, run: string, key: string, target: string }} options
 * @param {Tools} tools
 * @returns {Promise<number>}
 */
export async function restore({ repo, run, key, target }, tools = realTools) {
  const fail = (/** @type {string} */ reason) => {
    tools.say(`restore: refused: ${reason}`);
    return 1;
  };
  const answer = tools.run("gh", ["api", `repos/${repo}/actions/runs/${run}`]);
  if (answer.status !== 0) return fail("the run could not be read");
  let parsed;
  try {
    parsed = JSON.parse(answer.stdout);
  } catch {
    return fail("the run's answer is not JSON");
  }
  const problems = runProblems(parsed, repo);
  if (problems.length > 0) return fail(problems.join("; "));

  const folder = tools.folder();
  const download = tools.run("gh", [
    "run",
    "download",
    run,
    "-R",
    repo,
    "-n",
    ARTIFACT,
    "-D",
    folder,
  ]);
  if (download.status !== 0) return fail("the artifact could not be downloaded");
  const names = tools.files(folder);
  if (names.length !== 1 || names[0] !== "backup.age") {
    return fail("the artifact does not hold exactly one file, backup.age");
  }
  const file = join(folder, "backup.age");

  if (tools.run("gh", attestationArgs(file, repo)).status !== 0) {
    return fail("the file's provenance does not pass gh attestation verify");
  }
  if (tools.mode(key) !== 0o600) return fail("the key file is not mode 0600");

  tools.say("restore: every check passed; decrypting into the target");
  const status = await tools.restore(key, file, target);
  if (status !== 0)
    return fail(`the restore stopped (exit ${String(status)}); nothing was committed`);
  tools.say("restore: done; now run scripts/restore-verify.sql");
  return 0;
}

/** @param {string[]} argv */
export async function main(argv, tools = realTools) {
  /** @type {Record<string, string>} */
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) break;
    options[flag.slice(2)] = value;
  }
  const { repo, run, key, target } = options;
  if (target !== undefined && holdsPassword(target)) {
    process.stderr.write(
      "restore: refused: the target holds a password; leave it out, and psql asks for it\n",
    );
    return 2;
  }
  if (
    repo === undefined ||
    !/^[\w.-]+\/[\w.-]+$/.test(repo) ||
    run === undefined ||
    !/^\d+$/.test(run) ||
    key === undefined ||
    target === undefined
  ) {
    process.stderr.write(
      "usage: restore.mjs --repo OWNER/REPO --run <run ID> --key <age identity file> --target <database URL>\n",
    );
    return 2;
  }
  return restore({ repo, run, key, target }, tools);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exit(await main(process.argv.slice(2)));
}
