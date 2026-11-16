#!/usr/bin/env node
// External checks of a running deployment (docs/spec/07-operations.md section
// 1.1, docs/spec/06-security-privacy.md section 5.6): the response headers,
// the script policy and its nonce, request IDs, the health endpoint, and the
// report endpoint. It reads only what any visitor can see.
//
// Usage:
//   infra-verify.mjs --url <base URL> [--page <path>] [--repo OWNER/REPO]
//
//   --url    the deployment to check, such as http://127.0.0.1:3100 or the
//            production address. The deploy workflow's smoke step runs this.
//   --page   an HTML page to check the policy on (default "/"). Any status is
//            accepted as long as the response is a page.
//   --repo   also check the repository settings of ADR-0029 with `gh api`:
//            interaction limits, secret scanning, push protection, and
//            private vulnerability reporting. Needs a login with
//            Administration read, so the owner runs it.
//
// Exit codes: 0 every check passed, 1 a check failed, 2 usage error.

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** @typedef {{ name: string, status: "pass" | "fail" | "skip", detail: string }} Check */

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
const ONE_YEAR = 31_536_000;

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
 * @returns {string[]}
 */
export function policyProblems(policy) {
  const problems = [];
  const script = policy.get("script-src") ?? [];
  if (!script.some((value) => /^'nonce-[^']+'$/.test(value))) {
    problems.push("script-src has no nonce");
  }
  if (!script.includes("'strict-dynamic'")) problems.push("script-src lacks 'strict-dynamic'");
  for (const unsafe of ["'unsafe-inline'", "'unsafe-eval'"]) {
    if (script.includes(unsafe)) problems.push(`script-src allows ${unsafe}`);
  }
  if ((policy.get("style-src") ?? []).includes("'unsafe-inline'")) {
    problems.push("style-src allows 'unsafe-inline'");
  }
  /** @type {[string, string][]} */
  const exact = [
    ["default-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'none'"],
    ["frame-ancestors", "'none'"],
  ];
  for (const [directive, value] of exact) {
    const values = policy.get(directive);
    if (values?.length !== 1 || values[0] !== value) {
      problems.push(`${directive} is not ${value}`);
    }
  }
  if (!policy.has("report-uri") && !policy.has("report-to")) {
    problems.push("no report-uri or report-to");
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
 * @param {Headers} headers
 * @param {boolean} secure
 * @returns {Check[]}
 */
function securityHeaderChecks(headers, secure) {
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
      ["camera=()", "microphone=()", "geolocation=()"].every((item) => permissions.includes(item)),
      permissions || "absent",
    ),
    secure
      ? check("Strict-Transport-Security", maxAge >= ONE_YEAR, hsts || "absent")
      : {
          name: "Strict-Transport-Security",
          status: "skip",
          detail: `not applicable over plain HTTP (sent: ${hsts || "absent"})`,
        },
  ];
}

/**
 * Runs every check against a running deployment.
 * @param {{ url: string, page?: string }} options
 * @returns {Promise<Check[]>}
 */
export async function verifyDeployment({ url, page = "/" }) {
  const base = new URL(url);
  const secure = base.protocol === "https:";
  /** @type {Check[]} */
  const checks = [];

  // The page and its script policy.
  const first = await fetch(new URL(page, base), {
    redirect: "manual",
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
  const problems = header === "" ? ["absent"] : policyProblems(policy);
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

  const second = await fetch(new URL(page, base), { redirect: "manual" });
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
  const health = await fetch(new URL("/api/health", base), { redirect: "manual" });
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
  const sample = JSON.stringify({
    "csp-report": {
      "document-uri": new URL("/infra-verify", base).href,
      "blocked-uri": "inline",
      "effective-directive": "script-src-elem",
      disposition: "report",
    },
  });
  const accepted = await fetch(reportUrl, {
    method: "POST",
    headers: { "content-type": "application/csp-report" },
    body: sample,
  });
  await accepted.arrayBuffer();
  checks.push(
    check("/api/csp-report accepts a report", accepted.status === 204, String(accepted.status)),
  );
  const oversize = await fetch(reportUrl, {
    method: "POST",
    headers: { "content-type": "application/csp-report" },
    body: "x".repeat(64 * 1024),
  });
  await oversize.arrayBuffer();
  checks.push(
    check("/api/csp-report caps the size", oversize.status === 413, String(oversize.status)),
  );
  const get = await fetch(reportUrl);
  await get.arrayBuffer();
  checks.push(check("/api/csp-report refuses GET", get.status === 405, String(get.status)));

  return checks;
}

/**
 * @param {string} path
 * @returns {unknown}
 */
function ghApi(path) {
  return JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8" }));
}

/**
 * The repository settings of ADR-0029, read with `gh api`.
 * @param {string} repo
 * @param {(path: string) => unknown} [api]
 * @returns {Check[]}
 */
export function verifyRepository(repo, api = ghApi) {
  const repository =
    /** @type {{ security_and_analysis?: Record<string, { status?: string }> }} */ (
      api(`repos/${repo}`)
    );
  const analysis = repository.security_and_analysis ?? {};
  const limits = /** @type {{ limit?: string }} */ (api(`repos/${repo}/interaction-limits`));
  const reporting = /** @type {{ enabled?: boolean }} */ (
    api(`repos/${repo}/private-vulnerability-reporting`)
  );
  return [
    check(
      "secret scanning",
      analysis["secret_scanning"]?.status === "enabled",
      analysis["secret_scanning"]?.status ?? "absent",
    ),
    check(
      "push protection",
      analysis["secret_scanning_push_protection"]?.status === "enabled",
      analysis["secret_scanning_push_protection"]?.status ?? "absent",
    ),
    check("private vulnerability reporting", reporting.enabled === true, String(reporting.enabled)),
    check(
      "interactions limited to collaborators",
      limits.limit === "collaborators_only",
      limits.limit ?? "no limit in force",
    ),
  ];
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
        "usage: infra-verify.mjs --url <base URL> [--page <path>] [--repo OWNER/REPO]\n",
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
  const checks = await verifyDeployment({ url, ...(options["page"] && { page: options["page"] }) });
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
