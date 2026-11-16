#!/usr/bin/env node
// The bundle secret check of the `build` job (T-12, NFR-SEC-04): no server
// variable may reach a file the browser downloads. Server variables are the
// names in .env.example without the NEXT_PUBLIC_ prefix, the list of record
// (docs/spec/02-architecture.md section 13). The check looks for each name,
// and for each value the environment holds for it, in every file under the
// given folder (the build's `.next/static`).
//
// Usage: check-bundle.mjs <folder>
// Exit codes: 0 clean, 1 a server variable found, 2 usage error.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

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
  const [folder] = argv;
  if (folder === undefined || argv.length !== 1) {
    process.stderr.write("usage: check-bundle.mjs <folder>\n");
    return 2;
  }
  const names = serverVariableNames(readFileSync(".env.example", "utf8"));
  const files = filesUnder(folder).length;
  const findings = findServerVariables(folder, names, process.env);
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
