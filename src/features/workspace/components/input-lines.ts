/**
 * The batch field's answers, one per line. An empty field is no answers, and
 * the line break after the last answer does not add an empty one.
 */
export const inputLines = (text: string) =>
  text === "" ? [] : text.replace(/\n$/, "").split("\n");
