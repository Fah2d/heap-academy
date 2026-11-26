// The response headers of docs/spec/06-security-privacy.md section 5.1 and the
// one script policy of section 5.2 (ADR-0028, NFR-SEC-02, T-15). proxy.ts sets
// the policy per request, with a fresh nonce; next.config.ts sets the rest on
// every response, static files included.

export const CSP_REPORT_PATH = "/api/csp-report";
/** The Reporting API group name the policy's `report-to` directive refers to. */
export const CSP_REPORT_GROUP = "csp";

export type PolicyOptions = {
  nonce: string;
  /** The development server needs `unsafe-eval` for React's debugging; production never gets it. */
  development: boolean;
  /** Over plain HTTP (the local production server) there is nothing to upgrade to. */
  secure: boolean;
  /** The sign-in page also frames the bot challenge (section 5.2, FR-AUTH-06). */
  signInPage?: boolean;
};

/** Where the bot challenge, Cloudflare Turnstile, serves its frame. */
export const BOT_CHALLENGE_ORIGIN = "https://challenges.cloudflare.com";
export const SIGN_IN_PATH = "/sign-in";

/**
 * Whether a path is in the admin area. Its pages carry admin data and, at
 * setup, the second step's key, so no cache may keep them (FR-ADM-02,
 * docs/spec/06-security-privacy.md section 5.1).
 */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** A nonce of 128 random bits, base64 encoded. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

const NONCE_SOURCE = /'nonce-([A-Za-z0-9+/]+={0,2})'/;

/** The nonce in a policy this proxy wrote, or undefined when there is none. */
export function nonceFromPolicy(policy: string | null | undefined): string | undefined {
  return typeof policy === "string" ? NONCE_SOURCE.exec(policy)?.[1] : undefined;
}

export function contentSecurityPolicy({
  nonce,
  development,
  secure,
  signInPage = false,
}: PolicyOptions): string {
  const directives: string[][] = [
    ["default-src", "'self'"],
    [
      "script-src",
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(development ? ["'unsafe-eval'"] : []),
    ],
    ["style-src", "'self'", `'nonce-${nonce}'`],
    // Inline style attributes only: React Aria positions overlays with them
    // (section 5.2). Style elements still need the nonce.
    ["style-src-attr", "'unsafe-inline'"],
    ["img-src", "'self'", "data:"],
    ["font-src", "'self'"],
    ["connect-src", "'self'"],
    ["worker-src", "'self'"],
    // Its script loads by this request's nonce, like every other script.
    ...(signInPage ? [["frame-src", BOT_CHALLENGE_ORIGIN]] : []),
    ["object-src", "'none'"],
    ["base-uri", "'none'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
    ...(secure ? [["upgrade-insecure-requests"]] : []),
    // report-uri for Firefox, which does not implement report-to.
    ["report-uri", CSP_REPORT_PATH],
    ["report-to", CSP_REPORT_GROUP],
  ];
  return directives.map((directive) => directive.join(" ")).join("; ");
}

/** The `Reporting-Endpoints` header that names the policy's report group. */
export function reportingEndpoints(origin: string): string {
  return `${CSP_REPORT_GROUP}="${new URL(CSP_REPORT_PATH, origin).href}"`;
}

/** Features the product never uses. Each is turned off for the page and every frame. */
export const DISABLED_FEATURES = [
  "camera",
  "microphone",
  "geolocation",
  "payment",
  "usb",
  "display-capture",
  "browsing-topics",
] as const;

/** The headers every response carries, whatever its type (section 5.1). */
export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  // Two years. Browsers ignore it over plain HTTP, so local servers are unaffected.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: DISABLED_FEATURES.map((feature) => `${feature}=()`).join(", "),
  },
];

/**
 * The Python worker script's own policy (section 5.1, threat T-01). A worker
 * loaded from a URL takes its policy from its own response, not from the page
 * (architecture section 14, pitfall 7). WebAssembly needs
 * `'wasm-unsafe-eval'` (E-07); nothing allows `unsafe-eval`, so evaluating
 * JavaScript from Python is refused. Network requests may only reach the
 * origin, or the runtime's host when it moves to one.
 */
export function workerContentSecurityPolicy(runtimeAssetBase: string): string {
  const sources = [
    "'self'",
    ...(runtimeAssetBase.startsWith("https://") ? [new URL(runtimeAssetBase).origin] : []),
  ];
  return [
    ["default-src", "'none'"],
    ["script-src", ...sources, "'wasm-unsafe-eval'"],
    ["connect-src", ...sources],
    ["frame-ancestors", "'none'"],
    ["report-uri", CSP_REPORT_PATH],
  ]
    .map((directive) => directive.join(" "))
    .join("; ");
}

/**
 * For every other response under the runtime's path. The proxy skips that
 * path, so a request for a file that is not there would otherwise get the
 * not-found page with no policy at all (T-15). Nothing under it is a page:
 * the policy of a module or WebAssembly response does not apply to the
 * worker that loads it.
 */
export const RUNTIME_STATIC_POLICY = "default-src 'none'; frame-ancestors 'none'; sandbox";

/** A year: the runtime files' path carries their version, so they never change. */
export const IMMUTABLE = "public, max-age=31536000, immutable";

/**
 * Headers for the runtime's files (section 5.1): everything under the
 * runtime's path gets a static policy, the Pyodide files are immutable, and
 * the worker's compiled `.js` files carry its own policy and are checked
 * again on every load, because their paths do not change between releases.
 * A path under the worker's folder that does not end in `.js`, such as most
 * misses, keeps the static policy (WP-3.1 security review 2, MINOR 3). A miss
 * that ends in `.js` gets the worker's policy: no `sandbox`, but no inline
 * script and no framing either.
 *
 * Order matters: when two rules set the same header, Next.js uses the later
 * one ("the last header key will override the first", headers docs), so the
 * worker's rule comes last.
 */
export function runtimeHeaders({
  runtimeRoot,
  runtimeAssetBase,
  workerDirectory,
}: {
  runtimeRoot: string;
  runtimeAssetBase: string;
  workerDirectory: string;
}): { source: string; headers: { key: string; value: string }[] }[] {
  const everything = {
    source: `${runtimeRoot}:path*`,
    headers: [{ key: "Content-Security-Policy", value: RUNTIME_STATIC_POLICY }],
  };
  const worker = {
    source: `${workerDirectory}:path+.js`,
    headers: [
      { key: "Content-Security-Policy", value: workerContentSecurityPolicy(runtimeAssetBase) },
      { key: "Cache-Control", value: "no-cache" },
    ],
  };
  if (!runtimeAssetBase.startsWith("/")) return [everything, worker];
  return [
    everything,
    { source: `${runtimeAssetBase}:path*`, headers: [{ key: "Cache-Control", value: IMMUTABLE }] },
    worker,
  ];
}
