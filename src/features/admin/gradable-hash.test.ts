import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { gradableText } from "@/grader/test-case-list";
import type { TestCaseId } from "@/grader/test-case";
import { gradableHash } from "./gradable-hash";

const content = {
  starterCode: "# start\n",
  solutionCode: 'print("Hello, " + input())\n',
  wrongAnswers: [{ label: "No name", code: 'print("Hello")\n' }],
  testCases: [
    {
      id: "t1" as TestCaseId,
      name: "Greets Ada",
      stdin: "Ada\n",
      afterCode: "",
      expected: "Hello, Ada",
      match: "normalized" as const,
      hint: "",
    },
  ],
};

describe("gradableHash [FR-ADM-07]", () => {
  it("is the SHA-256 of the gradable text, in lower-case hex, the same in the browser and on the server", async () => {
    const expected = createHash("sha256").update(gradableText(content), "utf8").digest("hex");
    expect(await gradableHash(content)).toBe(expected);
    expect(await gradableHash(content)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs when one character of the content differs", async () => {
    const other = { ...content, solutionCode: 'print("Hello, " + input()) \n' };
    expect(await gradableHash(other)).not.toBe(await gradableHash(content));
  });
});
