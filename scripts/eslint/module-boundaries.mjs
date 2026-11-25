// Enforces the dependency rules of docs/spec/02-architecture.md section 4.1
// (NFR-MAINT-05, ADR-0023). Changing what is allowed here is a spec change
// that needs the owner.

import { builtinModules } from "node:module";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Found from this file, not from ESLint's working directory, so the rule
// works the same from an editor or from another folder.
const SRC_ROOT = fileURLToPath(new URL("../../src/", import.meta.url));

/**
 * Which project modules each module may import, besides itself.
 * `root` is a file directly in `src/`, such as `instrumentation.ts`.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const ALLOWED = {
  root: ["features", "infrastructure", "messages"],
  app: ["features", "messages"],
  features: [
    "features",
    "runtime",
    "content",
    "ui",
    "infrastructure",
    "domain",
    "grader",
    "messages",
  ],
  runtime: ["grader", "domain"],
  content: ["infrastructure", "domain"],
  infrastructure: ["domain"],
  domain: [],
  grader: [],
  ui: [],
  messages: [],
};

/** Modules that must stay free of I/O and frameworks. */
const PURE = new Set(["domain", "grader"]);
const FRAMEWORK_PACKAGES = /^(?:react|react-dom|next|server-only|@supabase\/.*)(?:\/.*)?$/;
const NODE_BUILTINS = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

const PRIVILEGED_CLIENT = "infrastructure/db/privileged";
// The grader's test-only Node runner (ADR-0032): exempt from purity, and
// imported only by itself, tests, and scripts.
const NODE_RUNNER = /^grader\/node-runner(?:\/|$)/;
// The account deletion use case is the only caller (CLAUDE.md rule 8).
const PRIVILEGED_CALLER = "features/profile/server/delete-account";

// Public content is read with no session (CLAUDE.md rule 9,
// docs/spec/02-architecture.md section 7.3). Its answers are cached and
// shared by every visitor, so a session read there would serve one visitor's
// view, such as the admin's drafts, to all. From `infrastructure`, `content`
// may import only the session-less client, the environment schema and the
// logger, and it may not read the request's cookies or headers.
const CONTENT_INFRASTRUCTURE =
  /^infrastructure\/(?:db\/public-client|env\/[^/]+|logging\/(?:logger|route))$/;
const REQUEST_STATE = /^next\/headers(?:\/.*)?$/;

// Folders whose modules run in the browser, and folders whose modules must
// declare themselves server-only (docs/spec/02-architecture.md sections 4.1, 4.2).
const CLIENT_FOLDER = /^features\/[^/]+\/client\//;
const SERVER_FOLDER = /^(?:features\/[^/]+\/server|infrastructure\/db)\//;
const TEST_FILE = /\.test$/;
// The one computed import: the worker loads Pyodide from the asset base it is
// given (ADR-0033). It is a URL, not a project module.
const COMPUTED_IMPORT_ALLOWED = "runtime/worker/python-worker";

/**
 * @param {string} srcRoot absolute path of `src`
 * @param {string} file absolute path
 * @returns {{ module: string, path: string } | undefined} the module and the path inside `src`, without extension
 */
function locate(srcRoot, file) {
  const inside = relative(srcRoot, file);
  if (inside.startsWith("..") || inside === "") return undefined;
  const path = inside
    .split(sep)
    .join("/")
    .replace(/\.(?:[cm]?[jt]sx?)$/, "");
  const segments = path.split("/");
  const first = segments[0] ?? "";
  // `@/ui` is the `ui` module's index, not a file directly in `src/`.
  const isModuleIndex = segments.length === 1 && Object.hasOwn(ALLOWED, first) && first !== "root";
  const area = segments.length === 1 && !isModuleIndex ? "root" : first;
  return { module: area, path };
}

/**
 * The text of a string literal, or of a template literal with no
 * substitutions; anything computed gives `undefined`.
 * @param {import("estree").Node} node
 * @returns {string | undefined}
 */
function fixedText(node) {
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
}

/** @param {string} path a path inside `src` @returns {string | undefined} */
function featureOf(path) {
  const match = /^features\/([^/]+)/.exec(path);
  return match?.[1];
}

/** @type {import("eslint").Rule.RuleModule} */
export const moduleBoundaries = {
  meta: {
    type: "problem",
    docs: { description: "Module dependency rules of docs/spec/02-architecture.md section 4.1" },
    schema: [],
    messages: {
      forbidden:
        "`{{from}}` may not import from `{{to}}` (docs/spec/02-architecture.md section 4.1).",
      featureInternals:
        "Import the `{{feature}}` feature through its index.ts, not its internals (docs/spec/02-architecture.md section 4.1).",
      clientImport:
        "A client component may not import `{{source}}`: no infrastructure, no server folder, no server-only module.",
      privileged:
        "The privileged database client may be imported only by the account deletion use case (CLAUDE.md rule 8).",
      impure:
        "`{{from}}` must stay pure: it may not import `{{source}}` (docs/spec/02-architecture.md section 4.1).",
      nodeRunner:
        "The grader's Node runner is a test tool: only tests and scripts may import it (ADR-0032).",
      testImport:
        "Only a test may import a test file: a test may import the Node runner, so nothing else may import a test (ADR-0032).",
      computedImport:
        "Import with a fixed string, so these rules can see what is imported (docs/spec/02-architecture.md section 4.1).",
      contentSession:
        "`content` reads with no session: it may import from `infrastructure` only `db/public-client`, `env` and `logging`, and never `next/headers` (CLAUDE.md rule 9).",
      serverOnly:
        'A module in this folder runs only on the server and must start with `import "server-only"` (docs/spec/02-architecture.md section 4.1).',
    },
  },
  create(context) {
    const srcRoot = SRC_ROOT;
    const importer = locate(srcRoot, context.filename);
    if (importer === undefined) return {};
    const body = context.sourceCode.ast.body;
    const isClient =
      CLIENT_FOLDER.test(importer.path) ||
      body.some(
        (statement) =>
          statement.type === "ExpressionStatement" &&
          statement.expression.type === "Literal" &&
          statement.expression.value === "use client",
      );
    const mustBeServerOnly = SERVER_FOLDER.test(importer.path) && !TEST_FILE.test(importer.path);
    const isPure = PURE.has(importer.module) && !NODE_RUNNER.test(importer.path);

    /**
     * @param {import("estree").Node} node
     * @param {string} source
     */
    const check = (node, source) => {
      const isProject = source.startsWith("@/") || source.startsWith(".");
      if (!isProject) {
        if (isPure && (FRAMEWORK_PACKAGES.test(source) || NODE_BUILTINS.has(source))) {
          context.report({ node, messageId: "impure", data: { from: importer.module, source } });
        }
        if (importer.module === "content" && REQUEST_STATE.test(source)) {
          context.report({ node, messageId: "contentSession" });
        }
        if (isClient && source === "server-only") {
          context.report({ node, messageId: "clientImport", data: { source } });
        }
        return;
      }
      const absolute = source.startsWith("@/")
        ? resolve(srcRoot, source.slice(2))
        : resolve(dirname(context.filename), source);
      const target = locate(srcRoot, absolute);
      if (target === undefined) return;

      if (TEST_FILE.test(target.path) && !TEST_FILE.test(importer.path)) {
        context.report({ node, messageId: "testImport" });
        return;
      }
      if (
        NODE_RUNNER.test(target.path) &&
        !NODE_RUNNER.test(importer.path) &&
        !TEST_FILE.test(importer.path)
      ) {
        context.report({ node, messageId: "nodeRunner" });
        return;
      }
      if (target.path === PRIVILEGED_CLIENT && importer.path !== PRIVILEGED_CALLER) {
        context.report({ node, messageId: "privileged" });
        return;
      }
      if (
        isClient &&
        (target.module === "infrastructure" || /(?:^|\/)server(?:\/|$)/.test(target.path))
      ) {
        context.report({ node, messageId: "clientImport", data: { source } });
        return;
      }
      if (
        importer.module === "content" &&
        target.module === "infrastructure" &&
        !CONTENT_INFRASTRUCTURE.test(target.path)
      ) {
        context.report({ node, messageId: "contentSession" });
        return;
      }
      if (target.module === importer.module && target.module !== "features") return;

      const isStylesheet = /\.css$/.test(source);
      const allowed =
        (ALLOWED[importer.module] ?? []).includes(target.module) ||
        (importer.module === "app" && target.module === "ui" && isStylesheet);
      if (!allowed) {
        context.report({
          node,
          messageId: "forbidden",
          data: { from: importer.module, to: target.module },
        });
        return;
      }
      if (target.module === "features") {
        const from = featureOf(importer.path);
        const to = featureOf(target.path);
        if (to !== undefined && from !== to && !/^features\/[^/]+(?:\/index)?$/.test(target.path)) {
          context.report({ node, messageId: "featureInternals", data: { feature: to } });
        }
      }
    };

    return {
      Program(node) {
        if (!mustBeServerOnly) return;
        const declares = body.some(
          (statement) =>
            statement.type === "ImportDeclaration" && statement.source.value === "server-only",
        );
        if (!declares) context.report({ node, messageId: "serverOnly" });
      },
      ImportDeclaration(node) {
        if (typeof node.source.value === "string") check(node, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (typeof node.source?.value === "string") check(node, node.source.value);
      },
      ExportAllDeclaration(node) {
        if (typeof node.source.value === "string") check(node, node.source.value);
      },
      ImportExpression(node) {
        const source = fixedText(node.source);
        if (source !== undefined) check(node, source);
        else if (importer.path !== COMPUTED_IMPORT_ALLOWED) {
          context.report({ node, messageId: "computedImport" });
        }
      },
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || node.callee.name !== "require") return;
        const [argument] = node.arguments;
        const source = argument === undefined ? undefined : fixedText(argument);
        if (source === undefined) context.report({ node, messageId: "computedImport" });
        else check(node, source);
      },
    };
  },
};
