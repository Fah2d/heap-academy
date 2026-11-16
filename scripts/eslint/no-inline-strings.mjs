// No user-facing string is written inline in a component; copy comes from
// src/messages (NFR-I18N-01, ADR-0016). Text with no letter or digit, such as
// a separator, is allowed.

/** @typedef {import("estree").Node} Node */
/** @typedef {import("estree").Expression} Expression */
/**
 * The few JSX node shapes this rule reads. ESLint's estree types do not
 * include JSX, so the listeners narrow from `Node` to these.
 * @typedef {{ type: "JSXText", value: string }} JSXText
 * @typedef {{ type: "JSXIdentifier", name: string } | { type: "JSXMemberExpression" } | { type: "JSXNamespacedName" }} JSXName
 * @typedef {{ type: "JSXExpressionContainer", expression: Expression | { type: "JSXEmptyExpression" }, parent?: { type: string } }} JSXExpressionContainer
 * @typedef {{ type: "JSXAttribute", name: JSXName, value: Expression | JSXExpressionContainer | null, parent?: { type: "JSXOpeningElement", name: JSXName } }} JSXAttribute
 */

/** Attributes of plain HTML elements whose value a person reads or hears. */
const READ_ATTRIBUTES = new Set([
  "alt",
  "title",
  "placeholder",
  "label",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
]);

/**
 * Props of components that carry identifiers or settings, not copy. Any other
 * string prop of a component is checked when it looks like prose.
 */
const SETTING_PROPS = new Set([
  "className",
  "href",
  "id",
  "key",
  "variant",
  "size",
  "type",
  "name",
  "role",
  "rel",
  "target",
  "as",
  "src",
  "method",
  "action",
  "htmlFor",
  "tone",
  "intent",
  "mode",
  "autoComplete",
  "inputMode",
  "lang",
  "dir",
  "form",
  "value",
  "slot",
  "side",
  "align",
  "orientation",
  "placement",
  "prefetch",
  "loading",
  "decoding",
  "sizes",
  "strategy",
  "nonce",
]);

/** Keys of a Next.js metadata object whose values a person reads. */
const METADATA_TEXT_KEYS = new Set([
  "title",
  "description",
  "default",
  "template",
  "absolute",
  "applicationName",
  "siteName",
  "abstract",
  "alt",
  "keywords",
]);

const WORDS = /[\p{L}\p{N}]/u;
// A component prop value such as "primary" or "end" is a setting; "Saved" or
// "Try again" is copy.
const PROSE = /[\p{Lu}]|\S\s+\S|[^\p{ASCII}]/u;

/** @param {unknown} value */
const hasWords = (value) => typeof value === "string" && WORDS.test(value);

/**
 * Every string literal a value can evaluate to, through `a ? b : c`, `a ?? b`,
 * `a && b`, `a || b`, and `a + b`.
 * @param {Node | { type: "JSXEmptyExpression" }} node
 * @returns {Array<{ node: Node, text: string }>}
 */
function inlineStrings(node) {
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" && hasWords(node.value)
        ? [{ node, text: node.value }]
        : [];
    case "TemplateLiteral": {
      const text = node.quasis.map((quasi) => quasi.value.cooked ?? "").join(" ");
      return hasWords(text) ? [{ node, text }] : [];
    }
    case "ConditionalExpression":
      return [...inlineStrings(node.consequent), ...inlineStrings(node.alternate)];
    case "LogicalExpression":
      return [...inlineStrings(node.left), ...inlineStrings(node.right)];
    case "BinaryExpression":
      return node.operator === "+" && node.left.type !== "PrivateIdentifier"
        ? [...inlineStrings(node.left), ...inlineStrings(node.right)]
        : [];
    default:
      return [];
  }
}

/**
 * @param {Node} node
 * @returns {T}
 * @template T
 */
const as = (node) => /** @type {T} */ (/** @type {unknown} */ (node));

/** @type {import("eslint").Rule.RuleModule} */
export const noInlineStrings = {
  meta: {
    type: "problem",
    docs: { description: "User-facing strings come from src/messages" },
    schema: [],
    messages: {
      text: "Inline text in a component. Put it in src/messages and import it (NFR-I18N-01).",
      attribute: "Inline `{{name}}` text. Put it in src/messages and import it (NFR-I18N-01).",
      metadata: "Inline page metadata text. Put it in src/messages and import it (NFR-I18N-01).",
    },
  },
  create(context) {
    /** @param {Node} node */
    function scanMetadata(node) {
      if (node.type !== "ObjectExpression") return;
      for (const property of node.properties) {
        if (property.type !== "Property") continue;
        const key =
          property.key.type === "Identifier"
            ? property.key.name
            : property.key.type === "Literal"
              ? String(property.key.value)
              : "";
        const values =
          property.value.type === "ArrayExpression"
            ? property.value.elements.filter((element) => element !== null)
            : [property.value];
        for (const value of values) {
          if (value.type === "ObjectExpression") scanMetadata(value);
          else if (value.type !== "SpreadElement" && METADATA_TEXT_KEYS.has(key)) {
            for (const found of inlineStrings(value)) {
              context.report({ node: found.node, messageId: "metadata" });
            }
          }
        }
      }
    }

    return {
      /** @param {Node} node */
      JSXText(node) {
        if (hasWords(as(node).value)) context.report({ node, messageId: "text" });
      },
      /** @param {Node} node */
      JSXExpressionContainer(node) {
        /** @type {JSXExpressionContainer} */
        const container = as(node);
        if (container.parent?.type === "JSXAttribute") return;
        for (const found of inlineStrings(container.expression)) {
          context.report({ node: found.node, messageId: "text" });
        }
      },
      /** @param {Node} node */
      JSXAttribute(node) {
        /** @type {JSXAttribute} */
        const attribute = as(node);
        if (attribute.name.type !== "JSXIdentifier" || attribute.value === null) return;
        const name = attribute.name.name;
        const element = attribute.parent?.name;
        const isComponent =
          element?.type === "JSXMemberExpression" ||
          (element?.type === "JSXIdentifier" && /^[A-Z]/.test(element.name));
        const value =
          attribute.value.type === "JSXExpressionContainer"
            ? attribute.value.expression
            : attribute.value;
        for (const found of inlineStrings(value)) {
          const checked = isComponent
            ? READ_ATTRIBUTES.has(name) ||
              (!SETTING_PROPS.has(name) && !name.startsWith("data-") && PROSE.test(found.text))
            : READ_ATTRIBUTES.has(name);
          if (checked) context.report({ node: found.node, messageId: "attribute", data: { name } });
        }
      },
      /** @param {Node} node */
      VariableDeclarator(node) {
        if (node.type !== "VariableDeclarator" || node.id.type !== "Identifier") return;
        if (node.id.name === "metadata" && node.init) scanMetadata(node.init);
      },
      /** @param {Node} node */
      ReturnStatement(node) {
        if (node.type !== "ReturnStatement" || !node.argument) return;
        const enclosing = context.sourceCode
          .getAncestors(node)
          .reverse()
          .find((ancestor) => ancestor.type.includes("Function"));
        if (
          enclosing?.type === "FunctionDeclaration" &&
          enclosing.id?.name === "generateMetadata"
        ) {
          scanMetadata(node.argument);
        }
      },
    };
  },
};
