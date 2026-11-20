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
    const base = step(job(text, "static"), "The checks from the base commit");
    expect(base).toContain(
      'if git cat-file -e "$base:$file" 2>/dev/null; then source=$base; else source=HEAD; fi',
    );
    expect(base).toContain('git show "$source:$file"');
    expect(base).toContain(
      "for file in scripts/check-attribution.mjs .gitleaks.toml scripts/install-gitleaks.sh; do",
    );
    // The ignore file comes from the base or not at all.
    expect(base).toContain('git show "$base:.gitleaksignore"');
    expect(base).not.toContain('git show "$source:.gitleaksignore"');
    expect(text).not.toMatch(/node scripts\/check-attribution\.mjs/);
    expect(text).not.toMatch(/--config \.gitleaks\.toml/);
    expect(job(text, "static")).not.toMatch(/^\s*(?:run: )?scripts\/install-gitleaks\.sh/m);
  });

  it("[T-12] [T-13] the secret scan cannot be silenced from the pull request", () => {
    const scan = step(job(read("ci.yml"), "static"), "Secret scan of the commits");
    expect(scan).toContain('"$RUNNER_TEMP/bin/gitleaks" git');
    expect(scan).toContain('--config "$RUNNER_TEMP/checks/.gitleaks.toml"');
    expect(scan).toContain('--gitleaks-ignore-path "$RUNNER_TEMP/checks/ignore"');
    expect(scan).toContain("--ignore-gitleaks-allow");
    expect(step(job(read("ci.yml"), "static"), "Install gitleaks")).toContain(
      'sh "$RUNNER_TEMP/checks/install-gitleaks.sh" "$RUNNER_TEMP/bin"',
    );
  });

  it("[T-13] the base-commit checks run before any step runs the pull request's code", () => {
    const text = job(read("ci.yml"), "static");
    const firstPullRequestCode = text.indexOf("run: pnpm install --frozen-lockfile");
    expect(firstPullRequestCode).toBeGreaterThan(0);
    for (const name of [
      "The checks from the base commit",
      "Attribution in the commits",
      "Attribution in the pull request title and description",
      "Attribution in the files",
      "Install gitleaks",
      "Secret scan of the commits",
    ]) {
      const position = text.indexOf(`name: ${name}\n`);
      expect(position, name).toBeGreaterThan(0);
      expect(position, name).toBeLessThan(firstPullRequestCode);
    }
  });

  it("[NFR-REL-04] the deploy promotes what it deployed, and rolls back only on failure or cancel", () => {
    const production = job(read("deploy.yml"), "production");
    expect(step(production, "Deploy")).toContain(
      "url=$(vercel deploy --prebuilt --prod --skip-domain)",
    );
    expect(step(production, "Promote")).toContain('run: vercel promote "$DEPLOYMENT" --yes');
    expect(step(production, "Promote")).toContain("DEPLOYMENT: ${{ steps.deploy.outputs.url }}");
    const rollback = step(production, "Roll back to the previous deployment");
    expect(rollback).toContain(
      "if: (failure() || cancelled()) && steps.promote.outcome != 'skipped' && steps.previous.outputs.id != ''",
    );
    expect(rollback).toContain('vercel rollback "$PREVIOUS"');
    expect(rollback).toContain("PREVIOUS: ${{ steps.previous.outputs.id }}");
  });

  it("[NFR-REL-04] only a 404 for the production alias means there is nothing to roll back to", () => {
    const lookup = step(
      job(read("deploy.yml"), "production"),
      "Remember the deployment production serves",
    );
    expect(lookup).toContain("--write-out '%{http_code}'");
    expect(lookup).not.toContain('|| id=""');
    expect(lookup).toMatch(/ {12}404\)\n {14}id=""\n {14}echo "::warning::/);
    expect(lookup).toMatch(/ {12}\*\)\n {14}echo "::error::[^\n]*\n {14}exit 1\n/);
    expect(lookup).toContain("jq --raw-output --exit-status '.deploymentId | strings'");
  });

  it("[T-18] each deploy job names its own environment, so production needs the owner's approval", () => {
    const text = read("deploy.yml");
    expect(job(text, "staging-migrations")).toMatch(/^ {4}environment: staging$/m);
    expect(job(text, "production")).toMatch(/^ {4}environment:\n {6}name: production$/m);
  });

  it("[T-18] the deploy stays off until the owner sets DEPLOY_ENABLED, and production waits for it", () => {
    const text = read("deploy.yml");
    expect(job(text, "staging-migrations")).toMatch(/^ {4}if: vars\.DEPLOY_ENABLED == 'true'$/m);
    // Skipped with the first job, because it needs it.
    expect(job(text, "production")).toMatch(/^ {4}needs: staging-migrations$/m);
    expect(job(text, "production")).not.toMatch(/^ {4}if:/m);
  });

  it("[NFR-SEC-02] the build fails on any prerendered page", () => {
    const build = job(read("ci.yml"), "build");
    expect(step(build, "No prerendered page")).toContain(
      "run: node scripts/check-static.mjs .next",
    );
    expect(build.indexOf("- run: pnpm build")).toBeLessThan(
      build.indexOf("name: No prerendered page"),
    );
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
