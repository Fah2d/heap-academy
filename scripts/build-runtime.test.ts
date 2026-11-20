import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRuntimeManifest } from "../src/runtime/manifest.ts";
import { WORKER_URL } from "../src/runtime/assets.ts";
import {
  BROTLI_BUDGET_BYTES,
  compileWorker,
  copyRuntime,
  replaceFolder,
  RUNTIME_FILES,
  RuntimeBuildError,
} from "./build-runtime.mjs";

// Staged in the temporary folder too, so each rename stays on one disk.
const STAGING_DIR = mkdtempSync(join(tmpdir(), "staging-"));

// The runtime build against a stand-in package, so these tests do not need
// the 13 MB distribution. The build itself runs against the real package.

function fakePackage(version = "314.0.7", files = RUNTIME_FILES) {
  const dir = mkdtempSync(join(tmpdir(), "pyodide-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "pyodide", version }));
  for (const name of files) writeFileSync(join(dir, name), randomBytes(2048));
  writeFileSync(join(dir, "pyodide.d.ts"), "export {};");
  return dir;
}

describe("runtime build", () => {
  it("[FR-RUN-07] copies the five runtime files under their version, with a size manifest", () => {
    const outDir = mkdtempSync(join(tmpdir(), "runtime-"));
    const manifest = copyRuntime({ packageDir: fakePackage(), outDir, stagingDir: STAGING_DIR });
    const target = join(outDir, "pyodide", "314.0.7");
    expect(readdirSync(target).sort()).toEqual([...RUNTIME_FILES, "manifest.json"].sort());
    const written: unknown = JSON.parse(readFileSync(join(target, "manifest.json"), "utf8"));
    expect(parseRuntimeManifest(written)).toEqual({ ok: true, value: manifest });
    expect(manifest.totalBytes).toBe(5 * 2048);
    // Random bytes do not compress: each Brotli size is close to the file's.
    for (const file of manifest.files) expect(file.brotliBytes).toBeGreaterThan(2000);
  });

  it("[FR-RUN-07] builds in the staging folder, never beside the folder being served", () => {
    const outDir = mkdtempSync(join(tmpdir(), "runtime-"));
    replaceFolder(join(outDir, "pyodide"), STAGING_DIR, (folder) => {
      expect(dirname(folder)).toBe(STAGING_DIR);
      expect(readdirSync(outDir)).toEqual([]);
      writeFileSync(join(folder, "file"), "built");
    });
    expect(readdirSync(join(outDir, "pyodide"))).toEqual(["file"]);
  });

  it("[FR-RUN-07] a rebuild leaves only this release's files, and no half-built folder", () => {
    const outDir = mkdtempSync(join(tmpdir(), "runtime-"));
    copyRuntime({
      packageDir: fakePackage("314.0.6"),
      outDir,
      version: "314.0.6",
      stagingDir: STAGING_DIR,
    });
    copyRuntime({ packageDir: fakePackage(), outDir, stagingDir: STAGING_DIR });
    expect(readdirSync(join(outDir, "pyodide"))).toEqual(["314.0.7"]);
    expect(readdirSync(outDir)).toEqual(["pyodide"]);
    // Nothing is staged where it would be served, and nothing is left staged.
    expect(readdirSync(STAGING_DIR).filter((name) => name.startsWith("pyodide-"))).toEqual([]);
  });

  it("[FR-RUN-07] a failed build keeps the previous output and leaves nothing half-built", () => {
    const outDir = mkdtempSync(join(tmpdir(), "runtime-"));
    copyRuntime({ packageDir: fakePackage(), outDir, stagingDir: STAGING_DIR });
    expect(() =>
      copyRuntime({
        packageDir: fakePackage("314.0.7", RUNTIME_FILES.slice(1)),
        outDir,
        stagingDir: STAGING_DIR,
      }),
    ).toThrow(RuntimeBuildError);
    expect(readdirSync(outDir)).toEqual(["pyodide"]);
    expect(readdirSync(join(outDir, "pyodide", "314.0.7"))).toHaveLength(RUNTIME_FILES.length + 1);
  });

  it.each([
    ["outside the repository", mkdtempSync(join(tmpdir(), "outside-"))],
    // A path that does not exist, so a regression in the guard deletes nothing.
    ["a source folder", "src/runtime/not-a-folder"],
    ["public itself", "public"],
  ])(
    "[FR-RUN-07] refuses to write to %s, since parts of the output are deleted first",
    (_name, out) => {
      const result = spawnSync(process.execPath, ["scripts/build-runtime.mjs", "--out", out], {
        encoding: "utf8",
      });
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("--out must be a folder inside public/");
    },
  );

  it("[FR-RUN-07] refuses a package that is not the pinned release", () => {
    expect(() =>
      copyRuntime({
        packageDir: fakePackage("314.0.8"),
        outDir: mkdtempSync(join(tmpdir(), "r-")),
        stagingDir: STAGING_DIR,
      }),
    ).toThrow(RuntimeBuildError);
  });

  it("[FR-RUN-07] says so, without a stack trace, when there is no package", () => {
    expect(() =>
      copyRuntime({
        packageDir: join(tmpdir(), "no-such-package"),
        outDir: mkdtempSync(join(tmpdir(), "r-")),
        stagingDir: STAGING_DIR,
      }),
    ).toThrow(RuntimeBuildError);
  });

  it("[FR-RUN-07] refuses a package that lacks a runtime file", () => {
    expect(() =>
      copyRuntime({
        packageDir: fakePackage("314.0.7", RUNTIME_FILES.slice(1)),
        outDir: mkdtempSync(join(tmpdir(), "r-")),
        stagingDir: STAGING_DIR,
      }),
    ).toThrow("the package has no pyodide.mjs");
  });

  it("[NFR-PERF-04] fails when the compressed runtime is over the budget", () => {
    expect(BROTLI_BUDGET_BYTES).toBe(6_500_000);
    expect(() =>
      copyRuntime({
        packageDir: fakePackage(),
        outDir: mkdtempSync(join(tmpdir(), "r-")),
        budgetBytes: 4 * 2048,
        stagingDir: STAGING_DIR,
      }),
    ).toThrow(/NFR-PERF-04 allows 8192/);
  });

  it("[FR-RUN-01] compiles the worker to ES modules the browser can load without a bundler", () => {
    const outDir = mkdtempSync(join(tmpdir(), "runtime-"));
    compileWorker({ outDir, stagingDir: STAGING_DIR });
    const entry = join(outDir, WORKER_URL.replace(/^\/_runtime\//, ""));
    const files = [
      "worker/python-worker.js",
      "worker/core.js",
      "worker/run-support.js",
      "protocol.js",
      "output.js",
      "lockdown.js",
      "manifest.js",
    ];
    for (const file of files) {
      const text = readFileSync(join(outDir, "worker", file), "utf8");
      // Every static import is a relative .js file: no bare package name,
      // which a worker cannot resolve without an import map.
      for (const [, specifier] of text.matchAll(/^import [^;]*? from "([^"]+)";/gm)) {
        expect(specifier, `${file}: ${String(specifier)}`).toMatch(/^\.\.?\/[\w/-]+\.js$/);
      }
    }
    expect(readFileSync(entry, "utf8")).toContain('addEventListener("message"');
  }, 60_000);
});

describe("generated folders", () => {
  it("[FR-RUN-07] keeps the generated runtime out of Git", () => {
    expect(readFileSync(".gitignore", "utf8")).toMatch(/^\/public\/_runtime\/$/m);
  });
});
