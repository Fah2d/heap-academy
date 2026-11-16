// The pre-push Git hook (docs/spec/05-engineering-handbook.md section 2,
// layer 2). It refuses a push that updates or deletes main, a push that
// rewrites a remote branch, and any pushed commit with AI attribution in its
// message or identity. It reads what Git will actually push, so it holds
// whatever the command line said (T-18, NFR-MAINT-08).
//
// Git runs it as `pre-push <remote name> <remote url>` and writes one line per
// ref to standard input: `<local ref> <local sha> <remote ref> <remote sha>`.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { checkRevisions } from "./check-attribution.mjs";

const PROTECTED_REF = "refs/heads/main";
const NO_COMMIT = /^0+$/;

/**
 * @param {string} input the lines Git writes to the hook
 * @param {string} remote the remote's name, or its URL when it has none
 * @param {(args: string[]) => number} gitStatus runs Git and returns its exit status
 * @returns {string[]}
 */
export function pushProblems(input, remote, gitStatus) {
  /** @type {string[]} */
  const problems = [];
  for (const line of input.split("\n")) {
    if (line.trim() === "") continue;
    const [localRef = "", localSha = "", remoteRef = "", remoteSha = ""] = line.split(" ");
    if (remoteRef === PROTECTED_REF) {
      problems.push(`${localRef} -> ${remoteRef}: the owner merges into main; never push to it`);
      continue;
    }
    if (NO_COMMIT.test(localSha)) {
      problems.push(`${remoteRef}: deleting a branch on the remote`);
      continue;
    }
    if (!NO_COMMIT.test(remoteSha)) {
      if (gitStatus(["merge-base", "--is-ancestor", remoteSha, localSha]) !== 0) {
        problems.push(
          `${localRef} -> ${remoteRef}: rewrites the remote branch (or its commit is not fetched)`,
        );
        continue;
      }
    }
    const revisions = NO_COMMIT.test(remoteSha)
      ? [localSha, "--not", `--remotes=${remote}`]
      : [`${remoteSha}..${localSha}`];
    problems.push(...checkRevisions(revisions).map((problem) => `${localRef}: ${problem}`));
  }
  return problems;
}

/** @param {string[]} args */
const gitStatus = (args) => spawnSync("git", args, { stdio: "ignore" }).status ?? 1;

/**
 * @param {string[]} argv
 * @returns {number}
 */
export function main(argv) {
  const [remote = "origin"] = argv;
  /** @type {string[]} */
  let problems;
  try {
    problems = pushProblems(readFileSync(0, "utf8"), remote, gitStatus);
  } catch (error) {
    // A push the hook could not check is refused, not let through.
    process.stderr.write(`pre-push: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  if (problems.length > 0) {
    process.stderr.write(
      "pre-push: refused (docs/spec/05-engineering-handbook.md section 2):\n" +
        problems.map((problem) => `  ${problem}\n`).join(""),
    );
    return 1;
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exit(main(process.argv.slice(2)));
}
