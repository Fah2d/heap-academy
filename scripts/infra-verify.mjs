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
//                    [--auth <project ref>]
//
//   --url      the deployment to check, such as http://127.0.0.1:3100 or the
//              production address. The deploy workflow's smoke step runs this.
//   --page     an HTML page to check the policy on (default "/"). Any status
//              is accepted as long as the response is a page.
//   --release  the commit the address must serve, by /api/health. The deploy
//              smoke passes its own commit, so a deploy that never went live
//              fails instead of checking the previous one. A promotion takes
//              a few seconds to reach the address, so the script asks again
//              for up to 60 s before it runs the other checks or fails.
//   --repo     also check the repository settings of ADR-0029 and T-18 with
//              `gh api`: secret scanning, push protection, private
//              vulnerability reporting, interaction limits, no repository
//              secrets, and the three environments (main only; the owner
//              approves production). Needs Administration and Secrets read,
//              so the owner runs it.
//   --auth     also check the auth provider settings of the Supabase project
//              with this reference (WP-7.1, T-11; docs/runbooks/
//              infrastructure-setup.md section 10): redirect addresses, code
//              length and lifetime, the email limit, the bot challenge, the
//              email sender and templates, sign-up, and the second step. It
//              reads the project's auth configuration through the Supabase
//              Management API with SUPABASE_ACCESS_TOKEN from the environment
//              (the owner's token, with auth configuration read), and prints
//              no secret it holds.
//
// Exit codes: 0 every check passed, 1 a check failed, 2 usage error.

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  IMMUTABLE,
  RUNTIME_STATIC_POLICY,
  workerContentSecurityPolicy,
} from "../src/infrastructure/http/security-headers.ts";
import {
  RUNTIME_ASSET_BASE_URL,
  RUNTIME_ROOT,
  runtimeAssetBase,
  WORKER_URL,
} from "../src/runtime/assets.ts";

/** @typedef {{ name: string, status: "pass" | "fail" | "skip", detail: string }} Check */

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
const ONE_YEAR = 31_536_000;
/** No single request may take longer: a hung deployment fails the smoke, so it rolls back. */
const TIMEOUT_MS = 15_000;
/** How long the address may take to serve a just-promoted release. */
export const RELEASE_WAIT_MS = 60_000;
/** The pause between two health requests while waiting for the release. */
const RELEASE_POLL_MS = 5_000;

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
 * The Python runtime's files (section 5.1, ADR-0033): the worker script
 * carries its own policy and is revalidated, the Pyodide files are immutable,
 * and a miss under the runtime's path still carries a policy.
 * @param {URL} base
 * @param {(url: URL) => Promise<Response>} request
 */
async function runtimeChecks(base, request) {
  const worker = await request(new URL(WORKER_URL, base));
  await worker.arrayBuffer();
  const workerPolicy = worker.headers.get("content-security-policy") ?? "absent";
  const workerCache = worker.headers.get("cache-control") ?? "absent";
  const manifest = await request(new URL(`${runtimeAssetBase}manifest.json`, base));
  await manifest.arrayBuffer();
  const manifestCache = manifest.headers.get("cache-control") ?? "absent";
  const miss = await request(new URL(`${RUNTIME_ROOT}infra-verify-missing`, base));
  await miss.arrayBuffer();
  const missPolicy = miss.headers.get("content-security-policy") ?? "absent";
  return [
    check(
      "the Python worker carries its own policy",
      worker.ok && workerPolicy === workerContentSecurityPolicy(RUNTIME_ASSET_BASE_URL),
      `${worker.status} ${workerPolicy}`,
    ),
    check("the Python worker is revalidated", workerCache === "no-cache", workerCache),
    check(
      "the runtime files are immutable",
      manifest.ok &&
        manifestCache === IMMUTABLE &&
        manifest.headers.get("x-content-type-options") === "nosniff",
      `${manifest.status} ${manifestCache}`,
    ),
    check(
      "a miss under the runtime's path carries a policy",
      missPolicy === RUNTIME_STATIC_POLICY,
      `${miss.status} ${missPolicy}`,
    ),
  ];
}

/**
 * The release /api/health names, or "absent".
 * @param {unknown} json
 */
const releaseOf = (json) =>
  typeof json === "object" && json !== null && "release" in json && typeof json.release === "string"
    ? json.release
    : "absent";

/** @param {string} body */
function parseJson(body) {
  try {
    return /** @type {unknown} */ (JSON.parse(body));
  } catch {
    return undefined;
  }
}

/**
 * Asks /api/health until it names `release` or `waitMs` has passed, so the
 * other checks run against the deployment that was just promoted. Without a
 * release it asks once. A failed request inside the wait is asked again; the
 * last one's error is thrown when the wait ends on it.
 * @param {(url: string | URL, init?: RequestInit) => Promise<Response>} request
 * @param {URL} base
 * @param {{ release: string | undefined, waitMs: number, pollMs: number }} options
 * @returns {Promise<{ health: Response, body: string, requests: number, waitedMs: number }>}
 */
async function healthFor(request, base, { release, waitMs, pollMs }) {
  const started = Date.now();
  for (let requests = 1; ; requests += 1) {
    /** @type {{ health: Response, body: string } | undefined} */
    let answer;
    try {
      const health = await request(new URL("/api/health", base));
      answer = { health, body: await health.text() };
    } catch (error) {
      if (release === undefined || Date.now() - started >= waitMs) throw error;
    }
    const waitedMs = Date.now() - started;
    if (
      answer !== undefined &&
      (release === undefined || releaseOf(parseJson(answer.body)) === release || waitedMs >= waitMs)
    ) {
      return { ...answer, requests, waitedMs };
    }
    // The last request goes out when the wait ends, not a pause after it.
    const pause = Math.max(0, Math.min(pollMs, waitMs - waitedMs));
    await new Promise((resolve) => setTimeout(resolve, pause));
  }
}

/**
 * Runs every check against a running deployment.
 * @param {{ url: string, page?: string, release?: string, timeoutMs?: number, releaseWaitMs?: number, releasePollMs?: number }} options
 * @returns {Promise<Check[]>}  rejects when the deployment does not answer in time
 */
export async function verifyDeployment({
  url,
  page = "/",
  release,
  timeoutMs = TIMEOUT_MS,
  releaseWaitMs = RELEASE_WAIT_MS,
  releasePollMs = RELEASE_POLL_MS,
}) {
  const request = requester(timeoutMs);
  const base = new URL(url);
  const secure = base.protocol === "https:";
  /** @type {Check[]} */
  const checks = [];

  // The health endpoint first: with a release, it waits for the promotion.
  const {
    health,
    body: healthBody,
    requests: healthRequests,
    waitedMs,
  } = await healthFor(request, base, {
    release,
    waitMs: releaseWaitMs,
    pollMs: releasePollMs,
  });

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

  checks.push(...(await runtimeChecks(base, request)));

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

  // The health endpoint, as asked above.
  const healthJson = parseJson(healthBody);
  const healthy =
    health.status === 200 &&
    typeof healthJson === "object" &&
    healthJson !== null &&
    "status" in healthJson &&
    healthJson.status === "ok";
  checks.push(
    check("/api/health answers ok", healthy, `${health.status} ${healthBody.slice(0, 80)}`),
  );
  const served = releaseOf(healthJson);
  const asked =
    healthRequests === 1
      ? "after 1 request"
      : `after ${healthRequests} requests in ${(waitedMs / 1000).toFixed(1)} s`;
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
          `${served}, expected ${release}, ${asked}`,
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

/** The auth settings of docs/runbooks/infrastructure-setup.md section 10. */
export const AUTH_SETTINGS = {
  otpSeconds: 600,
  otpLength: 6,
  emailsPerHour: 20,
  smtpHost: "smtp.resend.com",
  smtpPort: "465",
  sender: "signin@heapacademy.dev",
  subject: "Your Heap Academy sign-in code",
};

/**
 * Reads a project's auth configuration from the Supabase Management API.
 * @param {string} ref
 * @param {string} token
 * @returns {Promise<unknown>}  undefined when it cannot be read
 */
async function managementAuthConfig(ref, token) {
  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}/config/auth`,
      {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      process.stderr.write(`Supabase auth config of ${ref}: HTTP ${String(response.status)}\n`);
      return undefined;
    }
    return await response.json();
  } catch (error) {
    process.stderr.write(
      `Supabase auth config of ${ref}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return undefined;
  }
}

/**
 * The redirect addresses: this site's /auth/callback, or the runbook's
 * preview pattern for this project and one Vercel account
 * (`https://heap-academy-*-<account>.vercel.app/auth/callback`), never a
 * wildcard over all of vercel.app (docs/spec/07-operations.md section 1).
 * @param {string} list  comma-separated, as the provider stores it
 * @param {string} origin
 * @returns {string[]}  the entries that break the rule
 */
export function redirectProblems(list, origin) {
  const preview =
    /^https:\/\/heap-academy-\*-[a-z0-9]+(?:-[a-z0-9]+)*\.vercel\.app\/auth\/callback$/;
  return list
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
    .filter((entry) => entry !== `${origin}/auth/callback` && !preview.test(entry));
}

/**
 * The auth provider settings of T-11 and section 10 of the setup runbook.
 * Details name values that are not secret; the SMTP password and the
 * challenge secret are never read into a detail.
 * @param {unknown} config  the Management API's answer, or undefined
 * @param {string} origin  the site's origin, from --url
 * @returns {Check[]}
 */
export function verifyAuth(config, origin) {
  if (config === undefined) {
    return [check("the auth configuration can be read", false, "could not be read")];
  }
  const value = record(config);
  const shown = (/** @type {string} */ key) => {
    const item = value[key];
    return item === undefined || item === null ? "absent" : String(item);
  };
  const is = (
    /** @type {string} */ key,
    /** @type {unknown} */ expected,
    /** @type {string} */ name,
  ) => check(name, value[key] === expected, shown(key));
  const list = typeof value["uri_allow_list"] === "string" ? value["uri_allow_list"] : "";
  const entries = list
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  const wrong = redirectProblems(list, origin);
  /** @type {Check[]} */
  const checks = [
    is("site_url", origin, "site URL is this site"),
    check(
      "redirect addresses: this site's callback, no wildcard over vercel.app",
      entries.includes(`${origin}/auth/callback`) && wrong.length === 0,
      wrong.length > 0
        ? `not allowed: ${wrong.join(", ")}`
        : entries.length === 0
          ? "none"
          : entries.join(", "),
    ),
    is("mailer_otp_exp", AUTH_SETTINGS.otpSeconds, "email code lifetime 600 s"),
    is("mailer_otp_length", AUTH_SETTINGS.otpLength, "email code length 6"),
    is("rate_limit_email_sent", AUTH_SETTINGS.emailsPerHour, "email sends per hour 20 (ADR-0029)"),
    is("security_captcha_enabled", true, "bot challenge on"),
    is("security_captcha_provider", "turnstile", "bot challenge is Turnstile"),
    is("external_email_enabled", true, "email sign-in on"),
    is("disable_signup", false, "new users may sign up (T-11: one answer for every address)"),
    is("mailer_autoconfirm", false, "confirm email on"),
    is("smtp_host", AUTH_SETTINGS.smtpHost, "email sender host"),
    is("smtp_port", AUTH_SETTINGS.smtpPort, "email sender port"),
    is("smtp_admin_email", AUTH_SETTINGS.sender, "email sender address"),
    is("external_google_enabled", true, "Google sign-in on"),
    is("mfa_totp_enroll_enabled", true, "authenticator app enrollment on"),
    is("mfa_totp_verify_enabled", true, "authenticator app verification on"),
    is("mfa_phone_enroll_enabled", false, "phone second step off"),
  ];
  for (const [kind, label] of [
    ["magic_link", "magic link"],
    ["confirmation", "confirm signup"],
  ]) {
    const subject = value[`mailer_subjects_${kind}`];
    const body = value[`mailer_templates_${kind}_content`];
    checks.push(
      check(
        `${label} email subject`,
        subject === AUTH_SETTINGS.subject,
        shown(`mailer_subjects_${kind}`),
      ),
      check(
        `${label} email shows the code and no link (FR-AUTH-02)`,
        typeof body === "string" &&
          body.includes("{{ .Token }}") &&
          !body.includes("{{ .ConfirmationURL }}"),
        typeof body !== "string"
          ? "absent"
          : body.includes("{{ .ConfirmationURL }}")
            ? "has a link"
            : body.includes("{{ .Token }}")
              ? "code, no link"
              : "no code",
      ),
    );
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
        "usage: infra-verify.mjs --url <base URL> [--page <path>] [--release <sha>] [--repo OWNER/REPO] [--auth <project ref>]\n",
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
  const ref = options["auth"];
  if (ref !== undefined) {
    const token = process.env["SUPABASE_ACCESS_TOKEN"];
    if (token === undefined || token === "") {
      process.stderr.write("infra-verify: --auth needs SUPABASE_ACCESS_TOKEN\n");
      return 2;
    }
    checks.push(...verifyAuth(await managementAuthConfig(ref, token), new URL(url).origin));
  }
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
