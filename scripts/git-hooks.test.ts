import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const CLAUDE = "Cla" + "ude";
const ANTHROPIC_ADDRESS = "noreply@" + "anthropic.com";
const CO_AUTHOR = `Co-Authored-By: ${CLAUDE} <${ANTHROPIC_ADDRESS}>`;
const root = join(import.meta.dirname, "..");

const scratchDirectories: string[] = [];
afterEach(() => {
  for (const directory of scratchDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

// A scratch repository that uses this repository's commit-msg hook and
// attribution script, so a real `git commit` exercises the Git layer on its own.
function scratchRepository() {
  const repo = mkdtempSync(join(tmpdir(), "hooks-"));
  scratchDirectories.push(repo);
  mkdirSync(join(repo, "scripts"));
  mkdirSync(join(repo, "hooks"));
  copyFileSync(
    join(root, "scripts/check-attribution.mjs"),
    join(repo, "scripts/check-attribution.mjs"),
  );
  copyFileSync(join(root, ".githooks/commit-msg"), join(repo, "hooks/commit-msg"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.name", "Fahad");
  git("config", "user.email", "fahad@example.com");
  git("config", "core.hooksPath", "hooks");
  const commit = (...args: string[]) =>
    spawnSync("git", [...args.slice(0, -1), "commit", "--allow-empty", ...args.slice(-1)], {
      cwd: repo,
      encoding: "utf8",
    });
  const hasCommits = () =>
    spawnSync("git", ["rev-parse", "--verify", "--quiet", "HEAD"], { cwd: repo }).status === 0;
  return { repo, git, commit, hasCommits };
}

describe("commit-msg Git hook", () => {
  it("[NFR-MAINT-08] refuses a commit whose message file carries a co-author trailer", () => {
    const { repo, commit, hasCommits } = scratchRepository();
    const message = join(repo, "message.txt");
    writeFileSync(message, `feat: one\n\n${CO_AUTHOR}\n`);
    const result = commit(`--file=${message}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("co-author-trailer");
    expect(hasCommits()).toBe(false);
  });

  it("[NFR-MAINT-08] refuses a commit whose author is named Claude", () => {
    const { commit, hasCommits } = scratchRepository();
    const result = commit("-c", `user.name=${CLAUDE}`, "--message=feat: one");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("ai-identity-name");
    expect(hasCommits()).toBe(false);
  });

  it("[NFR-MAINT-08] refuses a commit with an Anthropic author address given by --author", () => {
    const { repo, hasCommits } = scratchRepository();
    const result = spawnSync(
      "git",
      ["commit", "--allow-empty", `--author=Bot <${ANTHROPIC_ADDRESS}>`, "--message=feat: one"],
      { cwd: repo, encoding: "utf8" },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("ai-identity-address");
    expect(hasCommits()).toBe(false);
  });

  it("[NFR-MAINT-08] accepts a clean commit", () => {
    const { git, commit } = scratchRepository();
    expect(commit("--message=feat: one").status).toBe(0);
    expect(git("log", "--format=%s").trim()).toBe("feat: one");
  });
});
