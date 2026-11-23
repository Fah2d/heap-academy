// The size manifest the runtime build writes next to the Pyodide files
// (scripts/build-runtime.mjs). The worker reads it to report real download
// progress (architecture section 5.2), and the build checks the compressed
// total against NFR-PERF-04.

export type RuntimeFile = {
  name: string;
  bytes: number;
  gzipBytes: number;
  brotliBytes: number;
};

export type RuntimeManifest = {
  version: string;
  files: RuntimeFile[];
  totalBytes: number;
  totalBrotliBytes: number;
};

const FILE_NAME = /^[A-Za-z0-9._-]{1,64}$/;
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

function size(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function file(value: unknown): RuntimeFile | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const name: unknown = Reflect.get(value, "name");
  const bytes = size(Reflect.get(value, "bytes"));
  const gzipBytes = size(Reflect.get(value, "gzipBytes"));
  const brotliBytes = size(Reflect.get(value, "brotliBytes"));
  if (typeof name !== "string" || !FILE_NAME.test(name)) return undefined;
  if (bytes === undefined || gzipBytes === undefined || brotliBytes === undefined) return undefined;
  return { name, bytes, gzipBytes, brotliBytes };
}

export function parseRuntimeManifest(
  value: unknown,
): { ok: true; value: RuntimeManifest } | { ok: false } {
  if (typeof value !== "object" || value === null) return { ok: false };
  const version: unknown = Reflect.get(value, "version");
  const files: unknown = Reflect.get(value, "files");
  if (typeof version !== "string" || !VERSION.test(version) || !Array.isArray(files)) {
    return { ok: false };
  }
  const parsed = files.map(file);
  const valid = parsed.filter((entry): entry is RuntimeFile => entry !== undefined);
  if (valid.length !== parsed.length || valid.length === 0) return { ok: false };
  const totalBytes = valid.reduce((sum, entry) => sum + entry.bytes, 0);
  const totalBrotliBytes = valid.reduce((sum, entry) => sum + entry.brotliBytes, 0);
  if (
    Reflect.get(value, "totalBytes") !== totalBytes ||
    Reflect.get(value, "totalBrotliBytes") !== totalBrotliBytes
  ) {
    return { ok: false };
  }
  return { ok: true, value: { version, files: valid, totalBytes, totalBrotliBytes } };
}
