import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CLAUDE = "Cla" + "ude";
const CO_AUTHOR = `Co-Authored-By: ${CLAUDE} <noreply@${"anthropic.com"}>`;
const root = join(import.meta.dirname, "..");

// A scratch repository that uses this repository's commit-msg hook and
// attribution script, so a real `git commit` exercises the Git layer on its own.
function scratchRepository() {
  const repo = mkdtempSync(join(tmpdir(), "hooks-"));
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
  return { repo, git };
}

describe("commit-msg Git hook", () => {
  it("[NFR-MAINT-08] refuses a commit whose message file carries a co-author trailer", () => {
    const { repo, git } = scratchRepository();
    const message = join(repo, "message.txt");
    writeFileSync(message, `feat: one\n\n${CO_AUTHOR}\n`);
    const result = spawnSync("git", ["commit", "--allow-empty", "-F", message], {
      cwd: repo,
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("co-author-trailer");
    expect(() => git("rev-parse", "--verify", "--quiet", "HEAD")).toThrow();
  });

  it("[NFR-MAINT-08] accepts a clean commit", () => {
    const { git } = scratchRepository();
    git("commit", "--quiet", "--allow-empty", "-m", "feat: one");
    expect(git("log", "--format=%s").trim()).toBe("feat: one");
  });
});
