#!/usr/bin/env node
// External checks of a running deployment (docs/spec/07-operations.md section
// 1.1, docs/spec/06-security-privacy.md section 5.6): the response headers,
// the script policy and its nonce, request IDs, the health endpoint, and the
// report endpoint. It reads only what any visitor can see, and the reports it
// sends are ones the endpoint refuses or ignores, so it adds nothing to the
// violation log.
//
// Usage:
//   infra-verify.mjs --url <base URL> [--page <path>] [--release <sha>] [--repo OWNER/REPO]
//
//   --url      the deployment to check, such as http://127.0.0.1:3100 or the
//              production address. The deploy workflow's smoke step runs this.
//   --page     an HTML page to check the policy on (default "/"). Any status
//              is accepted as long as the response is a page.
//   --release  the commit the address must serve, by /api/health. The deploy
//              smoke passes its own commit, so a deploy that never went live
//              fails instead of checking the previous one.
//   --repo     also check the repository settings of ADR-0029 and T-18 with
//              `gh api`: secret scanning, push protection, private
//              vulnerability reporting, interaction limits, no repository
//              secrets, and the three environments (main only; the owner
//              approves production). Needs Administration and Secrets read,
//              so the owner runs it.
//
// Exit codes: 0 every check passed, 1 a check failed, 2 usage error.

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** @typedef {{ name: string, status: "pass" | "fail" | "skip", detail: string }} Check */

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
const ONE_YEAR = 31_536_000;
/** No single request may take longer: a hung deployment fails the smoke, so it rolls back. */
const TIMEOUT_MS = 15_000;

/** The features turned off by Permissions-Policy (src/infrastructure/http/security-headers.ts). */
export const DISABLED_FEATURES = [
  "camera",
  "microphone",
  "geolocation",
  "payment",
  "usb",
  "display-capture",
  "browsing-topics",
];

const NONCE = "'nonce-*'";

/**
 * The policy of docs/spec/06-security-privacy.md section 5.2, a nonce written
 * as 'nonce-*'. `style-src-attr` may be absent: that is the stricter policy
 * WP-1.3 tries. The report directives are checked apart.
 * @type {ReadonlyMap<string, readonly string[]>}
 */
const EXPECTED_POLICY = new Map([
  ["default-src", ["'self'"]],
  ["script-src", ["'self'", NONCE, "'strict-dynamic'"]],
  ["style-src", ["'self'", NONCE]],
  ["style-src-attr", ["'unsafe-inline'"]],
  ["img-src", ["'self'", "data:"]],
  ["font-src", ["'self'"]],
  ["connect-src", ["'self'"]],
  ["worker-src", ["'self'"]],
  ["object-src", ["'none'"]],
  ["base-uri", ["'none'"]],
  ["form-action", ["'self'"]],
  ["frame-ancestors", ["'none'"]],
]);
const OPTIONAL_DIRECTIVES = new Set(["style-src-attr"]);
const REPORT_DIRECTIVES = new Set(["report-uri", "report-to"]);

/**
 * `fetch` that never follows a redirect and gives up after `timeoutMs`.
 * @param {number} timeoutMs
 */
const requester =
  (timeoutMs) =>
  /**
   * @param {string | URL} url
   * @param {RequestInit} [init]
   */
  (url, init = {}) =>
    fetch(url, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs), ...init });

/**
 * @param {string} header
 * @returns {Map<string, string[]>}
 */
export function parsePolicy(header) {
  /** @type {Map<string, string[]>} */
  const policy = new Map();
  for (const part of header.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) policy.set(name.toLowerCase(), values);
  }
  return policy;
}

/**
 * What is wrong with a page's policy, measured against
 * docs/spec/06-security-privacy.md section 5.2. Empty when nothing is.
 * @param {Map<string, string[]>} policy
 * @param {{ secure: boolean }} options  over HTTPS, `upgrade-insecure-requests` is required
 * @returns {string[]}
 */
export function policyProblems(policy, { secure }) {
  const problems = [];
  for (const [directive, expected] of EXPECTED_POLICY) {
    const values = policy.get(directive);
    if (values === undefined) {
      if (!OPTIONAL_DIRECTIVES.has(directive)) problems.push(`${directive} is absent`);
      continue;
    }
    const normalized = values.map((value) => (/^'nonce-[^']+'$/.test(value) ? NONCE : value));
    const same =
      normalized.length === expected.length &&
      normalized.every((value) => expected.includes(value));
    if (!same) {
      problems.push(`${directive} is ${values.join(" ") || "empty"}, not ${expected.join(" ")}`);
    }
  }
  if (secure && !policy.has("upgrade-insecure-requests")) {
    problems.push("upgrade-insecure-requests is absent");
  }
  if (!policy.has("report-uri") && !policy.has("report-to")) {
    problems.push("no report-uri or report-to");
  }
  for (const directive of policy.keys()) {
    if (
      !EXPECTED_POLICY.has(directive) &&
      !REPORT_DIRECTIVES.has(directive) &&
      directive !== "upgrade-insecure-requests"
    ) {
      problems.push(`unexpected directive ${directive}`);
    }
  }
  return problems;
}

/** @param {Map<string, string[]>} policy */
function nonceOf(policy) {
  const value = (policy.get("script-src") ?? []).find((item) => item.startsWith("'nonce-"));
  return value?.slice("'nonce-".length, -1);
}

/**
 * The script tags of a page that do not carry the page's nonce.
 * @param {string} html
 * @param {string} nonce
 * @returns {{ total: number, without: string[] }}
 */
export function scriptsWithoutNonce(html, nonce) {
  const tags = html.match(/<script\b[^>]*>/gi) ?? [];
  const without = tags.filter((tag) => {
    const match = /\snonce=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    return (match?.[1] ?? match?.[2] ?? match?.[3]) !== nonce;
  });
  return { total: tags.length, without };
}

/**
 * @param {string} name
 * @param {boolean} ok
 * @param {string} detail
 * @returns {Check}
 */
const check = (name, ok, detail) => ({ name, status: ok ? "pass" : "fail", detail });

/**
 * The headers of section 5.1 on one response.
 * @param {Headers} headers
 * @param {boolean} secure
 * @returns {Check[]}
 */
export function securityHeaderChecks(headers, secure) {
  const permissions = headers.get("permissions-policy") ?? "";
  const hsts = headers.get("strict-transport-security") ?? "";
  const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? "0");
  return [
    check(
      "X-Content-Type-Options",
      headers.get("x-content-type-options") === "nosniff",
      headers.get("x-content-type-options") ?? "absent",
    ),
    check(
      "Referrer-Policy",
      headers.get("referrer-policy") === "strict-origin-when-cross-origin",
      headers.get("referrer-policy") ?? "absent",
    ),
    check(
      "Permissions-Policy",
      DISABLED_FEATURES.every((feature) =>
        permissions.split(",").some((item) => item.trim() === `${feature}=()`),
      ),
      permissions || "absent",
    ),
    secure
      ? check(
          "Strict-Transport-Security",
          maxAge >= ONE_YEAR && /includeSubDomains/i.test(hsts),
          hsts || "absent",
        )
      : {
          name: "Strict-Transport-Security",
          status: "skip",
          detail: `not applicable over plain HTTP (sent: ${hsts || "absent"})`,
        },
  ];
}

/**
 * Runs every check against a running deployment.
 * @param {{ url: string, page?: string, release?: string, timeoutMs?: number }} options
 * @returns {Promise<Check[]>}  rejects when the deployment does not answer in time
 */
export async function verifyDeployment({ url, page = "/", release, timeoutMs = TIMEOUT_MS }) {
  const request = requester(timeoutMs);
  const base = new URL(url);
  const secure = base.protocol === "https:";
  /** @type {Check[]} */
  const checks = [];

  // The page and its script policy.
  const first = await request(new URL(page, base), {
    headers: { "x-request-id": "infra_verify_client_value" },
  });
  const html = await first.text();
  const isPage = (first.headers.get("content-type") ?? "").startsWith("text/html");
  checks.push(
    check(
      `page ${page} is HTML`,
      isPage,
      `${first.status} ${first.headers.get("content-type") ?? ""}`,
    ),
  );
  const header = first.headers.get("content-security-policy") ?? "";
  const policy = parsePolicy(header);
  const problems = header === "" ? ["absent"] : policyProblems(policy, { secure });
  checks.push(
    check("Content-Security-Policy", problems.length === 0, problems.join("; ") || header),
  );

  const nonce = nonceOf(policy);
  if (nonce === undefined) {
    checks.push(check("every script carries the nonce", false, "no nonce in the policy"));
  } else {
    const scripts = scriptsWithoutNonce(html, nonce);
    checks.push(
      check(
        "every script carries the nonce",
        scripts.total > 0 && scripts.without.length === 0,
        scripts.total === 0
          ? "the page has no script tag to check"
          : `${scripts.total - scripts.without.length} of ${scripts.total} scripts${
              scripts.without.length > 0
                ? `; without: ${scripts.without.slice(0, 3).join(" ")}`
                : ""
            }`,
      ),
    );
  }

  const second = await request(new URL(page, base));
  await second.arrayBuffer();
  const secondNonce = nonceOf(parsePolicy(second.headers.get("content-security-policy") ?? ""));
  checks.push(
    check(
      "a new nonce per request",
      nonce !== undefined && secondNonce !== undefined && nonce !== secondNonce,
      `${nonce ?? "none"} then ${secondNonce ?? "none"}`,
    ),
  );

  checks.push(...securityHeaderChecks(first.headers, secure));

  // A built file: next.config.ts gives static files the same headers, and
  // the proxy does not run for them.
  const staticPath = /<script[^>]*\ssrc=["'](\/_next\/static\/[^"']+)["']/i.exec(html)?.[1];
  if (staticPath === undefined) {
    checks.push(check("a static file carries the security headers", false, "no static script"));
  } else {
    const file = await request(new URL(staticPath, base));
    await file.arrayBuffer();
    const missing = securityHeaderChecks(file.headers, secure)
      .filter((item) => item.status === "fail")
      .map((item) => item.name);
    checks.push(
      check(
        "a static file carries the security headers",
        file.ok && missing.length === 0,
        `${file.status} ${staticPath}${missing.length > 0 ? `; missing: ${missing.join(", ")}` : ""}`,
      ),
    );
  }

  const id = first.headers.get("x-request-id") ?? "";
  const secondId = second.headers.get("x-request-id") ?? "";
  checks.push(
    check(
      "a request ID per request",
      REQUEST_ID.test(id) && REQUEST_ID.test(secondId) && id !== secondId,
      `${id || "absent"} then ${secondId || "absent"}`,
    ),
  );
  checks.push(
    check(
      "a client-sent request ID is replaced",
      id !== "infra_verify_client_value",
      id || "absent",
    ),
  );

  // The health endpoint.
  const health = await request(new URL("/api/health", base));
  const healthBody = await health.text();
  /** @type {unknown} */
  let healthJson;
  try {
    healthJson = JSON.parse(healthBody);
  } catch {
    healthJson = undefined;
  }
  const healthy =
    health.status === 200 &&
    typeof healthJson === "object" &&
    healthJson !== null &&
    "status" in healthJson &&
    healthJson.status === "ok";
  checks.push(
    check("/api/health answers ok", healthy, `${health.status} ${healthBody.slice(0, 80)}`),
  );
  const served =
    typeof healthJson === "object" &&
    healthJson !== null &&
    "release" in healthJson &&
    typeof healthJson.release === "string"
      ? healthJson.release
      : "absent";
  checks.push(
    release === undefined
      ? {
          name: "the address serves the expected release",
          status: "skip",
          detail: `no --release given (serves ${served})`,
        }
      : check(
          "the address serves the expected release",
          served === release,
          `${served}, expected ${release}`,
        ),
  );
  checks.push(
    check(
      "/api/health is not cached",
      (health.headers.get("cache-control") ?? "").includes("no-store"),
      health.headers.get("cache-control") ?? "absent",
    ),
  );
  checks.push(
    check(
      "/api/health carries nosniff",
      health.headers.get("x-content-type-options") === "nosniff",
      health.headers.get("x-content-type-options") ?? "absent",
    ),
  );

  // The report endpoint.
  const reportUrl = new URL("/api/csp-report", base);
  const post = (/** @type {string} */ type, /** @type {string} */ body) =>
    request(reportUrl, { method: "POST", headers: { "content-type": type }, body });
  // A report list with no violation in it: accepted, and nothing is logged.
  const accepted = await post(
    "application/reports+json",
    JSON.stringify([{ type: "infra-verify", age: 0, url: base.href, body: {} }]),
  );
  await accepted.arrayBuffer();
  checks.push(
    check("/api/csp-report accepts a report", accepted.status === 204, String(accepted.status)),
  );
  const malformed = await post("application/csp-report", '{"csp-report":"not a report"}');
  await malformed.arrayBuffer();
  checks.push(
    check(
      "/api/csp-report refuses a malformed report",
      malformed.status === 400,
      String(malformed.status),
    ),
  );
  // Just over the 8 kB of docs/spec/07-operations.md section 7.
  const oversize = await post("application/csp-report", "x".repeat(9000));
  await oversize.arrayBuffer();
  checks.push(
    check("/api/csp-report caps the size", oversize.status === 413, String(oversize.status)),
  );
  const get = await request(reportUrl);
  await get.arrayBuffer();
  checks.push(check("/api/csp-report refuses GET", get.status === 405, String(get.status)));

  return checks;
}

/**
 * @param {string} path
 * @returns {unknown}  undefined when the resource does not exist or cannot be read
 */
function ghApi(path) {
  try {
    return JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8", stdio: "pipe" }));
  } catch (error) {
    // The check that reads this then fails. Say why, so "absent" and "could
    // not be read" (no access, rate limit) can be told apart.
    const stderr =
      typeof error === "object" && error !== null && "stderr" in error ? String(error.stderr) : "";
    const reason = stderr.trim().split("\n")[0] || String(error);
    process.stderr.write(`gh api ${path}: ${reason}\n`);
    return undefined;
  }
}

/** The environments of docs/runbooks/infrastructure-setup.md; each may deploy from main only (T-18). */
export const ENVIRONMENTS = ["staging", "production", "production-backup"];

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
const record = (value) =>
  typeof value === "object" && value !== null ? /** @type {Record<string, unknown>} */ (value) : {};

/**
 * The repository settings of ADR-0029 and the environment rules of T-18,
 * read with `gh api`.
 * @param {string} repo
 * @param {(path: string) => unknown} [api]
 * @returns {Check[]}
 */
export function verifyRepository(repo, api = ghApi) {
  const analysis = record(record(api(`repos/${repo}`))["security_and_analysis"]);
  const status = (/** @type {string} */ key) => record(analysis[key])["status"];
  const limit = record(api(`repos/${repo}/interaction-limits`))["limit"];
  const reporting = record(api(`repos/${repo}/private-vulnerability-reporting`))["enabled"];
  const secrets = record(api(`repos/${repo}/actions/secrets`))["total_count"];
  const dependabotSecrets = record(api(`repos/${repo}/dependabot/secrets`))["total_count"];
  const forkApproval = record(
    api(`repos/${repo}/actions/permissions/fork-pr-contributor-approval`),
  )["approval_policy"];
  /** @type {Check[]} */
  const checks = [
    check(
      "secret scanning",
      status("secret_scanning") === "enabled",
      String(status("secret_scanning") ?? "absent"),
    ),
    check(
      "push protection",
      status("secret_scanning_push_protection") === "enabled",
      String(status("secret_scanning_push_protection") ?? "absent"),
    ),
    check("private vulnerability reporting", reporting === true, String(reporting)),
    check(
      "interactions limited to collaborators",
      limit === "collaborators_only",
      typeof limit === "string" ? limit : "no limit in force",
    ),
    check(
      "no repository-level secrets (they belong to an environment)",
      secrets === 0,
      secrets === undefined ? "could not be read" : `${String(secrets)} secrets`,
    ),
    check(
      "no Dependabot secrets",
      dependabotSecrets === 0,
      dependabotSecrets === undefined
        ? "could not be read"
        : `${String(dependabotSecrets)} secrets`,
    ),
    check(
      "workflows from every external contributor wait for approval",
      forkApproval === "all_external_contributors",
      typeof forkApproval === "string" ? forkApproval : "could not be read",
    ),
  ];
  for (const name of ENVIRONMENTS) {
    const environment = api(`repos/${repo}/environments/${name}`);
    if (environment === undefined) {
      checks.push(check(`environment ${name}`, false, "absent"));
      continue;
    }
    const branchPolicy = record(record(environment)["deployment_branch_policy"]);
    const policies = record(api(`repos/${repo}/environments/${name}/deployment-branch-policies`))[
      "branch_policies"
    ];
    const names = Array.isArray(policies)
      ? policies.map(
          (item) => `${String(record(item)["type"] ?? "branch")}:${String(record(item)["name"])}`,
        )
      : [];
    checks.push(
      check(
        `environment ${name} deploys from main only`,
        branchPolicy["custom_branch_policies"] === true &&
          branchPolicy["protected_branches"] === false &&
          names.length === 1 &&
          names[0] === "branch:main",
        names.length > 0 ? names.join(", ") : "no branch restriction",
      ),
    );
    if (name === "production") {
      const rules = record(environment)["protection_rules"];
      const reviewed =
        Array.isArray(rules) && rules.some((rule) => record(rule)["type"] === "required_reviewers");
      checks.push(
        check(
          "environment production needs the owner's approval",
          reviewed,
          reviewed ? "required reviewers" : "no required reviewer",
        ),
      );
    }
  }
  return checks;
}

/** @param {Check[]} checks */
function print(checks) {
  for (const { name, status, detail } of checks) {
    process.stdout.write(`${status.toUpperCase().padEnd(4)}  ${name}: ${detail}\n`);
  }
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
export async function main(argv) {
  /** @type {Record<string, string>} */
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) {
      process.stderr.write(
        "usage: infra-verify.mjs --url <base URL> [--page <path>] [--release <sha>] [--repo OWNER/REPO]\n",
      );
      return 2;
    }
    options[flag.slice(2)] = value;
  }
  const url = options["url"];
  if (url === undefined || !URL.canParse(url)) {
    process.stderr.write("infra-verify: --url must be an absolute URL\n");
    return 2;
  }
  /** @type {Check[]} */
  let checks;
  try {
    checks = await verifyDeployment({
      url,
      ...(options["page"] && { page: options["page"] }),
      ...(options["release"] && { release: options["release"] }),
    });
  } catch (error) {
    // A refused connection or a timeout: the deployment does not answer.
    checks = [
      check(
        "the deployment answers",
        false,
        error instanceof Error ? error.message : String(error),
      ),
    ];
  }
  if (options["repo"] !== undefined) checks.push(...verifyRepository(options["repo"]));
  print(checks);
  const failed = checks.filter((item) => item.status === "fail").length;
  process.stdout.write(
    failed === 0
      ? `\nAll ${checks.length} checks passed or do not apply.\n`
      : `\n${failed} of ${checks.length} checks failed.\n`,
  );
  return failed === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exit(await main(process.argv.slice(2)));
}
