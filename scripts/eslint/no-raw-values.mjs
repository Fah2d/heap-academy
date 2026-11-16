// Components use semantic tokens only, so a second theme is a token file and
// not a refactor (ADR-0015, docs/spec/03-experience.md section 10.4). These
// rules forbid raw color, spacing, radius, font size, and shadow values
// outside the token files in `src/ui/tokens/`.
//
// - `noRawValues` checks Tailwind classes (an arbitrary value such as
//   `p-[13px]` or `bg-[#fff]` bypasses the tokens) and inline `style` objects.
//   With `{ allStrings: true }` it checks every string in the file, for class
//   lists kept in variables.
// - `noRawCssValues` checks stylesheets.
//
// Tailwind's defaults are removed in `src/ui/tokens/semantic.css`, so a
// default class such as `bg-red-500` produces no style at all.

/** @typedef {import("estree").Node} Node */

const COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
// The 148 named colors of CSS Color 4. `transparent`, `currentColor`, and the
// global keywords are not in the list: they carry no design value.
const NAMED_COLORS = new Set([
  "aliceblue",
  "antiquewhite",
  "aqua",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "black",
  "blanchedalmond",
  "blue",
  "blueviolet",
  "brown",
  "burlywood",
  "cadetblue",
  "chartreuse",
  "chocolate",
  "coral",
  "cornflowerblue",
  "cornsilk",
  "crimson",
  "cyan",
  "darkblue",
  "darkcyan",
  "darkgoldenrod",
  "darkgray",
  "darkgreen",
  "darkgrey",
  "darkkhaki",
  "darkmagenta",
  "darkolivegreen",
  "darkorange",
  "darkorchid",
  "darkred",
  "darksalmon",
  "darkseagreen",
  "darkslateblue",
  "darkslategray",
  "darkslategrey",
  "darkturquoise",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dimgrey",
  "dodgerblue",
  "firebrick",
  "floralwhite",
  "forestgreen",
  "fuchsia",
  "gainsboro",
  "ghostwhite",
  "gold",
  "goldenrod",
  "gray",
  "green",
  "greenyellow",
  "grey",
  "honeydew",
  "hotpink",
  "indianred",
  "indigo",
  "ivory",
  "khaki",
  "lavender",
  "lavenderblush",
  "lawngreen",
  "lemonchiffon",
  "lightblue",
  "lightcoral",
  "lightcyan",
  "lightgoldenrodyellow",
  "lightgray",
  "lightgreen",
  "lightgrey",
  "lightpink",
  "lightsalmon",
  "lightseagreen",
  "lightskyblue",
  "lightslategray",
  "lightslategrey",
  "lightsteelblue",
  "lightyellow",
  "lime",
  "limegreen",
  "linen",
  "magenta",
  "maroon",
  "mediumaquamarine",
  "mediumblue",
  "mediumorchid",
  "mediumpurple",
  "mediumseagreen",
  "mediumslateblue",
  "mediumspringgreen",
  "mediumturquoise",
  "mediumvioletred",
  "midnightblue",
  "mintcream",
  "mistyrose",
  "moccasin",
  "navajowhite",
  "navy",
  "oldlace",
  "olive",
  "olivedrab",
  "orange",
  "orangered",
  "orchid",
  "palegoldenrod",
  "palegreen",
  "paleturquoise",
  "palevioletred",
  "papayawhip",
  "peachpuff",
  "peru",
  "pink",
  "plum",
  "powderblue",
  "purple",
  "rebeccapurple",
  "red",
  "rosybrown",
  "royalblue",
  "saddlebrown",
  "salmon",
  "sandybrown",
  "seagreen",
  "seashell",
  "sienna",
  "silver",
  "skyblue",
  "slateblue",
  "slategray",
  "slategrey",
  "snow",
  "springgreen",
  "steelblue",
  "tan",
  "teal",
  "thistle",
  "tomato",
  "turquoise",
  "violet",
  "wheat",
  "white",
  "whitesmoke",
  "yellow",
  "yellowgreen",
]);
// Words as CSS splits them, so `inline-block` and `white-space` are one word.
const hasNamedColor = (/** @type {string} */ value) =>
  value
    .toLowerCase()
    .split(/[^a-z-]+/)
    .some((word) => NAMED_COLORS.has(word));
// A non-zero length in px, rem, or em. Percentages, viewport units, and
// unitless numbers are proportions, not design values.
const LENGTH = /(?<![\w.-])-?(?:\d*\.)?\d*[1-9]\d*(?:\.\d+)?(?:px|rem|em)\b/i;

// Style keys whose value is a color, a space, a radius, a type size, or a
// shadow. `width` and `height` are included: a fixed size belongs in a token.
const DESIGN_STYLE_KEY =
  /^(?:margin|padding|gap|rowGap|columnGap|inset|top|bottom|left|right|width|height|minWidth|minHeight|maxWidth|maxHeight|blockSize|inlineSize|minBlockSize|minInlineSize|maxBlockSize|maxInlineSize|borderRadius|border.*Radius|fontSize|lineHeight|letterSpacing|boxShadow|textShadow|color|background|backgroundColor|border|borderColor|outline|outlineColor|fill|stroke)/;

// Stylesheet properties whose value can hold a color keyword. Named colors
// are checked only here: a word like `tan` means nothing in `display`.
const COLOR_CSS_PROPERTY =
  /^(?:color|background|border|outline|fill|stroke|box-shadow|text-shadow|text-decoration|caret-color|accent-color|column-rule)(?:-|$)/;

// The same, as stylesheet properties.
const DESIGN_CSS_PROPERTY =
  /^(?:margin|padding|gap|row-gap|column-gap|inset|top|bottom|left|right|border-radius|border-.*-radius|font-size|line-height|letter-spacing|box-shadow|text-shadow|font)(?:-|$)/;

/**
 * Splits a class token into its variants and its utility, ignoring colons
 * inside brackets (`data-[state=open]:p-2`, `[mask-type:alpha]`).
 * @param {string} token
 */
function utilityOf(token) {
  let depth = 0;
  let start = 0;
  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];
    if (char === "[" || char === "(") depth += 1;
    else if (char === "]" || char === ")") depth -= 1;
    else if (char === ":" && depth === 0) start = index + 1;
  }
  return token.slice(start);
}

/** @param {string} text @returns {string[]} */
function arbitraryClasses(text) {
  return text.split(/\s+/).filter((token) => {
    if (token === "") return false;
    const utility = utilityOf(token).replace(/^!?-?/, "");
    // `p-[13px]`, `bg-[#fff]`, `[mask-type:alpha]`. Variants may use brackets;
    // the utility may not.
    return /^[a-z][\w-]*-\[.+\]!?$/.test(utility) || /^\[[\w-]+:.+\]!?$/.test(utility);
  });
}

/** @param {unknown} value */
function isRawStyleValue(value) {
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    return COLOR.test(value) || LENGTH.test(value) || hasNamedColor(value);
  }
  return false;
}

/**
 * @param {Node} node
 * @returns {T}
 * @template T
 */
const as = (node) => /** @type {T} */ (/** @type {unknown} */ (node));

/** @type {import("eslint").Rule.RuleModule} */
export const noRawValues = {
  meta: {
    type: "problem",
    docs: { description: "Semantic tokens only in components (ADR-0015)" },
    schema: [
      {
        type: "object",
        properties: { allStrings: { type: "boolean" } },
        additionalProperties: false,
      },
    ],
    messages: {
      className:
        "Arbitrary value `{{name}}` bypasses the tokens. Use a token utility, or add a token in src/ui/tokens/ (ADR-0015).",
      style:
        "Raw value in style `{{name}}`. Use a token (`var(--space-4)`) or a token utility (ADR-0015).",
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
      for (const name of arbitraryClasses(text)) {
        context.report({ node, messageId: "className", data: { name } });
      }
    }

    /** @param {Node} node */
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
        // A custom property set inline is a value a utility will read, as in
        // `style={{ "--gap": "13px" }}` with `gap-(--gap)`, so it is checked too.
        if (!key.startsWith("--") && !DESIGN_STYLE_KEY.test(key)) continue;
        const value = property.value;
        const raw =
          value.type === "Literal"
            ? isRawStyleValue(value.value)
            : value.type === "TemplateLiteral" &&
              value.quasis.some((quasi) => isRawStyleValue(quasi.value.cooked ?? ""));
        if (raw) context.report({ node: property, messageId: "style", data: { name: key } });
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

    /** @param {Node} node */
    function onJsxAttribute(node) {
      /** @type {{ name: { name?: unknown }, value: (Node & { expression?: Node }) | null }} */
      const attribute = as(node);
      const name = typeof attribute.name.name === "string" ? attribute.name.name : "";
      if (attribute.value === null) return;
      if (!allStrings && (name === "className" || name === "class")) {
        scanClassNames(attribute.value);
      }
      if (name === "style" && attribute.value.expression) scanStyle(attribute.value.expression);
    }

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
        JSXAttribute: onJsxAttribute,
      };
    }
    return { JSXAttribute: onJsxAttribute };
  },
};

/**
 * A stylesheet declaration, as @eslint/css parses it.
 * @typedef {{ property: string, value: object }} CssDeclaration
 */

// A rule for the CSS language of @eslint/css. ESLint's rule type describes
// JavaScript nodes, so the declaration and the source text are read through
// narrow casts.
/** @type {import("eslint").Rule.RuleModule} */
export const noRawCssValues = {
  meta: {
    type: "problem",
    docs: { description: "Semantic tokens only in stylesheets outside src/ui/tokens/ (ADR-0015)" },
    schema: [],
    messages: {
      color:
        "Raw color in `{{property}}`. Use a semantic token such as `var(--color-text)` (ADR-0015).",
      length:
        "Raw length in `{{property}}`. Use a token such as `var(--space-4)` or `var(--radius-control)` (ADR-0015).",
    },
  },
  create(context) {
    const source = /** @type {{ getText(node: object): string }} */ (
      /** @type {unknown} */ (context.sourceCode)
    );
    return {
      /** @param {unknown} raw */
      Declaration(raw) {
        const node = /** @type {CssDeclaration} */ (raw);
        const property = node.property.toLowerCase();
        const value = source.getText(node.value);
        const reportOn = /** @type {Node} */ (node.value);
        if (
          COLOR.test(value) ||
          ((property.startsWith("--") || COLOR_CSS_PROPERTY.test(property)) && hasNamedColor(value))
        ) {
          context.report({ node: reportOn, messageId: "color", data: { property } });
        } else if (
          (property.startsWith("--") || DESIGN_CSS_PROPERTY.test(property)) &&
          LENGTH.test(value)
        ) {
          context.report({ node: reportOn, messageId: "length", data: { property } });
        }
      },
    };
  },
};
