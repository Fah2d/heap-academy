import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The rules for pipelines in .claude/rules/ci.md, checked on the workflow
// files themselves (T-13, T-18). Read as text: each rule is about one line.

const FOLDER = join(".github", "workflows");
const files = readdirSync(FOLDER).filter((name) => name.endsWith(".yml"));
const read = (name: string) => readFileSync(join(FOLDER, name), "utf8");

/** The job IDs: keys indented by two spaces under `jobs:`. */
function jobs(text: string): string[] {
  const body = text.slice(text.indexOf("\njobs:\n"));
  return [...body.matchAll(/^ {2}([a-z][a-z0-9-]*):\s*$/gm)].map((match) => match[1] ?? "");
}

/** The text of one job, up to the next job. */
function job(text: string, id: string): string {
  const start = text.indexOf(`\n  ${id}:\n`);
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/^ {2}[a-z][a-z0-9-]*:\s*$/m);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

/** The steps of a workflow: each starts at a `      - ` line. */
function steps(text: string): string[] {
  return text
    .split(/\n(?= {6}- )/)
    .slice(1)
    .map((item) => {
      // A job's last step ends where a line is indented less than a step.
      const end = item.search(/\n {0,5}\S/);
      return end === -1 ? item : item.slice(0, end);
    });
}

/** One named step of a job. */
function step(text: string, name: string): string {
  return steps(text).find((item) => item.includes(`name: ${name}\n`)) ?? "";
}

describe("workflows", () => {
  it("[T-13] exist", () => {
    expect(files.sort()).toEqual(["ci.yml", "deploy.yml"]);
  });

  it.each(files)("[T-13] %s pins every action to a full commit with its version", (name) => {
    const uses = read(name)
      .split("\n")
      .filter((line) => /^\s*-?\s*uses:/.test(line));
    expect(uses.length).toBeGreaterThan(0);
    for (const line of uses) {
      expect(line).toMatch(/uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/);
    }
  });

  it.each(files)("[T-18] %s grants no permission by default", (name) => {
    expect(read(name)).toMatch(/^permissions: \{\}$/m);
  });

  it.each(files)("[T-18] %s gives every job a timeout and its own permissions", (name) => {
    const text = read(name);
    for (const id of jobs(text)) {
      expect(job(text, id), id).toMatch(/^ {4}timeout-minutes: \d+$/m);
      expect(job(text, id), id).toMatch(/^ {4}permissions:/m);
    }
  });

  it.each(files)("[T-18] %s uses no trigger that hands secrets to a fork", (name) => {
    expect(read(name)).not.toMatch(
      /^\s*(?:pull_request_target|workflow_run|issue_comment|pull_request_review):/m,
    );
  });

  it("[NFR-SEC-04] the pull request workflow names the required checks and holds no secret", () => {
    const text = read("ci.yml");
    expect(jobs(text)).toEqual(["static", "unit", "build"]);
    for (const id of ["static", "unit", "build"]) {
      expect(job(text, id)).toContain(`    name: ${id}\n`);
    }
    expect(text).not.toMatch(/\$\{\{\s*secrets\./);
    expect(text).toMatch(/types: \[opened, synchronize, reopened, edited\]/);
  });

  it.each(files)(
    "[T-13] %s puts no expression inside a script, so no event text can run",
    (name) => {
      for (const item of steps(read(name))) {
        const script = item.slice(Math.max(0, item.indexOf("run:")));
        if (!item.includes("run:")) continue;
        expect(script, item.split("\n")[0]).not.toMatch(/\$\{\{/);
      }
    },
  );

  it.each(files)("[T-13] %s keeps no Git credential after checkout", (name) => {
    for (const item of steps(read(name)).filter((entry) => entry.includes("actions/checkout@"))) {
      expect(item).toMatch(/persist-credentials: false/);
    }
  });

  it.each(files)(
    "[T-18] %s never names the backup environment, which only the backup uses",
    (name) => {
      expect(read(name)).not.toContain("production-backup");
    },
  );

  it("[T-13] the pull request checks read their rules from the base commit", () => {
    const text = read("ci.yml");
    expect(text).toMatch(/git show "\$source:\$file"/);
    expect(text).not.toMatch(/node scripts\/check-attribution\.mjs/);
    expect(text).not.toMatch(/--config \.gitleaks\.toml/);
  });

  it("[T-18] the deploy workflow restores no cache, keeps its order, and never runs twice at once", () => {
    const text = read("deploy.yml");
    expect(text).not.toMatch(/^\s*cache:/m);
    // Actions that write a cache or an artifact, or install tools outside a lockfile.
    expect(text).not.toMatch(/actions\/cache|upload-artifact|setup-cli|setup-bun|pnpm dlx|npx /);
    expect(text).toMatch(/cancel-in-progress: false/);
    expect(jobs(text)).toEqual(["staging-migrations", "production"]);
    const production = job(text, "production");
    expect(production).toContain("needs: staging-migrations");
    const order = [
      "Apply migrations to production",
      "Remember the deployment production serves",
      "Build",
      "No server variable in a browser bundle",
      "Deploy",
      "Promote",
      "Smoke production",
      "Roll back",
    ];
    const positions = order.map((step) => production.indexOf(`name: ${step}`));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("[T-12] [NFR-REL-04] the build gets no Vercel token, and the smoke checks this commit is live", () => {
    const production = job(read("deploy.yml"), "production");
    expect(step(production, "Build")).toContain("HEAP_RELEASE: ${{ github.sha }}");
    expect(step(production, "Build")).not.toContain("VERCEL_TOKEN");
    expect(step(production, "No server variable in a browser bundle")).not.toContain(
      "VERCEL_TOKEN",
    );
    expect(step(production, "Smoke production")).toContain('--release "$GITHUB_SHA"');
    expect(production).not.toMatch(/--token/);
  });

  it("[T-18] Vercel's own production deploy from Git is off, so the database moves first", () => {
    const config: unknown = JSON.parse(readFileSync("vercel.json", "utf8"));
    expect(config).toMatchObject({ git: { deploymentEnabled: { main: false } } });
  });
});
