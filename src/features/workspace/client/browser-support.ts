// The support floor (FR-SYS-02, NFR-COMPAT-01): what this browser needs to
// run Python at all. Pyodide 314 loads only in a module worker (E-03), and it
// is WebAssembly. A browser without either sees a message instead of a
// workspace whose Run and Check could never work.

type Scope = { Worker?: unknown; WebAssembly?: unknown };

/**
 * Whether `scope` can start a module worker running WebAssembly. A browser
 * reads the `type` option only if it knows module workers; the address is
 * invalid on purpose, so the constructor throws before any request is made
 * and no worker starts.
 */
export function supportsPython(scope: Scope): boolean {
  if (typeof scope.WebAssembly !== "object" || scope.WebAssembly === null) return false;
  if (typeof scope.Worker !== "function") return false;
  const WorkerConstructor = scope.Worker as new (url: string, options: WorkerOptions) => unknown;
  let typeRead = false;
  const options = {
    get type(): WorkerType {
      typeRead = true;
      return "module";
    },
  };
  try {
    new WorkerConstructor("http://[", options);
  } catch {
    // Expected: the invalid address is refused after the options were read.
  }
  return typeRead;
}
