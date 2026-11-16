import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const CLAUDE = "Cla" + "ude";
const CO_AUTHOR = `Co-Authored-By: ${CLAUDE} <noreply@${"anthropic.com"}>`;
const BRANCH = "wp/9.9-probe";
const root = join(import.meta.dirname, "..");

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

// A scratch clone with a local bare remote. It runs this repository's
// pre-push hook through a real `git push`.
function scratch() {
  const base = mkdtempSync(join(tmpdir(), "pre-push-"));
  directories.push(base);
  const remote = join(base, "remote.git");
  const repo = join(base, "work");
  execFileSync("git", ["init", "--quiet", "--bare", "--initial-branch=main", remote]);
  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(join(repo, "hooks"));
  for (const file of ["pre-push.mjs", "check-attribution.mjs"]) {
    copyFileSync(join(root, "scripts", file), join(repo, "scripts", file));
  }
  copyFileSync(join(root, ".githooks/pre-push"), join(repo, "hooks/pre-push"));
  chmodSync(join(repo, "hooks/pre-push"), 0o755);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  git("init", "--quiet", `--initial-branch=${BRANCH}`);
  git("config", "user.name", "Fahad");
  git("config", "user.email", "fahad@example.com");
  git("config", "core.hooksPath", "hooks");
  git("remote", "add", "origin", remote);
  git("commit", "--quiet", "--allow-empty", "-m", "feat: one");
  const push = (...args: string[]) =>
    spawnSync("git", ["push", "--quiet", ...args], { cwd: repo, encoding: "utf8" });
  const remoteHas = (ref: string) =>
    spawnSync("git", ["rev-parse", "--verify", "--quiet", ref], { cwd: remote }).status === 0;
  const remoteSha = (ref: string) =>
    execFileSync("git", ["rev-parse", ref], { cwd: remote, encoding: "utf8" }).trim();
  return { git, push, remoteHas, remoteSha };
}

describe("pre-push Git hook", () => {
  it("[T-18] accepts a fast-forward push of a work package branch", () => {
    const { push, remoteHas } = scratch();
    expect(push("origin", BRANCH).status).toBe(0);
    expect(remoteHas(`refs/heads/${BRANCH}`)).toBe(true);
  });

  it.each([["main"], ["heads/main"], ["HEAD:main"], ["HEAD:refs/heads/main"]])(
    "[T-18] refuses a push to main written as %s",
    (refspec) => {
      const { git, push, remoteHas } = scratch();
      git("branch", "main");
      const result = push("origin", refspec);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("never push to it");
      expect(remoteHas("refs/heads/main")).toBe(false);
    },
  );

  it("[T-18] refuses a force push that rewrites the remote branch", () => {
    const { git, push, remoteSha } = scratch();
    expect(push("origin", BRANCH).status).toBe(0);
    const before = remoteSha(`refs/heads/${BRANCH}`);
    git("commit", "--quiet", "--amend", "--allow-empty", "-m", "feat: rewritten");
    const result = push("--force", "origin", BRANCH);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("rewrites the remote branch");
    expect(remoteSha(`refs/heads/${BRANCH}`)).toBe(before);
  });

  it("[T-18] refuses deleting a branch on the remote", () => {
    const { push, remoteHas } = scratch();
    expect(push("origin", BRANCH).status).toBe(0);
    const result = push("origin", `:${BRANCH}`);
    expect(result.status).not.toBe(0);
    expect(remoteHas(`refs/heads/${BRANCH}`)).toBe(true);
  });

  it("[T-18] [NFR-MAINT-08] refuses a commit made by plumbing, which ran no commit-msg hook", () => {
    const { git, push, remoteHas } = scratch();
    const tree = git("rev-parse", "HEAD^{tree}").trim();
    const parent = git("rev-parse", "HEAD").trim();
    const commit = git("commit-tree", tree, "-p", parent, "-m", `feat: two\n\n${CO_AUTHOR}`).trim();
    git("update-ref", `refs/heads/${BRANCH}`, commit);
    const result = push("origin", BRANCH);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("co-author-trailer");
    expect(remoteHas(`refs/heads/${BRANCH}`)).toBe(false);
  });

  it("[NFR-MAINT-08] refuses a pushed commit whose author is named Claude", () => {
    const { git, push } = scratch();
    git("-c", `user.name=${CLAUDE}`, "commit", "--quiet", "--allow-empty", "-m", "feat: two");
    const result = push("origin", BRANCH);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("ai-identity-name");
  });
});
