// The Python that runs a learner's program inside the worker, with the
// isolation of architecture section 5.5. It is evaluated once, after the
// runtime loads and before any learner code, and returns a `run` function.
//
// Everything `run` needs after the learner's program has started is held as a
// reference first: the program may delete or replace any builtin, and the
// routine that restores them must not look one up by name (section 14,
// pitfall 3; found in the prototype, E-06). Only Python syntax is used after
// the program runs until the builtins are back.
//
// Written for Python 3.9 and later, so the same text runs in Pyodide (3.14)
// and in the CPython the unit tests start.

/** The file name tracebacks show for the learner's program. */
export const PROGRAM_FILENAME = "main.py";

export const RUN_SUPPORT_SOURCE = String.raw`
def _heap_make_runner():
    import builtins
    import json
    import linecache
    import sys
    import traceback

    filename = "${PROGRAM_FILENAME}"
    builtins_dict = builtins.__dict__
    builtins_snapshot = dict(builtins_dict)
    sys_dict = sys.__dict__
    modules = sys.modules
    modules_snapshot = dict(modules)
    streams = {name: sys_dict[name] for name in ("stdin", "stdout", "stderr")}
    sys_snapshot = {"modules": modules, **streams}
    line_cache = linecache.cache

    dict_clear = dict.clear
    dict_update = dict.update
    dict_pop = dict.pop
    dict_keys = dict.keys
    to_list = list
    compile_program = compile
    execute = exec
    dumps = json.dumps
    format_only = traceback.format_exception_only
    format_full = traceback.format_exception

    def restore():
        dict_clear(builtins_dict)
        dict_update(builtins_dict, builtins_snapshot)
        dict_update(sys_dict, sys_snapshot)
        for name in to_list(dict_keys(modules)):
            if name not in modules_snapshot:
                dict_pop(modules, name, None)
        dict_update(modules, modules_snapshot)

    def learner_frames(error):
        tb = error.__traceback__
        while tb is not None and tb.tb_frame.f_code.co_filename != filename:
            tb = tb.tb_next
        return tb

    def last_line(tb):
        line = None
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == filename:
                line = tb.tb_lineno
            tb = tb.tb_next
        return line

    def report(error, tb):
        try:
            text = "".join(format_full(type(error), error, tb))
            streams["stderr"].write(text)
            streams["stderr"].flush()
        except BaseException:
            pass

    def result(kind, message="", line=None):
        return dumps({"kind": kind, "message": message, "line": line})

    def run(source):
        line_cache[filename] = (len(source), None, source.splitlines(True), filename)
        namespace = {"__name__": "__main__", "__builtins__": builtins}
        failure = None
        try:
            execute(compile_program(source, filename, "exec"), namespace)
        except BaseException as error:
            failure = error
        finally:
            restore()
            namespace.clear()
        for stream in ("stdout", "stderr"):
            try:
                streams[stream].flush()
            except BaseException:
                pass
        if failure is None:
            return result("ok")
        # The last line names the error ("SyntaxError: invalid syntax"); the
        # lines before it, for a syntax error, show where.
        summary = format_only(type(failure), failure)[-1].strip()
        if isinstance(failure, SystemExit):
            if failure.code is None or failure.code == 0:
                return result("ok")
            return result("runtime", summary)
        if isinstance(failure, SyntaxError):
            report(failure, None)
            return result("syntax", summary, failure.lineno)
        tb = learner_frames(failure)
        report(failure, tb)
        line = last_line(tb)
        if isinstance(failure, EOFError):
            return result("input_ended", summary, line)
        if isinstance(failure, MemoryError):
            return result("memory", summary, line)
        return result("runtime", summary, line)

    return run

_heap_make_runner()
`;

export type RunReport = {
  kind: "ok" | "syntax" | "runtime" | "input_ended" | "memory";
  message: string;
  line: number | undefined;
};

const KINDS = ["ok", "syntax", "runtime", "input_ended", "memory"] as const;

/** Parses the JSON `run` returns. Anything else means the runtime is broken. */
export function parseRunReport(text: string): RunReport | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const kind: unknown = Reflect.get(value, "kind");
  const message: unknown = Reflect.get(value, "message");
  const line: unknown = Reflect.get(value, "line");
  const match = KINDS.find((option) => option === kind);
  if (match === undefined || typeof message !== "string") return undefined;
  if (line === null) return { kind: match, message, line: undefined };
  if (typeof line !== "number" || !Number.isSafeInteger(line) || line < 1) return undefined;
  return { kind: match, message, line };
}
