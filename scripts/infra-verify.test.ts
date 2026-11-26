import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  DISABLED_FEATURES as HEADER_FEATURES,
  IMMUTABLE,
  RUNTIME_STATIC_POLICY,
  workerContentSecurityPolicy,
} from "../src/infrastructure/http/security-headers";
import { RUNTIME_ASSET_BASE_URL, runtimeAssetBase, WORKER_URL } from "../src/runtime/assets";
import {
  DISABLED_FEATURES,
  parsePolicy,
  RELEASE_WAIT_MS,
  policyProblems,
  scriptsWithoutNonce,
  securityHeaderChecks,
  redirectProblems,
  verifyAuth,
  verifyDeployment,
  verifyRepository,
} from "./infra-verify.mjs";

const RELEASE = "0123456789abcdef0123456789abcdef01234567";

const GOOD_POLICY = (nonce: string, secure = false) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(secure ? ["upgrade-insecure-requests"] : []),
    "report-uri /api/csp-report",
    "report-to csp",
  ].join("; ");

const problems = (policy: string, secure = false) =>
  policyProblems(parsePolicy(policy), { secure });

describe("policy checks", () => {
  it("[NFR-SEC-02] passes the policy of the specification, and the stricter one without style-src-attr", () => {
    expect(problems(GOOD_POLICY("abc"))).toEqual([]);
    expect(problems(GOOD_POLICY("abc", true), true)).toEqual([]);
    expect(problems(GOOD_POLICY("abc").replace("style-src-attr 'unsafe-inline'; ", ""))).toEqual(
      [],
    );
  });

  it("[NFR-SEC-02] reports a script policy without a nonce, or with unsafe-inline or unsafe-eval", () => {
    for (const script of [
      "script-src 'self' 'strict-dynamic'",
      "script-src 'self' 'nonce-abc' 'strict-dynamic' 'unsafe-eval'",
      "script-src 'self' 'nonce-abc' 'unsafe-inline'",
    ]) {
      const policy = GOOD_POLICY("abc").replace(/script-src [^;]+/, script);
      expect(problems(policy), script).toEqual([
        `${script.replace(/^script-src /, "script-src is ")}, not 'self' 'nonce-*' 'strict-dynamic'`,
      ]);
    }
  });

  it("[NFR-SEC-02] [T-01] reports a widened directive: connect-src, img-src, worker-src, form-action", () => {
    expect(problems(GOOD_POLICY("abc").replace("connect-src 'self'", "connect-src *"))).toEqual([
      "connect-src is *, not 'self'",
    ]);
    expect(problems(GOOD_POLICY("abc").replace("img-src 'self' data:", "img-src *"))).toEqual([
      "img-src is *, not 'self' data:",
    ]);
    expect(problems(GOOD_POLICY("abc").replace("worker-src 'self'; ", ""))).toEqual([
      "worker-src is absent",
    ]);
    expect(problems(GOOD_POLICY("abc").replace("form-action 'self'", "form-action *"))).toEqual([
      "form-action is *, not 'self'",
    ]);
  });

  it("[NFR-SEC-02] reports a directive the specification does not have, such as script-src-elem", () => {
    expect(problems(`${GOOD_POLICY("abc")}; script-src-elem 'unsafe-inline'`)).toEqual([
      "unexpected directive script-src-elem",
    ]);
  });

  it("[T-15] reports a policy that allows framing", () => {
    expect(
      problems(GOOD_POLICY("abc").replace("frame-ancestors 'none'", "frame-ancestors *")),
    ).toEqual(["frame-ancestors is *, not 'none'"]);
  });

  it("[NFR-SEC-02] requires upgrade-insecure-requests over HTTPS, and a report directive", () => {
    expect(problems(GOOD_POLICY("abc"), true)).toEqual(["upgrade-insecure-requests is absent"]);
    expect(
      problems(GOOD_POLICY("abc").replace("; report-uri /api/csp-report; report-to csp", "")),
    ).toEqual(["no report-uri or report-to"]);
  });

  it("[NFR-SEC-02] finds script tags without the page's nonce", () => {
    const html = `<script nonce="abc" src="/a.js"></script><script>inline()</script><script nonce='zzz'></script>`;
    expect(scriptsWithoutNonce(html, "abc")).toEqual({
      total: 3,
      without: ["<script>", "<script nonce='zzz'>"],
    });
  });
});

const STATIC_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": HEADER_FEATURES.map((feature) => `${feature}=()`).join(", "),
  "strict-transport-security": "max-age=63072000; includeSubDomains",
};

const headerFailures = (headers: Record<string, string>, secure: boolean) =>
  securityHeaderChecks(new Headers(headers), secure)
    .filter((item) => item.status === "fail")
    .map((item) => item.name);

describe("security header checks", () => {
  it("[NFR-SEC-02] checks the same features the application turns off", () => {
    expect(DISABLED_FEATURES).toEqual([...HEADER_FEATURES]);
  });

  it("[NFR-SEC-02] passes the headers of section 5.1 over HTTPS", () => {
    expect(headerFailures(STATIC_HEADERS, true)).toEqual([]);
  });

  it("[NFR-SEC-02] fails a short or partial HSTS over HTTPS", () => {
    for (const hsts of ["max-age=3600; includeSubDomains", "max-age=63072000", ""]) {
      expect(
        headerFailures({ ...STATIC_HEADERS, "strict-transport-security": hsts }, true),
        hsts,
      ).toEqual(["Strict-Transport-Security"]);
    }
  });

  it("[NFR-SEC-02] fails a missing nosniff, referrer policy, or turned-off feature", () => {
    const { "x-content-type-options": _n, ...noSniff } = STATIC_HEADERS;
    expect(headerFailures(noSniff, false)).toEqual(["X-Content-Type-Options"]);
    expect(headerFailures({ ...STATIC_HEADERS, "referrer-policy": "unsafe-url" }, false)).toEqual([
      "Referrer-Policy",
    ]);
    expect(
      headerFailures(
        { ...STATIC_HEADERS, "permissions-policy": "camera=(), microphone=(), geolocation=()" },
        false,
      ),
    ).toEqual(["Permissions-Policy"]);
  });
});

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => {
    if (server === undefined) resolve();
    else {
      server.closeAllConnections();
      server.close(() => resolve());
    }
  });
  server = undefined;
});

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

async function serve(handler: Handler): Promise<string> {
  server = createServer(handler);
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server?.address() as AddressInfo).port}`;
}

type Broken =
  | "inline-script"
  | "fixed-nonce"
  | "echo-id"
  | "health-down"
  | "health-cached"
  | "old-release"
  | "no-nosniff"
  | "no-size-cap"
  | "accepts-anything"
  | "hangs"
  | "no-policy"
  | "wide-policy"
  | "no-script"
  | "fixed-id"
  | "health-no-nosniff"
  | "report-200"
  | "get-200"
  | "not-html"
  | "static-bare"
  | "worker-page-policy"
  | "worker-cached"
  | "runtime-mutable"
  | "runtime-miss-bare";

/** A server that behaves as the application should. `broken` names one thing it gets wrong. */
function application(broken?: Broken): Handler {
  let counter = 0;
  return (request, response) => {
    if (broken === "hangs") return;
    counter += 1;
    const nonce = broken === "fixed-nonce" ? "fixed" : `nonce${counter}`;
    const id =
      broken === "echo-id"
        ? String(request.headers["x-request-id"])
        : broken === "fixed-id"
          ? "request_fixed_id"
          : `request_${counter}_id`;
    const { "x-content-type-options": _nosniff, ...withoutNosniff } = STATIC_HEADERS;
    const common = {
      ...(broken === "no-nosniff" ? withoutNosniff : STATIC_HEADERS),
      "x-request-id": id,
    };
    const path = request.url ?? "/";
    if (path === "/_next/static/a.js") {
      response.writeHead(200, {
        ...(broken === "static-bare" ? {} : STATIC_HEADERS),
        "content-type": "application/javascript",
      });
      response.end("");
      return;
    }
    if (path === WORKER_URL) {
      response.writeHead(200, {
        ...STATIC_HEADERS,
        "content-type": "text/javascript",
        "content-security-policy":
          broken === "worker-page-policy"
            ? GOOD_POLICY(nonce)
            : workerContentSecurityPolicy(RUNTIME_ASSET_BASE_URL),
        "cache-control": broken === "worker-cached" ? IMMUTABLE : "no-cache",
      });
      response.end("");
      return;
    }
    if (path === `${runtimeAssetBase}manifest.json`) {
      response.writeHead(200, {
        ...STATIC_HEADERS,
        "content-type": "application/json",
        "content-security-policy": RUNTIME_STATIC_POLICY,
        "cache-control": broken === "runtime-mutable" ? "public, max-age=0" : IMMUTABLE,
      });
      response.end("{}");
      return;
    }
    if (path.startsWith("/_runtime/")) {
      response.writeHead(404, {
        ...STATIC_HEADERS,
        "content-type": "text/html; charset=utf-8",
        ...(broken === "runtime-miss-bare"
          ? {}
          : { "content-security-policy": RUNTIME_STATIC_POLICY }),
      });
      response.end("<html></html>");
      return;
    }
    if (path === "/api/health") {
      response.writeHead(broken === "health-down" ? 500 : 200, {
        ...(broken === "health-no-nosniff" ? withoutNosniff : common),
        "content-type": "application/json",
        "cache-control": broken === "health-cached" ? "public, max-age=60" : "no-store",
      });
      const release = broken === "old-release" ? "f".repeat(40) : RELEASE;
      response.end(JSON.stringify({ status: "ok", release }));
      return;
    }
    if (path === "/api/csp-report") {
      if (request.method !== "POST") {
        response.writeHead(broken === "get-200" ? 200 : 405, common).end();
        return;
      }
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const body = Buffer.concat(chunks).toString();
        const tooLarge = body.length > 8000 && broken !== "no-size-cap";
        const malformed = body.includes("not a report") && broken !== "accepts-anything";
        const ok = broken === "report-200" ? 200 : 204;
        response.writeHead(tooLarge ? 413 : malformed ? 400 : ok, common).end();
      });
      return;
    }
    const policy =
      broken === "wide-policy"
        ? GOOD_POLICY(nonce).replace("connect-src 'self'", "connect-src *")
        : GOOD_POLICY(nonce);
    response.writeHead(404, {
      ...common,
      "content-type": broken === "not-html" ? "application/json" : "text/html; charset=utf-8",
      ...(broken === "no-policy" ? {} : { "content-security-policy": policy }),
    });
    const extra = broken === "inline-script" ? "<script>alert(1)</script>" : "";
    const script =
      broken === "no-script" ? "" : `<script nonce="${nonce}" src="/_next/static/a.js"></script>`;
    response.end(`<html><body>${script}${extra}</body></html>`);
  };
}

const failed = (checks: { name: string; status: string }[]) =>
  checks.filter((item) => item.status === "fail").map((item) => item.name);

describe("verifyDeployment", () => {
  it("[NFR-SEC-02] [FR-SYS-04] [NFR-OBS-01] passes a deployment that does everything right", async () => {
    const checks = await verifyDeployment({ url: await serve(application()), release: RELEASE });
    expect(failed(checks)).toEqual([]);
    expect(checks.find((item) => item.name === "Strict-Transport-Security")?.status).toBe("skip");
  });

  it.each<[Broken, string]>([
    ["inline-script", "every script carries the nonce"],
    ["fixed-nonce", "a new nonce per request"],
    ["health-down", "/api/health answers ok"],
    ["health-cached", "/api/health is not cached"],
    ["no-nosniff", "X-Content-Type-Options"],
    ["no-size-cap", "/api/csp-report caps the size"],
    ["accepts-anything", "/api/csp-report refuses a malformed report"],
    ["no-policy", "Content-Security-Policy"],
    ["wide-policy", "Content-Security-Policy"],
    ["no-script", "every script carries the nonce"],
    ["fixed-id", "a request ID per request"],
    ["health-no-nosniff", "/api/health carries nosniff"],
    ["report-200", "/api/csp-report accepts a report"],
    ["get-200", "/api/csp-report refuses GET"],
    ["not-html", "page / is HTML"],
    ["static-bare", "a static file carries the security headers"],
    ["worker-page-policy", "the Python worker carries its own policy"],
    ["worker-cached", "the Python worker is revalidated"],
    ["runtime-mutable", "the runtime files are immutable"],
    ["runtime-miss-bare", "a miss under the runtime's path carries a policy"],
  ])(
    "[NFR-SEC-02] [FR-SYS-04] fails a deployment that gets one thing wrong: %s",
    async (broken, name) => {
      const checks = await verifyDeployment({
        url: await serve(application(broken)),
        release: RELEASE,
      });
      expect(failed(checks)).toContain(name);
    },
  );

  it("[NFR-REL-04] fails when the address serves another release than the one deployed", async () => {
    const checks = await verifyDeployment({
      url: await serve(application("old-release")),
      release: RELEASE,
      releaseWaitMs: 300,
      releasePollMs: 50,
    });
    expect(failed(checks)).toEqual(["the address serves the expected release"]);
  });

  it("[NFR-REL-04] waits up to 60 s for a promoted release to go live", () => {
    expect(RELEASE_WAIT_MS).toBe(60_000);
  });

  it("[NFR-REL-04] asks again until the address serves the new release, then checks it", async () => {
    let healthRequests = 0;
    const live = application();
    const old = application("old-release");
    const promoting: Handler = (request, response) => {
      if (request.url === "/api/health") healthRequests += 1;
      // The first three answers come from the previous deployment.
      (request.url === "/api/health" && healthRequests <= 3 ? old : live)(request, response);
    };
    const checks = await verifyDeployment({
      url: await serve(promoting),
      release: RELEASE,
      releaseWaitMs: 5_000,
      releasePollMs: 20,
    });
    expect(failed(checks)).toEqual([]);
    expect(healthRequests).toBe(4);
    expect(
      checks.find((item) => item.name === "the address serves the expected release")?.detail,
    ).toMatch(/after 4 requests/);
  });

  it("[NFR-REL-04] asks again after a refused or failed health request inside the wait", async () => {
    let healthRequests = 0;
    const live = application();
    const flaky: Handler = (request, response) => {
      if (request.url === "/api/health") {
        healthRequests += 1;
        if (healthRequests === 1) {
          request.socket.destroy();
          return;
        }
      }
      live(request, response);
    };
    const checks = await verifyDeployment({
      url: await serve(flaky),
      release: RELEASE,
      releaseWaitMs: 5_000,
      releasePollMs: 20,
    });
    expect(failed(checks)).toEqual([]);
    expect(healthRequests).toBe(2);
  });

  it("[NFR-REL-04] keeps asking until the wait is over, then fails", async () => {
    let healthRequests = 0;
    const old = application("old-release");
    const counting: Handler = (request, response) => {
      if (request.url === "/api/health") healthRequests += 1;
      old(request, response);
    };
    const started = Date.now();
    const checks = await verifyDeployment({
      url: await serve(counting),
      release: RELEASE,
      releaseWaitMs: 400,
      releasePollMs: 50,
    });
    expect(Date.now() - started).toBeGreaterThanOrEqual(400);
    expect(healthRequests).toBeGreaterThan(2);
    expect(failed(checks)).toEqual(["the address serves the expected release"]);
  });

  it("[NFR-REL-04] gives up when every health request fails until the wait is over", async () => {
    let healthRequests = 0;
    const refusing: Handler = (request) => {
      if (request.url === "/api/health") healthRequests += 1;
      request.socket.destroy();
    };
    const started = Date.now();
    await expect(
      verifyDeployment({
        url: await serve(refusing),
        release: RELEASE,
        releaseWaitMs: 300,
        releasePollMs: 50,
      }),
    ).rejects.toThrow(/fetch failed/);
    expect(Date.now() - started).toBeGreaterThanOrEqual(300);
    expect(healthRequests).toBeGreaterThan(2);
  });

  it("[NFR-REL-04] asks the health endpoint once when no release is given", async () => {
    let healthRequests = 0;
    const old = application("old-release");
    const counting: Handler = (request, response) => {
      if (request.url === "/api/health") healthRequests += 1;
      old(request, response);
    };
    const checks = await verifyDeployment({ url: await serve(counting), releasePollMs: 20 });
    expect(failed(checks)).toEqual([]);
    expect(healthRequests).toBe(1);
  });

  it("[NFR-OBS-01] fails a deployment that echoes the client's request ID", async () => {
    const checks = await verifyDeployment({ url: await serve(application("echo-id")) });
    expect(failed(checks)).toContain("a client-sent request ID is replaced");
  });

  it("[NFR-REL-04] gives up on a deployment that does not answer", async () => {
    await expect(
      verifyDeployment({ url: await serve(application("hangs")), timeoutMs: 200 }),
    ).rejects.toThrow(/timeout|aborted/i);
  });
});

const GOOD_REPOSITORY: Record<string, unknown> = {
  "repos/o/r": {
    security_and_analysis: {
      secret_scanning: { status: "enabled" },
      secret_scanning_push_protection: { status: "enabled" },
    },
  },
  "repos/o/r/interaction-limits": { limit: "collaborators_only" },
  "repos/o/r/private-vulnerability-reporting": { enabled: true },
  "repos/o/r/actions/secrets": { total_count: 0, secrets: [] },
  "repos/o/r/dependabot/secrets": { total_count: 0, secrets: [] },
  "repos/o/r/actions/permissions/fork-pr-contributor-approval": {
    approval_policy: "all_external_contributors",
  },
  ...Object.fromEntries(
    ["staging", "production", "production-backup"].flatMap((name) => [
      [
        `repos/o/r/environments/${name}`,
        {
          name,
          deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
          protection_rules:
            name === "production" ? [{ type: "required_reviewers", reviewers: [] }] : [],
        },
      ],
      [
        `repos/o/r/environments/${name}/deployment-branch-policies`,
        { total_count: 1, branch_policies: [{ name: "main", type: "branch" }] },
      ],
    ]),
  ),
};

const repositoryFailures = (changes: Record<string, unknown>) =>
  failed(verifyRepository("o/r", (path) => ({ ...GOOD_REPOSITORY, ...changes })[path]));

describe("verifyRepository", () => {
  it("[NFR-SEC-04] [T-18] passes when every setting and every environment is as the runbook says", () => {
    expect(repositoryFailures({})).toEqual([]);
  });

  it("[NFR-SEC-04] fails when the interaction limit has expired", () => {
    expect(repositoryFailures({ "repos/o/r/interaction-limits": {} })).toEqual([
      "interactions limited to collaborators",
    ]);
  });

  it("[T-18] fails a Dependabot secret, or one that cannot be read", () => {
    for (const value of [{ total_count: 2 }, undefined]) {
      expect(repositoryFailures({ "repos/o/r/dependabot/secrets": value })).toEqual([
        "no Dependabot secrets",
      ]);
    }
  });

  it("[T-18] fails unless workflows from every external contributor need approval", () => {
    for (const policy of ["first_time_contributors", "first_time_contributors_new_to_github"]) {
      expect(
        repositoryFailures({
          "repos/o/r/actions/permissions/fork-pr-contributor-approval": { approval_policy: policy },
        }),
        policy,
      ).toEqual(["workflows from every external contributor wait for approval"]);
    }
  });

  it("[T-18] fails a repository-level secret", () => {
    expect(repositoryFailures({ "repos/o/r/actions/secrets": { total_count: 1 } })).toEqual([
      "no repository-level secrets (they belong to an environment)",
    ]);
  });

  it("[T-18] fails an environment that is missing, open to every branch, or open to another branch", () => {
    expect(repositoryFailures({ "repos/o/r/environments/staging": undefined })).toEqual([
      "environment staging",
    ]);
    expect(
      repositoryFailures({
        "repos/o/r/environments/production-backup": {
          deployment_branch_policy: null,
          protection_rules: [],
        },
        "repos/o/r/environments/production-backup/deployment-branch-policies": undefined,
      }),
    ).toEqual(["environment production-backup deploys from main only"]);
    expect(
      repositoryFailures({
        "repos/o/r/environments/staging/deployment-branch-policies": {
          branch_policies: [
            { name: "main", type: "branch" },
            { name: "wp/*", type: "branch" },
          ],
        },
      }),
    ).toEqual(["environment staging deploys from main only"]);
  });

  it("[T-18] fails a production environment the owner does not approve", () => {
    expect(
      repositoryFailures({
        "repos/o/r/environments/production": {
          deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
          protection_rules: [{ type: "wait_timer", wait_timer: 0 }],
        },
      }),
    ).toEqual(["environment production needs the owner's approval"]);
  });
});

const SITE = "https://heapacademy.dev";
const TEMPLATE = readFileSync("supabase/templates/sign-in-code.html", "utf8");
// The runbook's production settings, with the secrets the API also returns.
const GOOD_AUTH = {
  site_url: SITE,
  uri_allow_list: `${SITE}/auth/callback`,
  mailer_otp_exp: 600,
  mailer_otp_length: 6,
  rate_limit_email_sent: 20,
  security_captcha_enabled: true,
  security_captcha_provider: "turnstile",
  security_captcha_secret: "captcha-secret-value",
  external_email_enabled: true,
  disable_signup: false,
  mailer_autoconfirm: false,
  smtp_host: "smtp.resend.com",
  smtp_port: "465",
  smtp_admin_email: "signin@heapacademy.dev",
  smtp_pass: "smtp-secret-value",
  external_google_enabled: true,
  external_google_secret: "google-secret-value",
  mfa_totp_enroll_enabled: true,
  mfa_totp_verify_enabled: true,
  mfa_phone_enroll_enabled: false,
  mailer_subjects_magic_link: "Your Heap Academy sign-in code",
  mailer_subjects_confirmation: "Your Heap Academy sign-in code",
  mailer_templates_magic_link_content: TEMPLATE,
  mailer_templates_confirmation_content: TEMPLATE,
};

const authFailures = (changes: Record<string, unknown>) =>
  verifyAuth({ ...GOOD_AUTH, ...changes }, SITE)
    .filter((item) => item.status === "fail")
    .map((item) => item.name);

describe("verifyAuth", () => {
  it("[T-11] passes the runbook's settings, and prints none of the secrets", () => {
    const checks = verifyAuth(GOOD_AUTH, SITE);
    expect(checks.filter((item) => item.status === "fail")).toEqual([]);
    const printed = JSON.stringify(checks);
    for (const secret of ["captcha-secret-value", "smtp-secret-value", "google-secret-value"]) {
      expect(printed).not.toContain(secret);
    }
  });

  it("[T-11] fails when the configuration cannot be read", () => {
    expect(verifyAuth(undefined, SITE)).toEqual([
      { name: "the auth configuration can be read", status: "fail", detail: "could not be read" },
    ]);
  });

  it("[T-11] fails the bot challenge turned off", () => {
    expect(authFailures({ security_captcha_enabled: false })).toEqual(["bot challenge on"]);
  });

  it("[T-11] [FR-AUTH-02] fails a code lifetime, a length or an email limit other than the runbook's", () => {
    expect(authFailures({ mailer_otp_exp: 3600 })).toEqual(["email code lifetime 600 s"]);
    expect(authFailures({ mailer_otp_length: 8 })).toEqual(["email code length 6"]);
    expect(authFailures({ rate_limit_email_sent: 30 })).toEqual([
      "email sends per hour 20 (ADR-0029)",
    ]);
  });

  it("[T-11] fails closed sign-up and turned-off email confirmation", () => {
    expect(authFailures({ disable_signup: true })).toEqual([
      "new users may sign up (T-11: one answer for every address)",
    ]);
    expect(authFailures({ mailer_autoconfirm: true })).toEqual(["confirm email on"]);
  });

  it("[FR-AUTH-02] fails a template with a link or without the code", () => {
    expect(
      authFailures({
        mailer_templates_magic_link_content: '<a href="{{ .ConfirmationURL }}">x</a>',
      }),
    ).toEqual(["magic link email shows the code and no link (FR-AUTH-02)"]);
    expect(authFailures({ mailer_templates_confirmation_content: "<p>Hello</p>" })).toEqual([
      "confirm signup email shows the code and no link (FR-AUTH-02)",
    ]);
  });

  it("[T-11] fails a redirect list without this site's callback, or with a wildcard over vercel.app", () => {
    const name = "redirect addresses: this site's callback, no wildcard over vercel.app";
    expect(authFailures({ uri_allow_list: "" })).toEqual([name]);
    expect(
      authFailures({ uri_allow_list: `${SITE}/auth/callback,https://*.vercel.app/auth/callback` }),
    ).toEqual([name]);
    expect(authFailures({ site_url: "http://localhost:3000" })).toEqual(["site URL is this site"]);
  });

  it("[NFR-SEC-04] accepts the runbook's preview pattern for one account, and nothing wider", () => {
    expect(
      redirectProblems(
        `${SITE}/auth/callback, https://heap-academy-*-fahads-projects.vercel.app/auth/callback`,
        SITE,
      ),
    ).toEqual([]);
    expect(
      redirectProblems(
        [
          "https://*.vercel.app/auth/callback",
          "https://heap-academy-*.vercel.app/auth/callback",
          "https://**",
          `${SITE}/**`,
          "http://heapacademy.dev/auth/callback",
        ].join(","),
        SITE,
      ),
    ).toEqual([
      "https://*.vercel.app/auth/callback",
      "https://heap-academy-*.vercel.app/auth/callback",
      "https://**",
      `${SITE}/**`,
      "http://heapacademy.dev/auth/callback",
    ]);
  });

  it("[T-11] fails the second step without the authenticator app, or with phone codes on", () => {
    expect(authFailures({ mfa_totp_verify_enabled: false })).toEqual([
      "authenticator app verification on",
    ]);
    expect(authFailures({ mfa_phone_enroll_enabled: true })).toEqual(["phone second step off"]);
  });
});
