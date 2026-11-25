// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HARNESS_OUTPUT_LIMIT } from "@/grader/harness";
import {
  CHECK_TEST_LIMIT,
  TEST_CASE_LIMITS,
  type TestCase,
  type TestCaseId,
} from "@/grader/test-case";
import type { TestCaseProblem } from "@/grader/test-case-list";
import { validation, testCaseList as words } from "@/messages/admin";
import { TIME_LIMIT_MS } from "@/runtime/controller";
import type { SolutionView } from "../validation-view";
import { TestCaseList } from "./test-case-list";

// The test case list (docs/spec/03-experience.md section 7.5; FR-ADM-05):
// each test case opens to its fields; add, duplicate, move up, move down and
// delete, with the limit of 12; a message per field; focus that stays in the
// list after every change.

afterEach(cleanup);

const testCase = (id: string, name: string): TestCase => ({
  id: id as TestCaseId,
  name,
  stdin: "",
  afterCode: "",
  expected: "",
  match: "normalized",
  hint: "",
});

function Harness({
  initial,
  problems = new Map(),
  solution = new Map(),
  onList,
}: {
  initial: TestCase[];
  problems?: ReadonlyMap<TestCaseId, readonly TestCaseProblem[]>;
  solution?: ReadonlyMap<TestCaseId, SolutionView>;
  onList?: (list: TestCase[]) => void;
}) {
  const [list, setList] = useState(initial);
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set([...problems.keys(), ...solution.keys()] as Iterable<string>),
  );
  const next = useRef(0);
  return (
    <TestCaseList
      testCases={list}
      onChange={(value) => {
        setList(value);
        onList?.(value);
      }}
      problems={problems}
      solution={solution}
      expanded={open}
      onExpandedChange={(id, isOpen) =>
        setOpen((current) => {
          const copy = new Set(current);
          if (isOpen) copy.add(id);
          else copy.delete(id);
          return copy;
        })
      }
      newId={() => {
        next.current += 1;
        return `new${String(next.current)}`;
      }}
    />
  );
}

const trigger = (n: number, name: string) =>
  screen.getByRole("button", { name: words.title(n, name) });
const group = (n: number) => screen.getByRole("group", { name: words.group(n) });

describe("TestCaseList [FR-ADM-05]", () => {
  it("says there is no test case yet, and adds one that opens with its name focused", async () => {
    const onList = vi.fn();
    render(<Harness initial={[]} onList={onList} />);
    expect(screen.getByText(words.empty)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: words.add }));
    expect(screen.queryByText(words.empty)).toBeNull();
    expect(trigger(1, "").getAttribute("aria-expanded")).toBe("true");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(group(1)).getByRole("textbox", { name: words.nameLabel }),
      ),
    );
    expect(onList).toHaveBeenLastCalledWith([testCase("new1", "")]);
  });

  it("opens a test case to every field, with the labels a beginner author needs", async () => {
    render(<Harness initial={[testCase("t1", "Echoes Ada")]} />);
    await userEvent.click(trigger(1, "Echoes Ada"));
    const fields = within(group(1));
    for (const label of [
      words.nameLabel,
      words.stdinLabel,
      words.expectedLabel,
      words.hintLabel,
      words.afterCodeLabel,
    ]) {
      expect(fields.getByRole("textbox", { name: label })).toBeTruthy();
    }
    expect(fields.getByText(words.nameHint(TEST_CASE_LIMITS.name))).toBeTruthy();
    expect(fields.getByText(words.stdinHint)).toBeTruthy();
    expect(fields.getByText(words.expectedHint)).toBeTruthy();
    expect(fields.getByText(words.afterCodeHint)).toBeTruthy();
    const match = fields.getByRole("combobox", { name: words.matchLabel }) as HTMLSelectElement;
    expect(Array.from(match.options).map((option) => option.textContent)).toEqual([
      words.match.normalized,
      words.match.exact,
      words.match.contains,
    ]);
  });

  it("edits each field, and the title follows the name", async () => {
    const onList = vi.fn();
    render(<Harness initial={[testCase("t1", "Echoes")]} onList={onList} />);
    await userEvent.click(trigger(1, "Echoes"));
    const fields = within(group(1));
    await userEvent.type(fields.getByRole("textbox", { name: words.nameLabel }), " Ada");
    await userEvent.type(fields.getByRole("textbox", { name: words.stdinLabel }), "Ada");
    await userEvent.type(fields.getByRole("textbox", { name: words.expectedLabel }), "Hi Ada");
    await userEvent.type(fields.getByRole("textbox", { name: words.hintLabel }), "Use input()");
    await userEvent.type(fields.getByRole("textbox", { name: words.afterCodeLabel }), "print(x)");
    await userEvent.selectOptions(
      fields.getByRole("combobox", { name: words.matchLabel }),
      "contains",
    );
    expect(trigger(1, "Echoes Ada")).toBeTruthy();
    expect(onList).toHaveBeenLastCalledWith([
      {
        id: "t1",
        name: "Echoes Ada",
        stdin: "Ada",
        afterCode: "print(x)",
        expected: "Hi Ada",
        match: "contains",
        hint: "Use input()",
      },
    ]);
  });

  it("duplicates a test case right after it, under a new ID, opened", async () => {
    const onList = vi.fn();
    render(<Harness initial={[testCase("t1", "A"), testCase("t2", "B")]} onList={onList} />);
    await userEvent.click(trigger(1, "A"));
    await userEvent.click(screen.getByRole("button", { name: words.duplicate("A") }));
    expect(onList).toHaveBeenLastCalledWith([
      testCase("t1", "A"),
      testCase("new1", "A"),
      testCase("t2", "B"),
    ]);
    expect(trigger(2, "A").getAttribute("aria-expanded")).toBe("true");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(group(2)).getByRole("textbox", { name: words.nameLabel }),
      ),
    );
  });

  it("moves a test case and keeps focus on the button pressed, or the other one at an end", async () => {
    const onList = vi.fn();
    render(<Harness initial={[testCase("t1", "A"), testCase("t2", "B")]} onList={onList} />);
    await userEvent.click(trigger(1, "A"));
    expect((screen.getByRole("button", { name: "Move up: A" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await userEvent.click(screen.getByRole("button", { name: "Move down: A" }));
    expect(onList).toHaveBeenLastCalledWith([testCase("t2", "B"), testCase("t1", "A")]);
    expect(trigger(2, "A")).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Move up: A" })),
    );
  });

  it("deletes a test case and puts focus on the next one, or on Add after the last", async () => {
    const onList = vi.fn();
    render(<Harness initial={[testCase("t1", "A"), testCase("t2", "B")]} onList={onList} />);
    await userEvent.click(trigger(1, "A"));
    await userEvent.click(screen.getByRole("button", { name: words.remove("A") }));
    expect(onList).toHaveBeenLastCalledWith([testCase("t2", "B")]);
    await waitFor(() => expect(document.activeElement).toBe(trigger(1, "B")));
    await userEvent.click(trigger(1, "B"));
    await userEvent.click(screen.getByRole("button", { name: words.remove("B") }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: words.add })),
    );
    expect(screen.getByText(words.empty)).toBeTruthy();
  });

  it("stops at 12: no Add and no Duplicate, and says why", async () => {
    const twelve = Array.from({ length: 12 }, (_, index) =>
      testCase(`t${String(index + 1)}`, `Case ${String(index + 1)}`),
    );
    render(<Harness initial={twelve} />);
    expect(screen.getByText(words.intro(CHECK_TEST_LIMIT))).toBeTruthy();
    expect(screen.getByText(words.full(CHECK_TEST_LIMIT))).toBeTruthy();
    expect(screen.getByText(words.full(CHECK_TEST_LIMIT)).textContent).toContain("12");
    expect(screen.queryByRole("button", { name: words.add })).toBeNull();
    await userEvent.click(trigger(1, "Case 1"));
    expect(screen.queryByRole("button", { name: words.duplicate("Case 1") })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: words.remove("Case 1") }));
    expect(screen.queryByText(words.full(CHECK_TEST_LIMIT))).toBeNull();
    expect(screen.getByRole("button", { name: words.add })).toBeTruthy();
  });

  it("sets the test case number in the monospace face and the name in the interface face", () => {
    render(<Harness initial={[testCase("t1", "Echoes Ada")]} />);
    const number = trigger(1, "Echoes Ada").querySelector("[data-test-case-number]");
    expect(number?.textContent).toBe(words.group(1));
    expect(number?.className).toContain("font-mono");
  });

  it("[FR-ADM-06] shows each test case's verdict in its title, with the test case closed", () => {
    const view = (state: "pass" | "fail"): SolutionView => ({
      actual: "",
      truncated: false,
      cleaned: false,
      verdict: state === "pass" ? { state } : { state, reason: "mismatch" },
      fillable: false,
    });
    const solution = new Map<TestCaseId, SolutionView>([
      ["a" as TestCaseId, view("pass")],
      ["b" as TestCaseId, view("fail")],
      ["c" as TestCaseId, { ...view("pass"), verdict: undefined }],
    ]);
    function Closed() {
      return (
        <TestCaseList
          testCases={[testCase("a", "Doubles"), testCase("b", "Reads"), testCase("c", "Adds")]}
          onChange={() => undefined}
          problems={new Map()}
          solution={solution}
          expanded={new Set()}
          onExpandedChange={() => undefined}
          newId={() => "x"}
        />
      );
    }
    render(<Closed />);
    const first = screen.getByRole("button", {
      name: `${words.title(1, "Doubles")}${validation.titleVerdict(validation.verdict.pass)}`,
    });
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(within(first).getByText(validation.verdict.pass)).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: `${words.title(2, "Reads")}${validation.titleVerdict(validation.verdict.fail)}`,
      }),
    ).toBeTruthy();
    // A verdict about an older expected output is not shown.
    expect(trigger(3, "Adds")).toBeTruthy();
  });

  it("[FR-ADM-06] names the output and time limits of a failed verdict from the limits the runs use", () => {
    const failed = (reason: "output_limit" | "time_limit"): SolutionView => ({
      actual: "",
      truncated: false,
      cleaned: false,
      verdict: { state: "fail", reason },
      fillable: false,
    });
    const solution = new Map<TestCaseId, SolutionView>([
      ["a" as TestCaseId, failed("output_limit")],
      ["b" as TestCaseId, failed("time_limit")],
    ]);
    render(
      <Harness initial={[testCase("a", "Prints"), testCase("b", "Loops")]} solution={solution} />,
    );
    const output = within(group(1)).getByText(validation.reason.output_limit(HARNESS_OUTPUT_LIMIT));
    expect(output.textContent).toContain("64,000");
    const time = within(group(2)).getByText(validation.reason.time_limit(TIME_LIMIT_MS / 1000));
    expect(time.textContent).toContain("5 second");
  });

  it("puts each problem under its own field, with the limit", () => {
    const problems = new Map<TestCaseId, readonly TestCaseProblem[]>([
      [
        "t1" as TestCaseId,
        [
          { field: "name", code: "missing" },
          { field: "expected", code: "too_long", limit: 5_000 },
          { field: "afterCode", code: "too_long", limit: 2_000 },
        ],
      ],
    ]);
    render(<Harness initial={[testCase("t1", "")]} problems={problems} />);
    const fields = within(group(1));
    const name = fields.getByRole("textbox", { name: words.nameLabel });
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(fields.getByText(words.problem.nameMissing)).toBeTruthy();
    expect(fields.getByText("Keep the expected output to 5,000 characters.")).toBeTruthy();
    expect(fields.getByText("Keep the follow-up code to 2,000 characters.")).toBeTruthy();
    expect(
      fields.getByRole("textbox", { name: words.stdinLabel }).getAttribute("aria-invalid"),
    ).toBeNull();
  });

  it("[FR-ADM-06] shows the solution's verdict, the reason and what it printed", () => {
    const solution = new Map<TestCaseId, SolutionView>([
      [
        "a" as TestCaseId,
        {
          actual: "8\n",
          truncated: false,
          cleaned: false,
          verdict: { state: "fail", reason: "mismatch" },
          fillable: true,
        },
      ],
      [
        "b" as TestCaseId,
        {
          actual: "",
          truncated: false,
          cleaned: false,
          verdict: {
            state: "fail",
            reason: "program_error",
            error: { kind: "runtime", message: "ValueError: invalid literal", line: 2 },
          },
          fillable: false,
        },
      ],
    ]);
    render(
      <Harness initial={[testCase("a", "Doubles"), testCase("b", "Reads")]} solution={solution} />,
    );
    const first = within(group(1));
    expect(first.getByRole("heading", { name: validation.solutionHeading })).toBeTruthy();
    expect(first.getByText(validation.verdict.fail)).toBeTruthy();
    expect(first.getByText(validation.reason.mismatch)).toBeTruthy();
    expect(first.getByTestId("solution-output").textContent).toBe("8\n");
    const second = within(group(2));
    expect(second.getByText(validation.reason.program_error)).toBeTruthy();
    expect(second.getByText(validation.error("ValueError: invalid literal", 2))).toBeTruthy();
    expect(second.getByText(validation.noOutput)).toBeTruthy();
    expect(second.queryByRole("button", { name: validation.fillLabel("Reads") })).toBeNull();
  });

  it("[FR-ADM-06] Fill from solution copies what the solution printed into the expected output, and focus moves there", async () => {
    const onList = vi.fn();
    const solution = new Map<TestCaseId, SolutionView>([
      [
        "a" as TestCaseId,
        {
          actual: "6\n",
          truncated: false,
          cleaned: false,
          verdict: { state: "pass" },
          fillable: true,
        },
      ],
    ]);
    render(<Harness initial={[testCase("a", "Doubles")]} solution={solution} onList={onList} />);
    await userEvent.click(screen.getByRole("button", { name: validation.fillLabel("Doubles") }));
    expect(onList).toHaveBeenLastCalledWith([{ ...testCase("a", "Doubles"), expected: "6\n" }]);
    await waitFor(() =>
      expect(document.activeElement).toBe(within(group(1)).getByLabelText(words.expectedLabel)),
    );
  });

  it("[FR-ADM-06] says when the verdict is about an older expected output, and when the output was cut", () => {
    const solution = new Map<TestCaseId, SolutionView>([
      [
        "a" as TestCaseId,
        { actual: "6", truncated: true, cleaned: false, verdict: undefined, fillable: false },
      ],
    ]);
    render(<Harness initial={[testCase("a", "Doubles")]} solution={solution} />);
    expect(screen.getByText(validation.verdictOutdated)).toBeTruthy();
    expect(screen.getByText(validation.truncated(HARNESS_OUTPUT_LIMIT))).toBeTruthy();
    expect(screen.getByText(validation.truncated(HARNESS_OUTPUT_LIMIT)).textContent).toContain(
      "64,000",
    );
    expect(screen.queryByText(validation.verdict.pass)).toBeNull();
  });

  it("[T-07] shows a name, an expected output and printed output with markup as text, and says when control characters were removed", () => {
    const payload = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    const solution = new Map<TestCaseId, SolutionView>([
      [
        "a" as TestCaseId,
        {
          actual: `${payload}\n`,
          truncated: false,
          cleaned: true,
          verdict: { state: "fail", reason: "mismatch" },
          fillable: false,
        },
      ],
    ]);
    const { container } = render(
      <Harness initial={[{ ...testCase("a", payload), expected: payload }]} solution={solution} />,
    );
    expect(container.querySelector("img, script")).toBeNull();
    const first = within(group(1));
    expect(first.getByTestId("solution-output").textContent).toBe(`${payload}\n`);
    expect((first.getByLabelText(words.nameLabel) as HTMLInputElement).value).toBe(payload);
    expect((first.getByLabelText(words.expectedLabel) as HTMLTextAreaElement).value).toBe(payload);
    expect(first.getByText(validation.cleaned)).toBeTruthy();
    expect(first.queryByRole("button", { name: validation.fillLabel(payload) })).toBeNull();
  });
});
