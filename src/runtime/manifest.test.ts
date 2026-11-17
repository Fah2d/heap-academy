import { describe, expect, it } from "vitest";
import { parseRuntimeManifest } from "./manifest.ts";

const manifest = {
  version: "314.0.7",
  files: [{ name: "pyodide.asm.wasm", bytes: 100, gzipBytes: 40, brotliBytes: 30 }],
  totalBytes: 100,
  totalBrotliBytes: 30,
};

describe("runtime manifest", () => {
  it("[FR-RUN-07] accepts the manifest the build writes", () => {
    expect(parseRuntimeManifest(manifest)).toEqual({ ok: true, value: manifest });
  });

  it.each([
    ["totals that do not add up", { ...manifest, totalBytes: 99 }],
    ["a path in a file name", { ...manifest, files: [{ ...manifest.files[0], name: "../x" }] }],
    ["no files", { ...manifest, files: [], totalBytes: 0, totalBrotliBytes: 0 }],
    ["a version that is not a release", { ...manifest, version: "latest" }],
    ["a negative size", { ...manifest, files: [{ ...manifest.files[0], gzipBytes: -1 }] }],
  ])("[FR-RUN-07] refuses %s", (_name, value) => {
    expect(parseRuntimeManifest(value)).toEqual({ ok: false });
  });
});
