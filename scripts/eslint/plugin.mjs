// The repository's own lint rules. Each one enforces a requirement that no
// published plugin checks the way the spec states it.

import { logicalProperties } from "./logical-properties.mjs";
import { moduleBoundaries } from "./module-boundaries.mjs";
import { noInlineStrings } from "./no-inline-strings.mjs";

/** @type {import("eslint").ESLint.Plugin} */
export const heapPlugin = {
  meta: { name: "heap" },
  rules: {
    "module-boundaries": moduleBoundaries,
    "no-inline-strings": noInlineStrings,
    "logical-properties": logicalProperties,
  },
};

// No raw HTML injection sink anywhere (T-06, docs/spec/05-engineering-handbook.md
// section 5). Kept here so every config block that sets `no-restricted-syntax`
// includes these selectors: a later block replaces the option, it does not merge.
export const RAW_HTML_SELECTORS = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message:
      "No raw HTML injection (T-06). Lesson Markdown renders through the one component in src/content.",
  },
  {
    selector: "Property[key.name='dangerouslySetInnerHTML']",
    message: "No raw HTML injection (T-06).",
  },
  {
    selector:
      "AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]",
    message: "No raw HTML injection (T-06). Set textContent or render with React.",
  },
  {
    selector:
      "CallExpression[callee.property.name=/^(insertAdjacentHTML|createContextualFragment|setHTMLUnsafe|parseHTMLUnsafe)$/]",
    message: "No raw HTML injection (T-06).",
  },
  {
    selector:
      "CallExpression[callee.object.name='document'][callee.property.name=/^(write|writeln)$/]",
    message: "No raw HTML injection (T-06).",
  },
  {
    selector: "JSXAttribute[name.name='srcDoc']",
    message: "No raw HTML injection (T-06).",
  },
];

// src/domain and src/grader take time and randomness as parameters
// (docs/spec/05-engineering-handbook.md section 5).
export const PURITY_SELECTORS = [
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: "Pass a clock in; src/domain and src/grader are pure.",
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: "Pass a clock in; src/domain and src/grader are pure.",
  },
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: "Pass randomness in; src/domain and src/grader are pure.",
  },
  {
    selector: "CallExpression[callee.object.name='performance'][callee.property.name='now']",
    message: "Pass a clock in; src/domain and src/grader are pure.",
  },
  {
    selector:
      "CallExpression[callee.object.name='crypto'][callee.property.name=/^(randomUUID|getRandomValues)$/]",
    message: "Pass randomness in; src/domain and src/grader are pure.",
  },
];

export const IO_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "document",
  "window",
  "navigator",
  "process",
].map((name) => ({ name, message: "src/domain and src/grader perform no I/O." }));
