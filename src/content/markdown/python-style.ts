import { tags, type Tag } from "@lezer/highlight";

// The Python palette's rules (DESIGN.md section 4.4), shared by the code
// blocks of lesson instructions and the code editor, so both color the same
// code the same way. Pure data: each side builds its own highlighter.

export type TokenKind = "keyword" | "string" | "number" | "function" | "builtin" | "comment";

/** Which syntax tags get which kind. `builtin` is decided by name, below. */
export const PYTHON_TAG_RULES: readonly { tag: Tag[]; kind: Exclude<TokenKind, "builtin"> }[] = [
  {
    tag: [
      tags.keyword,
      tags.controlKeyword,
      tags.definitionKeyword,
      tags.moduleKeyword,
      tags.operatorKeyword,
    ],
    kind: "keyword",
  },
  { tag: [tags.string, tags.special(tags.string)], kind: "string" },
  { tag: [tags.number, tags.bool, tags.null], kind: "number" },
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.definition(tags.variableName)),
      tags.function(tags.propertyName),
    ],
    kind: "function",
  },
  { tag: [tags.comment, tags.lineComment], kind: "comment" },
];

/** Built-ins that a beginner's lesson uses, shown apart from their own functions. */
export const BUILTINS: ReadonlySet<string> = new Set([
  "abs",
  "all",
  "any",
  "bool",
  "dict",
  "enumerate",
  "filter",
  "float",
  "format",
  "input",
  "int",
  "isinstance",
  "len",
  "list",
  "map",
  "max",
  "min",
  "open",
  "print",
  "range",
  "reversed",
  "round",
  "set",
  "sorted",
  "str",
  "sum",
  "tuple",
  "type",
  "zip",
]);
