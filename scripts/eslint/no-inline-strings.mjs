// No user-facing string is written inline in a component; copy comes from
// src/messages (NFR-I18N-01, ADR-0016). Text with no letter or digit, such as
// a separator, is allowed.

/** Attributes whose value a person reads or hears. */
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

const WORDS = /[\p{L}\p{N}]/u;

/** @type {import("eslint").Rule.RuleModule} */
export const noInlineStrings = {
  meta: {
    type: "problem",
    docs: { description: "User-facing strings come from src/messages" },
    schema: [],
    messages: {
      text: "Inline text in a component. Put it in src/messages and import it (NFR-I18N-01).",
      attribute: "Inline `{{name}}` text. Put it in src/messages and import it (NFR-I18N-01).",
    },
  },
  create(context) {
    /** @param {unknown} value */
    const hasWords = (value) => typeof value === "string" && WORDS.test(value);

    /**
     * @param {import("estree").Node} expression
     * @returns {boolean}
     */
    function isInlineString(expression) {
      if (expression.type === "Literal") return hasWords(expression.value);
      if (expression.type === "TemplateLiteral") {
        return expression.quasis.some((quasi) => hasWords(quasi.value.cooked));
      }
      return false;
    }

    return {
      /** @param {any} node */
      JSXText(node) {
        if (hasWords(node.value)) context.report({ node, messageId: "text" });
      },
      /** @param {any} node */
      JSXExpressionContainer(node) {
        if (node.parent?.type === "JSXAttribute") return;
        if (isInlineString(node.expression)) context.report({ node, messageId: "text" });
      },
      /** @param {any} node */
      JSXAttribute(node) {
        const name = typeof node.name?.name === "string" ? node.name.name : "";
        if (!READ_ATTRIBUTES.has(name) || node.value === null) return;
        const value =
          node.value.type === "JSXExpressionContainer" ? node.value.expression : node.value;
        if (isInlineString(value)) context.report({ node, messageId: "attribute", data: { name } });
      },
    };
  },
};
