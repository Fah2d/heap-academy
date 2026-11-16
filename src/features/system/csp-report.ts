import "server-only";
import { z } from "zod";
import { parseRequestId, REQUEST_ID_HEADER } from "@/infrastructure/http/request-id";
import { log as serverLog, type Logger } from "@/infrastructure/logging/logger";

// POST /api/csp-report (docs/spec/06-security-privacy.md section 5.2). Browsers
// send content security policy violations here in one of two formats: the
// legacy `report-uri` body (Firefox) and the Reporting API's list of reports
// (Chromium, WebKit). Each violation becomes one log line. The body is
// untrusted, so it is size-capped and parsed, and only the directive and the
// origin and path of the two addresses are kept: a query string can carry a
// token or an email address.

/** Larger than any real report; a browser batches a handful at most. */
export const MAX_REPORT_BYTES = 16 * 1024;

const LEGACY_TYPE = "application/csp-report";
const REPORTING_TYPE = "application/reports+json";

const text = z.string().max(2048);

const legacyReport = z.object({
  "csp-report": z.object({
    "document-uri": text.optional(),
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
        documentURL: text.optional(),
        blockedURL: text.optional(),
        effectiveDirective: text.optional(),
        disposition: text.optional(),
      }),
    }),
  )
  .max(100);

export type Violation = {
  directive: string;
  blocked: string;
  document: string;
  disposition: string;
};

/** The origin and path of an address; a keyword such as `inline` or `eval` as it is. */
function withoutQuery(value: string | undefined): string {
  if (value === undefined || value === "") return "unknown";
  if (!URL.canParse(value)) return value.slice(0, 64);
  const url = new URL(value);
  return url.protocol === "http:" || url.protocol === "https:"
    ? `${url.origin}${url.pathname}`
    : url.protocol.replace(/:$/, "");
}

export type ParseResult = { ok: true; violations: Violation[] } | { ok: false };

/** Parses a report body in either format. Reports of other types are ignored. */
export function parseCspReport(contentType: string, body: string): ParseResult {
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
        {
          directive: report["effective-directive"] ?? report["violated-directive"] ?? "unknown",
          blocked: withoutQuery(report["blocked-uri"]),
          document: withoutQuery(report["document-uri"]),
          disposition: report.disposition ?? "unknown",
        },
      ],
    };
  }
  const parsed = reportingApiReports.safeParse(json);
  if (!parsed.success) return { ok: false };
  return {
    ok: true,
    violations: parsed.data
      .filter((report) => report.type === "csp-violation")
      .map(({ body: report }) => ({
        directive: report.effectiveDirective ?? "unknown",
        blocked: withoutQuery(report.blockedURL),
        document: withoutQuery(report.documentURL),
        disposition: report.disposition ?? "unknown",
      })),
  };
}

/** Reads at most `limit` bytes of the body; undefined when it is longer. */
async function readCapped(request: Request, limit: number): Promise<string | undefined> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > limit) return undefined;
  if (request.body === null) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
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
  const result = parseCspReport(contentType, body);
  if (!result.ok) return new Response(null, { status: 400 });

  const requestId = parseRequestId(request.headers.get(REQUEST_ID_HEADER)) ?? "none";
  for (const violation of result.violations) {
    log({
      level: "warn",
      event: "csp-violation",
      requestId,
      route: new URL(request.url).pathname,
      detail: violation,
    });
  }
  return new Response(null, { status: 204 });
}
