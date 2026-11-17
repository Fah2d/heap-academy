#!/usr/bin/env node
// Builds what the Python runtime serves (WP-3.1, architecture section 5.1):
//
// 1. Copies the Pyodide files from the pinned `pyodide` package to
//    public/_runtime/pyodide/<version>/, with a size manifest the worker reads
//    for download progress. The lockfile's hash is the integrity record.
// 2. Fails when the files a learner downloads exceed NFR-PERF-04 with Brotli.
// 3. Compiles the worker to public/_runtime/worker/ (tsconfig.worker.json,
//    ADR-0033).
//
// `pnpm build` and `pnpm dev` run it first. Both folders are generated and
// ignored by Git.
//
// Usage: build-runtime.mjs [--package-dir <dir>] [--out <dir>] [--skip-worker]
// Exit codes: 0 built, 1 a check failed, 2 usage error.

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { RUNTIME_VERSION } from "../src/runtime/assets.ts";

/** The files the worker loads, in E-02's list. Nothing else is published. */
export const RUNTIME_FILES = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];

/** NFR-PERF-04: the runtime download is 6.5 MB or less compressed. */
export const BROTLI_BUDGET_BYTES = 6_500_000;

export class RuntimeBuildError extends Error {
  /** @override */
  name = "RuntimeBuildError";
}

const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** The output folder must be inside it, since parts of it are deleted and rewritten. */
const PUBLIC = join(REPOSITORY, "public");

/**
 * Where a build is put together before it is moved into place: outside
 * `public/`, so a half-built folder is never served, and on the same disk as
 * the repository, so moving it is a rename. Ignored by Git with node_modules.
 */
const STAGING = join(REPOSITORY, "node_modules", ".cache", "heap-runtime");

/**
 * Builds a folder in `stagingDir` and swaps it in with two renames, so a
 * server reading `target` sees the old folder or the new one, missing only
 * between the two renames, never half of one. The production and development
 * servers of the browser tests both build at start; whichever finishes second
 * keeps the first's identical output.
 *
 * @param {string} target
 * @param {string} stagingDir
 * @param {(folder: string) => void} build
 */
function replaceFolder(target, stagingDir, build) {
  mkdirSync(dirname(target), { recursive: true });
  mkdirSync(stagingDir, { recursive: true });
  const staging = mkdtempSync(join(stagingDir, `${basename(target)}-`));
  const previous = `${staging}.previous`;
  try {
    build(staging);
    try {
      renameSync(target, previous);
    } catch (error) {
      if (codeOf(error) !== "ENOENT") throw error;
    }
    try {
      renameSync(staging, target);
    } catch (error) {
      // Another build put its identical output in place first.
      if (codeOf(error) !== "ENOTEMPTY" && codeOf(error) !== "EEXIST") throw error;
    }
  } finally {
    rmSync(staging, { recursive: true, force: true });
    rmSync(previous, { recursive: true, force: true });
  }
}

/** @param {unknown} error */
function codeOf(error) {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

/**
 * @param {Buffer} contents
 * @returns {{ bytes: number, gzipBytes: number, brotliBytes: number }}
 */
function sizes(contents) {
  return {
    bytes: contents.length,
    gzipBytes: gzipSync(contents, { level: 9 }).length,
    brotliBytes: brotliCompressSync(contents, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
        [constants.BROTLI_PARAM_SIZE_HINT]: contents.length,
      },
    }).length,
  };
}

/**
 * Copies the runtime files and writes the manifest.
 *
 * @param {{ packageDir: string, outDir: string, version?: string, budgetBytes?: number, stagingDir?: string }} options
 */
export function copyRuntime({
  packageDir,
  outDir,
  stagingDir = STAGING,
  version = RUNTIME_VERSION,
  budgetBytes = BROTLI_BUDGET_BYTES,
}) {
  let installed;
  try {
    installed = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
  } catch {
    throw new RuntimeBuildError(`no package.json to read in ${packageDir}`);
  }
  if (installed.name !== "pyodide" || installed.version !== version) {
    throw new RuntimeBuildError(
      `the installed package is ${String(installed.name)} ${String(installed.version)}; ` +
        `src/runtime/assets.ts expects pyodide ${version}`,
    );
  }
  /** @type {{ version: string, files: { name: string, bytes: number, gzipBytes: number, brotliBytes: number }[], totalBytes: number, totalBrotliBytes: number } | undefined} */
  let manifest;
  replaceFolder(join(outDir, "pyodide"), stagingDir, (folder) => {
    const target = join(folder, version);
    mkdirSync(target);
    const files = RUNTIME_FILES.map((name) => {
      const source = join(packageDir, name);
      let contents;
      try {
        contents = readFileSync(source);
      } catch {
        throw new RuntimeBuildError(`the package has no ${name}`);
      }
      copyFileSync(source, join(target, name));
      return { name, ...sizes(contents) };
    });
    manifest = {
      version,
      files,
      totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
      totalBrotliBytes: files.reduce((sum, file) => sum + file.brotliBytes, 0),
    };
    writeFileSync(join(target, "manifest.json"), `${JSON.stringify(manifest, undefined, 2)}\n`);
  });
  if (manifest === undefined) throw new RuntimeBuildError("no manifest was written");
  if (manifest.totalBrotliBytes > budgetBytes) {
    throw new RuntimeBuildError(
      `the runtime is ${String(manifest.totalBrotliBytes)} bytes with Brotli; ` +
        `NFR-PERF-04 allows ${String(budgetBytes)}`,
    );
  }
  return manifest;
}

/**
 * Compiles the worker with the TypeScript compiler.
 *
 * @param {{ outDir: string, stagingDir?: string }} options
 */
export function compileWorker({ outDir, stagingDir = STAGING }) {
  const require = createRequire(import.meta.url);
  const tsc = join(dirname(require.resolve("typescript/package.json")), "bin", "tsc");
  replaceFolder(join(outDir, "worker"), stagingDir, (folder) => {
    const result = spawnSync(
      process.execPath,
      [tsc, "-p", join(REPOSITORY, "tsconfig.worker.json"), "--outDir", folder],
      { encoding: "utf8" },
    );
    if (result.status !== 0) {
      throw new RuntimeBuildError(`the worker did not compile:\n${result.stdout}${result.stderr}`);
    }
  });
}

/** @param {string[]} argv */
function main(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        "package-dir": { type: "string" },
        out: { type: "string", default: join("public", "_runtime") },
        "skip-worker": { type: "boolean", default: false },
      },
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
  // The output's pyodide/ and worker/ folders are replaced, so it must be a
  // folder the server publishes, never one that holds source.
  const out = resolve(values.out);
  const inside = relative(PUBLIC, out);
  if (inside === "" || inside.startsWith("..") || isAbsolute(inside)) {
    console.error(`build-runtime: --out must be a folder inside public/, not ${out}`);
    return 2;
  }
  try {
    let packageDir = values["package-dir"];
    if (packageDir === undefined) {
      try {
        packageDir = dirname(createRequire(import.meta.url).resolve("pyodide/package.json"));
      } catch {
        throw new RuntimeBuildError(
          `the pyodide package is not installed; run pnpm add -E pyodide@${RUNTIME_VERSION}`,
        );
      }
    }
    const manifest = copyRuntime({ packageDir, outDir: out });
    console.log(
      `runtime: pyodide ${manifest.version}, ${String(manifest.totalBytes)} bytes, ` +
        `${String(manifest.totalBrotliBytes)} with Brotli (budget ${String(BROTLI_BUDGET_BYTES)})`,
    );
    for (const file of manifest.files) {
      console.log(
        `  ${file.name}: ${String(file.bytes)} bytes, gzip ${String(file.gzipBytes)}, Brotli ${String(file.brotliBytes)}`,
      );
    }
    if (!values["skip-worker"]) {
      compileWorker({ outDir: out });
      console.log("runtime: worker compiled");
    }
    return 0;
  } catch (error) {
    if (error instanceof RuntimeBuildError) {
      console.error(`runtime build: ${error.message}`);
      return 1;
    }
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main(process.argv.slice(2));
}
