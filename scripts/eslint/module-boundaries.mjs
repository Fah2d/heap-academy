// Enforces the dependency rules of docs/spec/02-architecture.md section 4.1
// (NFR-MAINT-05, ADR-0023). Changing what is allowed here is a spec change
// that needs the owner.

import { dirname, relative, resolve, sep } from "node:path";
import { builtinModules } from "node:module";

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
// The account deletion use case is the only caller (CLAUDE.md rule 8).
const PRIVILEGED_CALLER = "features/profile/server/delete-account";

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
  const area = segments.length === 1 ? "root" : (segments[0] ?? "root");
  return { module: area, path };
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
    },
  },
  create(context) {
    const srcRoot = resolve(context.cwd, "src");
    const importer = locate(srcRoot, context.filename);
    if (importer === undefined) return {};
    const isClient = context.sourceCode.ast.body.some(
      (statement) =>
        statement.type === "ExpressionStatement" &&
        statement.expression.type === "Literal" &&
        statement.expression.value === "use client",
    );

    /**
     * @param {import("estree").Node} node
     * @param {string} source
     */
    const check = (node, source) => {
      const isProject = source.startsWith("@/") || source.startsWith(".");
      if (!isProject) {
        if (
          PURE.has(importer.module) &&
          (FRAMEWORK_PACKAGES.test(source) || NODE_BUILTINS.has(source))
        ) {
          context.report({ node, messageId: "impure", data: { from: importer.module, source } });
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

      if (target.path === PRIVILEGED_CLIENT && !importer.path.startsWith(PRIVILEGED_CALLER)) {
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
        if (node.source.type === "Literal" && typeof node.source.value === "string") {
          check(node, node.source.value);
        }
      },
      CallExpression(node) {
        const [argument] = node.arguments;
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          argument?.type === "Literal" &&
          typeof argument.value === "string"
        ) {
          check(node, argument.value);
        }
      },
    };
  },
};
