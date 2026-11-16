#!/usr/bin/env node
// The bundle secret check of the `build` job (T-12, NFR-SEC-04): no server
// variable may reach a file the browser downloads. Server variables are the
// names in .env.example without the NEXT_PUBLIC_ prefix, the list of record
// (docs/spec/02-architecture.md section 13). The check looks for each name,
// and for each value the environment holds for it, in every file under the
// given folder: the CI build's `.next/static`, with a marker value, and the
// production build's `.vercel/output/static` in the deploy workflow.
//
// In the deploy workflow, `--env-file` adds every server variable of the file
// `vercel pull` wrote, so a variable set in Vercel but missing from
// .env.example is searched for too. Vercel writes a placeholder for a
// Sensitive variable, so for those the deploy check covers the name only;
// the CI build's marker covers the code path that would leak a value.
// Vercel's own system variables (`VERCEL_*`) are left out, apart from the
// OIDC token: their values are words like `production` that a bundle may
// hold for other reasons.
//
// Usage: check-bundle.mjs <folder> [--env-file <file>]
// Exit codes: 0 clean, 1 a server variable found or no file to check, 2 usage error.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

/** Values shorter than this are too common to search for. */
const MIN_VALUE_LENGTH = 8;

/**
 * @param {string} example the text of .env.example
 * @returns {string[]}
 */
export function serverVariableNames(example) {
  return example
    .split("\n")
    .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line.trim())?.[1])
    .filter((name) => name !== undefined && !name.startsWith("NEXT_PUBLIC_"))
    .map((name) => /** @type {string} */ (name));
}

/**
 * The server variables of an environment file, as `vercel pull` writes it.
 *
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function serverVariablesOf(text) {
  /** @type {Record<string, string>} */
  const variables = {};
  for (const [name, value] of Object.entries(parseEnv(text))) {
    if (name.startsWith("NEXT_PUBLIC_")) continue;
    if (name.startsWith("VERCEL_") && name !== "VERCEL_OIDC_TOKEN") continue;
    if (value === undefined) continue;
    variables[name] = value;
  }
  return variables;
}

/** @param {string} folder @returns {string[]} */
function filesUnder(folder) {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/**
 * @param {string} folder
 * @param {string[]} names
 * @param {Readonly<Record<string, string | undefined>>} environment
 * @returns {{ file: string, what: string }[]}
 */
export function findServerVariables(folder, names, environment) {
  const needles = names.flatMap((name) => {
    const value = environment[name];
    return [
      { text: name, what: `the name ${name}` },
      ...(value !== undefined && value.length >= MIN_VALUE_LENGTH
        ? [{ text: value, what: `the value of ${name}` }]
        : []),
    ];
  });
  const findings = [];
  for (const file of filesUnder(folder)) {
    const content = readFileSync(file, "latin1");
    for (const needle of needles) {
      if (content.includes(needle.text)) findings.push({ file, what: needle.what });
    }
  }
  return findings;
}

/** @param {string[]} argv @returns {number} */
export function main(argv) {
  const [folder, flag, envFile] = argv;
  const withFile = argv.length === 3 && flag === "--env-file" && envFile !== undefined;
  if (folder === undefined || (argv.length !== 1 && !withFile)) {
    process.stderr.write("usage: check-bundle.mjs <folder> [--env-file <file>]\n");
    return 2;
  }
  const pulled = withFile ? serverVariablesOf(readFileSync(envFile, "utf8")) : {};
  const names = [
    ...new Set([
      ...serverVariableNames(readFileSync(".env.example", "utf8")),
      ...Object.keys(pulled),
    ]),
  ];
  const environment = { ...process.env, ...pulled };
  const files = filesUnder(folder).length;
  if (files === 0) {
    // An empty folder proves nothing: the build failed or wrote elsewhere.
    process.stderr.write(`No files under ${folder}; nothing was checked.\n`);
    return 1;
  }
  const findings = findServerVariables(folder, names, environment);
  for (const { file, what } of findings) process.stderr.write(`${file}: ${what}\n`);
  if (findings.length > 0) {
    process.stderr.write("A server variable reached the browser bundle (T-12).\n");
    return 1;
  }
  process.stdout.write(
    `No server variable (${names.join(", ")}) in ${files} files under ${folder}.\n`,
  );
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exit(main(process.argv.slice(2)));
}
