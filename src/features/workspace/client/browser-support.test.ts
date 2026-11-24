import { describe, expect, it } from "vitest";
import { supportsPython } from "./browser-support";

// A browser below the floor is told so instead of being shown a workspace
// that cannot run Python (FR-SYS-02).

class ModuleWorker {
  constructor(_url: string, options: WorkerOptions) {
    if (options.type === "module") throw new SyntaxError("invalid URL");
  }
}

class ClassicWorker {
  constructor(url: string) {
    throw new SyntaxError(`invalid URL ${url}`);
  }
}

describe("supportsPython [FR-SYS-02]", () => {
  it("accepts a browser with WebAssembly and module workers", () => {
    expect(supportsPython({ Worker: ModuleWorker, WebAssembly: {} })).toBe(true);
  });

  it("refuses a browser whose workers do not read the module option", () => {
    expect(supportsPython({ Worker: ClassicWorker, WebAssembly: {} })).toBe(false);
  });

  it("refuses a browser with no workers or no WebAssembly", () => {
    expect(supportsPython({ WebAssembly: {} })).toBe(false);
    expect(supportsPython({ Worker: ModuleWorker })).toBe(false);
    expect(supportsPython({ Worker: ModuleWorker, WebAssembly: null })).toBe(false);
  });
});
