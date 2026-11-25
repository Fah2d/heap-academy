import { afterEach, describe, expect, it, vi } from "vitest";

// Zod compiles an object schema with `new Function` when the page allows it,
// and finds out by trying. The script policy has no 'unsafe-eval', so in a
// browser that try is refused and reported (NFR-SEC-02, T-15). The schemas a
// browser loads must never try.

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("[NFR-SEC-02] schemas the browser loads", () => {
  it("never construct a function from text, building or parsing", async () => {
    const constructed = vi.fn(() => {
      throw new EvalError("refused by the script policy");
    });
    vi.stubGlobal("Function", constructed);
    const { courseDetails } = await import("./admin/course-details");
    const { lessonDraft } = await import("./admin/lesson-details");
    const { z } = await import("./schema");

    courseDetails.safeParse({ title: "Loops", slug: "loops", summary: "Repeat.", outcomes: [] });
    lessonDraft.safeParse({});
    z.strictObject({ name: z.string() }).parse({ name: "x" });

    expect(constructed).not.toHaveBeenCalled();
  });

  it("are built with Zod's code generation off", async () => {
    const { z } = await import("./schema");
    expect(z.config().jitless).toBe(true);
  });
});
