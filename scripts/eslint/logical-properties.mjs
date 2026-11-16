// Layout uses logical properties only, so the interface can switch to right to
// left with one setting (NFR-I18N-02, ADR-0016). This covers Tailwind classes
// in `className` and inline `style` objects; stylesheets are covered by
// @eslint/css `prefer-logical-properties`.

// A Tailwind class, after any variants (`md:`, `hover:`) and the `!` and `-`
// modifiers, that names a physical side. The logical equivalents are `ms-`,
// `me-`, `ps-`, `pe-`, `start-`, `end-`, `rounded-s`, `border-s`,
// `text-start`, `float-start`, and so on.
const PHYSICAL_CLASS =
  /^(?:[^:\s]+:)*!?-?(?:m[lr]|p[lr]|left|right|scroll-[mp][lr]|border-[lr]|rounded-(?:[lr]|tl|tr|bl|br)|text-(?:left|right)|float-(?:left|right)|clear-(?:left|right))(?:-|$|!)/;

const PHYSICAL_STYLE_KEYS = new Set([
  "marginLeft",
  "marginRight",
  "paddingLeft",
  "paddingRight",
  "left",
  "right",
  "borderLeft",
  "borderRight",
  "borderLeftWidth",
  "borderRightWidth",
  "borderLeftColor",
  "borderRightColor",
  "borderLeftStyle",
  "borderRightStyle",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "scrollMarginLeft",
  "scrollMarginRight",
  "scrollPaddingLeft",
  "scrollPaddingRight",
]);
const PHYSICAL_STYLE_VALUES = new Set(["textAlign", "float", "clear"]);

/** @param {string} text */
function physicalClasses(text) {
  return text.split(/\s+/).filter((token) => PHYSICAL_CLASS.test(token));
}

/** @type {import("eslint").Rule.RuleModule} */
export const logicalProperties = {
  meta: {
    type: "problem",
    docs: { description: "Logical CSS properties only" },
    schema: [],
    messages: {
      className:
        "Physical class `{{name}}`. Use the logical one (ms-, me-, ps-, pe-, start-, end-, text-start) (NFR-I18N-02).",
      style: "Physical style `{{name}}`. Use the logical property (NFR-I18N-02).",
    },
  },
  create(context) {
    /**
     * Reports physical classes in every string inside a className expression,
     * including strings passed to helpers such as `cn()`.
     * @param {any} node
     */
    function scanClassNames(node) {
      if (node === null || typeof node !== "object") return;
      if (node.type === "Literal" && typeof node.value === "string") {
        for (const name of physicalClasses(node.value))
          context.report({ node, messageId: "className", data: { name } });
        return;
      }
      if (node.type === "TemplateElement") {
        for (const name of physicalClasses(node.value.cooked ?? "")) {
          context.report({ node, messageId: "className", data: { name } });
        }
        return;
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === "parent" || key === "loc" || key === "range") continue;
        if (Array.isArray(value)) value.forEach(scanClassNames);
        else if (value && typeof value === "object" && typeof value.type === "string")
          scanClassNames(value);
      }
    }

    /** @param {any} node */
    function scanStyle(node) {
      if (node?.type !== "ObjectExpression") return;
      for (const property of node.properties) {
        if (property.type !== "Property") continue;
        const key =
          property.key.type === "Identifier"
            ? property.key.name
            : typeof property.key.value === "string"
              ? property.key.value
              : "";
        if (PHYSICAL_STYLE_KEYS.has(key)) {
          context.report({ node: property, messageId: "style", data: { name: key } });
        } else if (
          PHYSICAL_STYLE_VALUES.has(key) &&
          property.value.type === "Literal" &&
          (property.value.value === "left" || property.value.value === "right")
        ) {
          context.report({
            node: property,
            messageId: "style",
            data: { name: `${key}: ${property.value.value}` },
          });
        }
      }
    }

    return {
      /** @param {any} node */
      JSXAttribute(node) {
        const name = typeof node.name?.name === "string" ? node.name.name : "";
        if (node.value === null) return;
        if (name === "className" || name === "class") scanClassNames(node.value);
        if (name === "style" && node.value.type === "JSXExpressionContainer")
          scanStyle(node.value.expression);
      },
    };
  },
};
