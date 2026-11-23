import "server-only";
import { z } from "zod";
import { CLIENT_ERROR_CODES, MAX_REPORTED_ROUTE_LENGTH } from "@/domain/client-error";
import { parseRequestId, REQUEST_ID_HEADER } from "@/infrastructure/http/request-id";
import { log as serverLog, type Logger } from "@/infrastructure/logging/logger";
import { logRoute } from "@/infrastructure/logging/route";
import { readCapped } from "./read-capped";

// POST /api/client-error (docs/spec/02-architecture.md section 9.2,
// 07-operations.md section 4.2). A browser reports an error here with a short
// code and the page's path. The body is untrusted: it is size-capped, and the
// schema is strict, so a report that carries any other field, such as an
// error message, is refused rather than trimmed (NFR-PRIV-03, T-16). The
// path is logged only as its pattern, through `logRoute`, so nothing the
// browser chose reaches the log line verbatim.
//
// The release on the line is the server's (NFR-OBS-02). The answer carries
// the request ID that proxy.ts gave this request, which is also on the log
// line, so the error page can show it as the learner's reference
// (NFR-OBS-01).

/** At most 8 kB (docs/spec/07-operations.md section 7). */
export const MAX_CLIENT_ERROR_BYTES = 8000;

const JSON_TYPE = "application/json";

const clientErrorReport = z.strictObject({
  code: z.enum(CLIENT_ERROR_CODES),
  route: z.string().startsWith("/").max(MAX_REPORTED_ROUTE_LENGTH),
});

export async function handleClientError(
  request: Request,
  log: Logger = serverLog,
): Promise<Response> {
  const contentType = (request.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
  if (contentType !== JSON_TYPE) return new Response(null, { status: 415 });
  const body = await readCapped(request, MAX_CLIENT_ERROR_BYTES);
  if (body === undefined) return new Response(null, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = clientErrorReport.safeParse(json);
  if (!parsed.success) return new Response(null, { status: 400 });

  const { code, route } = parsed.data;
  const path = route.split(/[?#]/, 1)[0] ?? "/";
  log({
    level: "error",
    requestId: parseRequestId(request.headers.get(REQUEST_ID_HEADER)) ?? "none",
    route: logRoute("GET", path),
    outcome: `client-error:${code}`,
  });
  return new Response(null, { status: 204 });
}
