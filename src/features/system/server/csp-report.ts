import "server-only";
import { z } from "zod";
import { parseRequestId, REQUEST_ID_HEADER } from "@/infrastructure/http/request-id";
import { log as serverLog, type Logger } from "@/infrastructure/logging/logger";
import { logRoute } from "@/infrastructure/logging/route";
import { readCapped } from "./read-capped";

// POST /api/csp-report (docs/spec/06-security-privacy.md section 5.2). Browsers
// send content security policy violations here in one of two formats: the
// legacy `report-uri` body (Firefox) and the Reporting API's list of reports
// (Chromium, WebKit). The body is untrusted: it is size-capped and parsed,
// and it is reduced to codes before anything is logged. An address in a
// report could hold personal data (.claude/rules/server.md), so none is
// kept: only the directive and the kind of thing that was blocked.

/** At most 8 kB (docs/spec/07-operations.md section 7). */
export const MAX_REPORT_BYTES = 8000;
/** Log lines one request may write. More violations than this are counted, not logged. */
export const MAX_LOGGED_VIOLATIONS = 10;

const LEGACY_TYPE = "application/csp-report";
const REPORTING_TYPE = "application/reports+json";

const text = z.string().max(2048);

const legacyReport = z.object({
  "csp-report": z.object({
    "blocked-uri": text.optional(),
    "effective-directive": text.optional(),
    "violated-directive": text.optional(),
    disposition: text.optional(),
  }),
});

const reportingApiReports = z
  .array(
    z.object({
      type: text,
      body: z.object({
        blockedURL: text.optional(),
        effectiveDirective: text.optional(),
        disposition: text.optional(),
      }),
    }),
  )
  .max(100);

export type BlockedKind =
  "inline" | "eval" | "wasm-eval" | "data" | "blob" | "self" | "external" | "other";

export type Violation = {
  directive: string;
  blocked: BlockedKind;
  enforced: boolean;
};

/**
 * The directive names of Content Security Policy Level 3, including the
 * effective directives browsers report (`script-src-elem`). Anything else in
 * a report is logged as `unknown`, so a report cannot write a word of its
 * own choosing into the log.
 */
export const DIRECTIVES: ReadonlySet<string> = new Set([
  "base-uri",
  "child-src",
  "connect-src",
  "default-src",
  "fenced-frame-src",
  "font-src",
  "form-action",
  "frame-ancestors",
  "frame-src",
  "img-src",
  "manifest-src",
  "media-src",
  "object-src",
  "report-to",
  "report-uri",
  "require-trusted-types-for",
  "sandbox",
  "script-src",
  "script-src-attr",
  "script-src-elem",
  "style-src",
  "style-src-attr",
  "style-src-elem",
  "trusted-types",
  "upgrade-insecure-requests",
  "webrtc",
  "worker-src",
]);
const KEYWORDS: ReadonlyMap<string, BlockedKind> = new Map([
  ["inline", "inline"],
  ["eval", "eval"],
  ["wasm-eval", "wasm-eval"],
  ["data", "data"],
  ["blob", "blob"],
]);

function blockedKind(value: string | undefined, origin: string): BlockedKind {
  if (value === undefined || value === "") return "other";
  const keyword = KEYWORDS.get(value.replace(/:$/, ""));
  if (keyword !== undefined) return keyword;
  if (!URL.canParse(value)) return "other";
  const url = new URL(value);
  const scheme = KEYWORDS.get(url.protocol.replace(/:$/, ""));
  if (scheme !== undefined) return scheme;
  return url.origin === origin ? "self" : "external";
}

function violation(
  directive: string | undefined,
  blocked: string | undefined,
  disposition: string | undefined,
  origin: string,
): Violation {
  return {
    directive: directive !== undefined && DIRECTIVES.has(directive) ? directive : "unknown",
    blocked: blockedKind(blocked, origin),
    enforced: disposition !== "report",
  };
}

export type ParseResult = { ok: true; violations: Violation[] } | { ok: false };

/** Parses a report body in either format. Reports of other types are ignored. */
export function parseCspReport(contentType: string, body: string, origin: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { ok: false };
  }
  if (contentType === LEGACY_TYPE) {
    const parsed = legacyReport.safeParse(json);
    if (!parsed.success) return { ok: false };
    const report = parsed.data["csp-report"];
    return {
      ok: true,
      violations: [
        violation(
          report["effective-directive"] ?? report["violated-directive"],
          report["blocked-uri"],
          report.disposition,
          origin,
        ),
      ],
    };
  }
  const parsed = reportingApiReports.safeParse(json);
  if (!parsed.success) return { ok: false };
  return {
    ok: true,
    violations: parsed.data
      .filter((report) => report.type === "csp-violation")
      .map(({ body: report }) =>
        violation(report.effectiveDirective, report.blockedURL, report.disposition, origin),
      ),
  };
}

export async function handleCspReport(
  request: Request,
  log: Logger = serverLog,
): Promise<Response> {
  const contentType = (request.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
  if (contentType !== LEGACY_TYPE && contentType !== REPORTING_TYPE) {
    return new Response(null, { status: 415 });
  }
  const body = await readCapped(request, MAX_REPORT_BYTES);
  if (body === undefined) return new Response(null, { status: 413 });
  const url = new URL(request.url);
  const result = parseCspReport(contentType, body, url.origin);
  if (!result.ok) return new Response(null, { status: 400 });

  const requestId = parseRequestId(request.headers.get(REQUEST_ID_HEADER)) ?? "none";
  const route = logRoute("POST", url.pathname);
  for (const { directive, blocked, enforced } of result.violations.slice(
    0,
    MAX_LOGGED_VIOLATIONS,
  )) {
    log({
      level: enforced ? "warn" : "info",
      requestId,
      route,
      outcome: `csp-violation:${directive}:${blocked}`,
    });
  }
  const unlogged = result.violations.length - MAX_LOGGED_VIOLATIONS;
  if (unlogged > 0) {
    log({ level: "warn", requestId, route, outcome: `csp-violation:more:${unlogged}` });
  }
  return new Response(null, { status: 204 });
}
