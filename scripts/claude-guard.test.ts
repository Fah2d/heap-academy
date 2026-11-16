import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluate } from "./claude-guard.mjs";

const CLAUDE = "Cla" + "ude";
const CO_AUTHOR = `Co-Authored-By: ${CLAUDE} <noreply@${"anthropic.com"}>`;
const GENERATED = `Generated with [${CLAUDE} Code](https://claude.com/claude-code)`;

type Files = Record<string, string>;

function context(branch = "wp/1.2-skeleton-guardrails", files: Files = {}) {
  return {
    projectDir: "/repo",
    currentBranch: () => branch,
    readFile: (path: string) => files[path],
  };
}

function bash(command: string, branch?: string, files?: Files) {
  return evaluate({ tool_name: "Bash", tool_input: { command } }, context(branch, files));
}

function tool(tool_name: string, tool_input: Record<string, unknown>) {
  return evaluate({ tool_name, tool_input }, context());
}

describe("secret files", () => {
  it.each([
    ["Read", { file_path: "/repo/.env" }],
    ["Read", { file_path: "/repo/.env.local" }],
    ["Read", { file_path: "/repo/apps/web/.env.production" }],
    ["Edit", { file_path: "/repo/.env", old_string: "a", new_string: "b" }],
    ["Write", { file_path: "/repo/.env.staging", content: "x" }],
    ["Grep", { pattern: "KEY", path: "/repo/.env.local" }],
    ["Grep", { pattern: "KEY", path: "/repo", glob: ".env*" }],
    ["Glob", { pattern: "**/.env*" }],
    ["NotebookEdit", { notebook_path: "/repo/.env" }],
  ])("[T-18] [NFR-SEC-04] blocks %s on a .env file", (name, input) => {
    expect(tool(name, input).decision).toBe("block");
  });

  it.each([
    "cat .env",
    "head -n 3 ./.env.local",
    "source .env",
    ". .env.production",
    "grep SECRET .env",
    "cp .env /tmp/x",
    "less < .env",
    "bash -c 'cat .env'",
    "echo $(cat .env.local)",
    "node -e \"console.log(require('fs').readFileSync('.env','utf8'))\"",
  ])("[T-18] [NFR-SEC-04] blocks the shell command: %s", (command) => {
    expect(bash(command).decision).toBe("block");
  });

  it.each([
    ["Read", { file_path: "/repo/.env.example" }],
    ["Write", { file_path: "/repo/.env.example", content: "X=1" }],
    ["Read", { file_path: "/repo/src/infrastructure/env/schema.ts" }],
    ["Grep", { pattern: "env", path: "/repo/src" }],
  ])("[T-18] allows %s on a file that is not secret", (name, input) => {
    expect(tool(name, input).decision).toBe("allow");
  });

  it("[T-18] allows reading the example file from the shell", () => {
    expect(bash("cat .env.example").decision).toBe("allow");
  });
});

describe("force push and push to main", () => {
  it.each([
    "git push --force origin wp/1.2-x",
    "git push -f",
    "git push -uf origin wp/1.2-x",
    "git push --force-with-lease",
    "git push --force-if-includes origin wp/1.2-x",
    "git push origin +wp/1.2-x",
    "git push --mirror",
    "git -C . push --force",
    "git -c push.default=current push -f origin",
    "cd /repo && git push --force",
    'sh -c "git push -f"',
  ])("[T-18] blocks force push: %s", (command) => {
    expect(bash(command).decision).toBe("block");
  });

  it.each([
    "git push origin main",
    "git push origin HEAD:main",
    "git push origin wp/1.2-x:main",
    "git push origin HEAD:refs/heads/main",
    "git push --all",
    "git push -u origin main --dry-run",
  ])("[T-18] blocks push to main: %s", (command) => {
    expect(bash(command).decision).toBe("block");
  });

  it("[T-18] blocks a push with no refspec while main is checked out", () => {
    expect(bash("git push", "main").decision).toBe("block");
    expect(bash("git push origin", "main").decision).toBe("block");
  });

  it.each(["git push -u origin wp/1.2-skeleton-guardrails", "git push", "git push origin HEAD"])(
    "[T-18] allows a normal push from a work branch: %s",
    (command) => {
      expect(bash(command).decision).toBe("allow");
    },
  );
});

describe("deleting remote branches", () => {
  it.each([
    "git push origin --delete wp/old",
    "git push origin -d wp/old",
    "git push origin :wp/old",
    "gh api -X DELETE repos/o/r/git/refs/heads/wp/old",
    "gh api --method DELETE repos/o/r/git/refs/heads/wp/old",
  ])("[T-18] blocks: %s", (command) => {
    expect(bash(command).decision).toBe("block");
  });
});

describe("skipping Git hooks", () => {
  it.each([
    "git commit --no-verify -m 'feat: x'",
    "git commit -n -m 'feat: x'",
    "git commit -anm 'feat: x'",
    "git push --no-verify",
    "git merge --no-verify wp/x",
    "git -c core.hooksPath=/dev/null commit -m 'feat: x'",
    "git config core.hooksPath /dev/null",
    "git config --unset core.hooksPath",
    "git config alias.ci 'commit --no-verify'",
    "rm .githooks/commit-msg",
    "chmod -x .githooks/pre-commit",
    "chmod a-x .githooks/commit-msg",
    "chmod 644 .githooks/pre-commit",
    "chmod u=rw .githooks/pre-commit",
    "mv .githooks .githooks-off",
    "echo '' > .githooks/commit-msg",
  ])("[T-18] blocks: %s", (command) => {
    expect(bash(command).decision).toBe("block");
  });

  it.each([
    "git commit -m 'feat: x'",
    "git commit -am 'fix: y'",
    "git commit -m 'chore: -n is a flag name'",
    "git config core.hooksPath .githooks",
    "git config user.name",
    "chmod +x .githooks/pre-commit .githooks/commit-msg",
    "chmod 755 .githooks/pre-commit",
  ])("[T-18] allows: %s", (command) => {
    expect(bash(command).decision).toBe("allow");
  });
});

describe("disabling checks and merging", () => {
  it.each([
    "gh pr merge 3 --squash",
    "gh workflow disable ci.yml",
    "gh api -X DELETE repos/o/r/branches/main/protection",
    "gh api -X PUT repos/o/r/branches/main/protection --input p.json",
    "gh api --method PATCH repos/o/r/rulesets/1",
    "gh ruleset delete 1",
    "gh repo edit --visibility public",
    "gh repo delete o/r",
    "gh api -X PATCH repos/o/r/git/refs/heads/main -f sha=abc",
  ])("[T-18] blocks: %s", (command) => {
    expect(bash(command).decision).toBe("block");
  });

  it.each(["gh pr view 3", "gh pr checks 3", "gh api repos/o/r/branches/main/protection"])(
    "[T-18] allows a read: %s",
    (command) => {
      expect(bash(command).decision).toBe("allow");
    },
  );
});

describe("AI attribution", () => {
  it("[NFR-MAINT-08] blocks a commit whose message carries a co-author trailer", () => {
    const command = `git commit -m "feat: x" -m "${CO_AUTHOR}"`;
    expect(bash(command).decision).toBe("block");
  });

  it("[NFR-MAINT-08] blocks a commit message passed in a here-document", () => {
    const command = `git commit -F - <<'EOF'\nfeat: x\n\n${CO_AUTHOR}\nEOF`;
    expect(bash(command).decision).toBe("block");
  });

  it("[NFR-MAINT-08] blocks a commit whose message file carries attribution", () => {
    const files = { "/repo/msg.txt": `feat: x\n\n${CO_AUTHOR}\n` };
    expect(bash("git commit -F msg.txt", undefined, files).decision).toBe("block");
    expect(bash("git commit --file=msg.txt", undefined, files).decision).toBe("block");
  });

  it("[NFR-MAINT-08] blocks a pull request whose description says it was generated", () => {
    const command = `gh pr create --title "WP-1.2: x" --body "Body\n\n${GENERATED}"`;
    expect(bash(command).decision).toBe("block");
  });

  it("[NFR-MAINT-08] blocks a pull request whose body file carries attribution", () => {
    const files = { "/repo/body.md": `Body\n\n${GENERATED}\n` };
    expect(bash("gh pr create --title t --body-file body.md", undefined, files).decision).toBe(
      "block",
    );
    expect(bash("gh pr edit 3 -F body.md", undefined, files).decision).toBe("block");
  });

  it.each([
    `gh issue comment 3 --body "${GENERATED}"`,
    `gh api repos/o/r/issues/3/comments -f body="${GENERATED}"`,
    `git commit --author="${CLAUDE} <bot@${"anthropic.com"}>" -m "feat: x"`,
  ])("[NFR-MAINT-08] blocks: %s", (command) => {
    expect(bash(command).decision).toBe("block");
  });

  it("[NFR-MAINT-08] allows a clean commit and a clean pull request", () => {
    expect(bash('git commit -m "feat(workspace): add console"').decision).toBe("allow");
    const files = { "/repo/body.md": "## What and why\n\nThe skeleton.\n" };
    expect(bash("gh pr create --title t --body-file body.md", undefined, files).decision).toBe(
      "allow",
    );
  });

  it("[NFR-MAINT-08] blocks a pull request whose body file cannot be read", () => {
    expect(bash("gh pr create --title t --body-file missing.md").decision).toBe("block");
  });
});

describe("other tools and commands", () => {
  it("[T-18] allows ordinary commands", () => {
    expect(bash("pnpm verify").decision).toBe("allow");
    expect(bash("ls -la src").decision).toBe("allow");
    expect(tool("Read", { file_path: "/repo/package.json" }).decision).toBe("allow");
  });
});

describe("hook entry point", () => {
  const script = join(import.meta.dirname, "claude-guard.mjs");
  const run = (payload: unknown) =>
    spawnSync("node", [script], { input: JSON.stringify(payload), encoding: "utf8" });

  it("[T-18] exits with code 2 and gives the reason on standard error when it blocks", () => {
    const result = run({ tool_name: "Bash", tool_input: { command: "git push --force" } });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("force push");
  });

  it("[T-18] exits with code 0 when it allows", () => {
    expect(run({ tool_name: "Bash", tool_input: { command: "ls" } }).status).toBe(0);
  });

  it("[T-18] blocks when its input cannot be parsed", () => {
    const result = spawnSync("node", [script], { input: "not json", encoding: "utf8" });
    expect(result.status).toBe(2);
  });
});
