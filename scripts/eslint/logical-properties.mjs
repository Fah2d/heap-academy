// Layout uses logical properties for the inline axis, so the interface can
// switch to right to left with one setting (NFR-I18N-02, ADR-0016). The rule
// is about sides: left and right. Block-axis sides (top, bottom) and sizes
// are allowed here and in stylesheets alike.
//
// It covers Tailwind classes in `className`, inline `style` objects, and, with
// `{ allStrings: true }`, every string in a file, for class lists kept in
// variables. Stylesheets are covered by @eslint/css `prefer-logical-properties`
// with the same scope (CSS_ALLOWED_PROPERTIES).

/** @typedef {import("estree").Node} Node */

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

/**
 * Properties @eslint/css would flag that name no inline side. Allowed so the
 * stylesheet rule has the same scope as this one.
 */
export const CSS_ALLOWED_PROPERTIES = [
  "top",
  "bottom",
  "border-top",
  "border-top-color",
  "border-top-style",
  "border-top-width",
  "border-bottom",
  "border-bottom-color",
  "border-bottom-style",
  "border-bottom-width",
  "margin-top",
  "margin-bottom",
  "padding-top",
  "padding-bottom",
  "scroll-margin-top",
  "scroll-margin-bottom",
  "scroll-padding-top",
  "scroll-padding-bottom",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "contain-intrinsic-width",
  "contain-intrinsic-height",
  "overflow-x",
  "overflow-y",
  "overscroll-behavior-x",
  "overscroll-behavior-y",
];
export const CSS_ALLOWED_UNITS = [
  "vh",
  "vw",
  "dvh",
  "dvw",
  "svh",
  "svw",
  "lvh",
  "lvw",
  "cqh",
  "cqw",
];

/** @param {string} text */
function physicalClasses(text) {
  return text.split(/\s+/).filter((token) => PHYSICAL_CLASS.test(token));
}

/**
 * @param {Node} node
 * @returns {T}
 * @template T
 */
const as = (node) => /** @type {T} */ (/** @type {unknown} */ (node));

/** @type {import("eslint").Rule.RuleModule} */
export const logicalProperties = {
  meta: {
    type: "problem",
    docs: { description: "Logical CSS properties for the inline axis" },
    schema: [
      {
        type: "object",
        properties: { allStrings: { type: "boolean" } },
        additionalProperties: false,
      },
    ],
    messages: {
      className:
        "Physical class `{{name}}`. Use the logical one (ms-, me-, ps-, pe-, start-, end-, text-start) (NFR-I18N-02).",
      style: "Physical style `{{name}}`. Use the logical property (NFR-I18N-02).",
    },
  },
  create(context) {
    const options = /** @type {{ allStrings?: boolean } | undefined} */ (context.options[0]);
    const allStrings = options?.allStrings === true;

    /**
     * @param {Node} node
     * @param {string} text
     */
    function reportClasses(node, text) {
      for (const name of physicalClasses(text)) {
        context.report({ node, messageId: "className", data: { name } });
      }
    }

    /**
     * Reports physical classes in every string inside a className expression,
     * including strings passed to helpers such as `cn()`.
     * @param {Node} node
     */
    function scanClassNames(node) {
      if (node.type === "Literal") {
        if (typeof node.value === "string") reportClasses(node, node.value);
        return;
      }
      if (node.type === "TemplateElement") {
        reportClasses(node, node.value.cooked ?? "");
        return;
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === "parent" || key === "loc" || key === "range") continue;
        const children = Array.isArray(value) ? value : [value];
        for (const child of children) {
          if (child !== null && typeof child === "object" && typeof child.type === "string") {
            scanClassNames(child);
          }
        }
      }
    }

    /** @param {Node} node */
    function scanStyle(node) {
      if (node.type !== "ObjectExpression") return;
      for (const property of node.properties) {
        if (property.type !== "Property") continue;
        const key =
          property.key.type === "Identifier"
            ? property.key.name
            : property.key.type === "Literal" && typeof property.key.value === "string"
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

    /** @param {Node} node */
    const isModuleSource = (node) => {
      const parent = /** @type {{ parent?: Node }} */ (/** @type {unknown} */ (node)).parent;
      return (
        parent?.type === "ImportDeclaration" ||
        parent?.type === "ExportNamedDeclaration" ||
        parent?.type === "ExportAllDeclaration" ||
        parent?.type === "ImportExpression"
      );
    };

    if (allStrings) {
      return {
        /** @param {Node} node */
        Literal(node) {
          if (node.type === "Literal" && typeof node.value === "string" && !isModuleSource(node)) {
            reportClasses(node, node.value);
          }
        },
        /** @param {Node} node */
        TemplateElement(node) {
          if (node.type === "TemplateElement") reportClasses(node, node.value.cooked ?? "");
        },
        /** @param {Node} node */
        JSXAttribute(node) {
          /** @type {{ name: { name?: unknown }, value: { type: string, expression: Node } | null }} */
          const attribute = as(node);
          if (
            attribute.name.name === "style" &&
            attribute.value?.type === "JSXExpressionContainer"
          ) {
            scanStyle(attribute.value.expression);
          }
        },
      };
    }

    return {
      /** @param {Node} node */
      JSXAttribute(node) {
        /** @type {{ name: { name?: unknown }, value: (Node & { expression?: Node }) | null }} */
        const attribute = as(node);
        const name = typeof attribute.name.name === "string" ? attribute.name.name : "";
        if (attribute.value === null) return;
        if (name === "className" || name === "class") scanClassNames(attribute.value);
        if (name === "style" && attribute.value.expression) scanStyle(attribute.value.expression);
      },
    };
  },
};
