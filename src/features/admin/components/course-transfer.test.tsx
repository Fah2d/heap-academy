// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { structure, transfer as words } from "@/messages/admin";
import { fileText, lessonFile, LESSON_FILE_MAX_BYTES } from "../lesson-file";
import { CourseTransfer, type ExportCourse, type ImportLesson, saveFile } from "./course-transfer";

// Export and import on the course editor (FR-ADM-12, T-23): export hands the
// file to the browser; import names the field that is wrong before anything
// is sent, sends the parsed lesson to the chosen chapter, and starts no run.

const COURSE = "00000000-0000-4000-8000-000000000c01";
const FIRST = "00000000-0000-4000-8000-000000000d01";
const SECOND = "00000000-0000-4000-8000-000000000d02";
const LESSON = "00000000-0000-4000-8000-000000000e01";
const chapters = [
  { id: FIRST, title: "First steps" },
  { id: SECOND, title: "Loops" },
];

const lesson = lessonFile({
  title: "Say hello by name",
  slug: "say-hello",
  xp: 10,
  instructionsMd: "## Ask",
  hints: [],
  starterCode: "",
  solutionCode: 'print("Hello, " + input())',
  wrongAnswers: [],
  testCases: [
    {
      id: "greets" as never,
      name: "Greets",
      stdin: "Sara\n",
      afterCode: "",
      expected: "Hello, Sara",
      match: "normalized",
      hint: "",
    },
  ],
});

const never = () => new Promise<never>(() => undefined);
const ok = <Value,>(value: Value) => Promise.resolve({ ok: true as const, value });
const jsonFile = (text: string, name = "lesson.json") =>
  new File([text], name, { type: "application/json" });

const workers = vi.fn();
beforeEach(() => {
  // Nothing on this panel may start Python (T-23).
  vi.stubGlobal(
    "Worker",
    class {
      constructor() {
        workers();
      }
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  workers.mockReset();
});

function setup(
  overrides: Partial<{
    exportCourse: ExportCourse;
    importLesson: ImportLesson;
    chapters: typeof chapters;
  }> = {},
) {
  const refresh = vi.fn();
  const save = vi.fn();
  render(
    <CourseTransfer
      courseId={COURSE}
      chapters={overrides.chapters ?? chapters}
      exportCourse={overrides.exportCourse ?? never}
      importLesson={overrides.importLesson ?? never}
      refresh={refresh}
      save={save}
    />,
  );
  return { refresh, save };
}

const fileField = () => screen.getByLabelText(words.fileLabel) as HTMLInputElement;
const importButton = () => screen.getByRole("button", { name: words.importLesson });

describe("CourseTransfer export [FR-ADM-12]", () => {
  it("saves the course file under its name and says so", async () => {
    const exportCourse = vi.fn(() => ok({ fileName: "python-basics.json", text: "{}\n" }));
    const { save } = setup({ exportCourse });
    await userEvent.click(screen.getByRole("button", { name: words.exportCourse }));
    expect(exportCourse).toHaveBeenCalledWith({ id: COURSE });
    expect(await screen.findByText(words.exported("python-basics.json"))).toBeTruthy();
    expect(save).toHaveBeenCalledWith("python-basics.json", "{}\n");
  });

  it("says a failed export failed and saves nothing", async () => {
    const { save } = setup({ exportCourse: () => Promise.reject(new Error("offline")) });
    await userEvent.click(screen.getByRole("button", { name: words.exportCourse }));
    expect(await screen.findByText(words.exportFailed)).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });

  it("says which lesson to look for when one cannot be read", async () => {
    setup({ exportCourse: () => Promise.resolve({ ok: false, error: "export_broken" }) });
    await userEvent.click(screen.getByRole("button", { name: words.exportCourse }));
    expect(await screen.findByText(words.exportBroken)).toBeTruthy();
  });

  it("hands the text to the browser's download, and lets the address go only later", () => {
    vi.useFakeTimers();
    const created: Blob[] = [];
    const revoke = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: (blob: Blob) => {
        created.push(blob);
        return "blob:course";
      },
      revokeObjectURL: revoke,
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      // jsdom does not download.
    });
    saveFile("python-basics.json", "{}\n");
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe("python-basics.json");
    expect(link.getAttribute("href")).toBe("blob:course");
    expect(created[0]?.type).toBe("application/json");
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(revoke).toHaveBeenCalledWith("blob:course");
    click.mockRestore();
    vi.useRealTimers();
  });
});

describe("CourseTransfer import [FR-ADM-12, T-23]", () => {
  it("imports the chosen file into the chosen chapter as a draft, and runs nothing", async () => {
    const importLesson = vi.fn(() => ok({ id: LESSON, slug: "say-hello" }));
    const { refresh } = setup({ importLesson });
    await userEvent.selectOptions(screen.getByLabelText(words.chapterLabel), SECOND);
    await userEvent.upload(fileField(), jsonFile(fileText(lesson)));
    await userEvent.click(importButton());
    expect(importLesson).toHaveBeenCalledWith({ courseId: COURSE, chapterId: SECOND, lesson });
    expect(
      await screen.findByText(words.imported(lesson.title, "Loops"), { exact: false }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: words.openLesson(lesson.title) }).getAttribute("href"),
    ).toBe(`/admin/lessons/${LESSON}`);
    expect(
      screen.queryByText(words.slugChanged("say-hello", "say-hello"), { exact: false }),
    ).toBeNull();
    expect(refresh).toHaveBeenCalledOnce();
    expect(fileField().value).toBe("");
    expect(workers).not.toHaveBeenCalled();
  });

  it("says when the draft got another address", async () => {
    setup({ importLesson: () => ok({ id: LESSON, slug: "say-hello-2" }) });
    await userEvent.upload(fileField(), jsonFile(fileText(lesson)));
    await userEvent.click(importButton());
    expect(
      await screen.findByText(words.slugChanged("say-hello-2", "say-hello"), { exact: false }),
    ).toBeTruthy();
  });

  it.each([
    ["no file", undefined, words.fileMissing],
    ["text that is not JSON", jsonFile("{ title"), words.notJson],
    [
      "a lesson with too much XP",
      jsonFile(JSON.stringify({ ...lesson, xp: 99 })),
      words.fieldInvalid("xp"),
    ],
    [
      "a test case with no expected output",
      jsonFile(JSON.stringify({ ...lesson, tests: [{ id: "a", name: "A" }] })),
      words.fieldInvalid("tests[0].expected"),
    ],
    ["a file over the limit", jsonFile("x".repeat(LESSON_FILE_MAX_BYTES + 1)), words.fileTooLarge],
  ])("refuses %s on the field, sends nothing and focuses the field", async (_, file, sentence) => {
    const importLesson = vi.fn(never);
    setup({ importLesson });
    if (file !== undefined) await userEvent.upload(fileField(), file);
    await userEvent.click(importButton());
    expect(await screen.findByText(sentence)).toBeTruthy();
    expect(fileField().getAttribute("aria-invalid")).toBe("true");
    expect(fileField().getAttribute("aria-describedby")).toContain(
      screen.getByText(sentence).closest("p")?.id ?? "missing",
    );
    expect(document.activeElement).toBe(fileField());
    expect(importLesson).not.toHaveBeenCalled();
    expect(workers).not.toHaveBeenCalled();
  });

  it("refuses a lesson too large to send, though the file is under the read limit", async () => {
    const importLesson = vi.fn(never);
    setup({ importLesson });
    // Each control character is six bytes once written as JSON.
    const wide = "\u0001".repeat(5_000);
    const tests = Array.from({ length: 12 }, (_, n) => ({
      ...lesson.tests[0],
      id: `t${String(n)}`,
      stdin: wide.slice(0, 2_000),
      afterCode: wide.slice(0, 2_000),
      expected: wide,
    }));
    const text = JSON.stringify({
      ...lesson,
      tests,
      solution_code: "\u0001".repeat(10_000),
      starter_code: "\u0001".repeat(10_000),
    });
    expect(text.length).toBeLessThan(LESSON_FILE_MAX_BYTES);
    await userEvent.upload(fileField(), jsonFile(text));
    await userEvent.click(importButton());
    expect(await screen.findByText(words.fileTooLarge)).toBeTruthy();
    expect(importLesson).not.toHaveBeenCalled();
  });

  it("sends one import when Import is pressed twice", async () => {
    const importLesson = vi.fn(never);
    setup({ importLesson });
    await userEvent.upload(fileField(), jsonFile(fileText(lesson)));
    const form = importButton().closest("form")!;
    form.requestSubmit();
    form.requestSubmit();
    await screen.findByText(words.importing);
    expect(importLesson).toHaveBeenCalledOnce();
  });

  it("says a draft may be left behind when the import could not clean up", async () => {
    setup({ importLesson: () => Promise.resolve({ ok: false, error: "import_left_draft" }) });
    await userEvent.upload(fileField(), jsonFile(fileText(lesson)));
    await userEvent.click(importButton());
    expect(await screen.findByText(words.failure.import_left_draft)).toBeTruthy();
  });

  it("clears the field's error when another file is chosen", async () => {
    setup();
    await userEvent.click(importButton());
    expect(screen.getByText(words.fileMissing)).toBeTruthy();
    await userEvent.upload(fileField(), jsonFile(fileText(lesson)));
    expect(screen.queryByText(words.fileMissing)).toBeNull();
    expect(fileField().getAttribute("aria-invalid")).toBe("false");
  });

  it("explains a refused import and reads nothing again", async () => {
    const { refresh } = setup({
      importLesson: () => Promise.resolve({ ok: false, error: "chapter_not_found" }),
    });
    await userEvent.upload(fileField(), jsonFile(fileText(lesson)));
    await userEvent.click(importButton());
    expect(await screen.findByText(words.failure.chapter_not_found)).toBeTruthy();
    expect(screen.getByText(structure.errorLabel, { exact: false })).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("asks for a chapter first when the course has none", () => {
    setup({ chapters: [] });
    expect(screen.getByText(words.importNeedsChapter)).toBeTruthy();
    expect(screen.queryByLabelText(words.fileLabel)).toBeNull();
    expect(screen.getByRole("button", { name: words.exportCourse })).toBeTruthy();
  });
});
