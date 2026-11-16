import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { DISABLED_FEATURES as HEADER_FEATURES } from "../src/infrastructure/http/security-headers";
import {
  DISABLED_FEATURES,
  parsePolicy,
  policyProblems,
  scriptsWithoutNonce,
  securityHeaderChecks,
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
  | "hangs";

/** A server that behaves as the application should. `broken` names one thing it gets wrong. */
function application(broken?: Broken): Handler {
  let counter = 0;
  return (request, response) => {
    if (broken === "hangs") return;
    counter += 1;
    const nonce = broken === "fixed-nonce" ? "fixed" : `nonce${counter}`;
    const id =
      broken === "echo-id" ? String(request.headers["x-request-id"]) : `request_${counter}_id`;
    const { "x-content-type-options": _nosniff, ...withoutNosniff } = STATIC_HEADERS;
    const common = {
      ...(broken === "no-nosniff" ? withoutNosniff : STATIC_HEADERS),
      "x-request-id": id,
    };
    const path = request.url ?? "/";
    if (path === "/api/health") {
      response.writeHead(broken === "health-down" ? 500 : 200, {
        ...common,
        "content-type": "application/json",
        "cache-control": broken === "health-cached" ? "public, max-age=60" : "no-store",
      });
      const release = broken === "old-release" ? "f".repeat(40) : RELEASE;
      response.end(JSON.stringify({ status: "ok", release }));
      return;
    }
    if (path === "/api/csp-report") {
      if (request.method !== "POST") {
        response.writeHead(405, common).end();
        return;
      }
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const body = Buffer.concat(chunks).toString();
        const tooLarge = body.length > 16 * 1024 && broken !== "no-size-cap";
        const malformed = body.includes("not a report") && broken !== "accepts-anything";
        response.writeHead(tooLarge ? 413 : malformed ? 400 : 204, common).end();
      });
      return;
    }
    response.writeHead(404, {
      ...common,
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": GOOD_POLICY(nonce),
    });
    const extra = broken === "inline-script" ? "<script>alert(1)</script>" : "";
    response.end(
      `<html><body><script nonce="${nonce}" src="/_next/a.js"></script>${extra}</body></html>`,
    );
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
    });
    expect(failed(checks)).toEqual(["the address serves the expected release"]);
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
