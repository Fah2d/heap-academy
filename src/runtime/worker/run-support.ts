// The Python that runs a learner's program inside the worker, with the
// isolation of architecture section 5.5. It is evaluated once, after the
// runtime loads and before any learner code, and returns a `run` function.
//
// Everything `run` needs after the learner's program has started is held as a
// reference first: the program may delete or replace any builtin, or any
// function of a module such as `json`, and the routine that restores them
// must not look one up by name (section 14, pitfall 3; found in the
// prototype, E-06).
//
// Learner code can still run after its program ends: a `__str__` when its
// error is formatted, a `__del__` when its objects are freed. So the state is
// restored after the program, again after its objects are gone, and once more
// before the next program starts.
//
// Written for Python 3.9 and later, so the same text runs in Pyodide (3.14)
// and in the CPython the unit tests start.

import { MESSAGE_LIMIT } from "../protocol.ts";

/** The file name tracebacks show for the learner's program. */
export const PROGRAM_FILENAME = "main.py";

/** The longest error summary a run reports, in characters. */
export const SUMMARY_LIMIT = MESSAGE_LIMIT;

export const RUN_SUPPORT_SOURCE = String.raw`
def _heap_make_runner():
    import builtins
    import gc
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
    to_text = str
    length = len
    kind_of = type
    is_subclass = issubclass
    integer = int
    compile_program = compile
    execute = exec
    collect = gc.collect
    translate = str.translate
    split_lines = str.splitlines
    format_only = traceback.format_exception_only
    format_full = traceback.format_exception
    base_exception = BaseException
    system_exit = SystemExit
    syntax_error = SyntaxError
    eof_error = EOFError
    memory_error = MemoryError

    # JSON string escapes, held here: json's own escaping reads module state a
    # program can change. Lone surrogates are escaped so the text stays valid.
    escapes = {code: "\\u%04x" % code for code in range(0x20)}
    escapes.update({code: "\\u%04x" % code for code in range(0xD800, 0xE000)})
    escapes[0x22] = '\\"'
    escapes[0x5C] = "\\\\"

    def quote(text):
        return '"' + translate(text, escapes) + '"'

    # Text a program prints reaches the page as it is written, not when a
    # buffer fills (FR-RUN-01: output streams while the program runs).
    for stream in streams.values():
        try:
            stream.reconfigure(line_buffering=True, write_through=True)
        except base_exception:
            pass

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
            text = "".join(format_full(kind_of(error), error, tb))
            streams["stderr"].write(text)
            streams["stderr"].flush()
        except base_exception:
            pass

    def flush():
        for stream in ("stdout", "stderr"):
            try:
                streams[stream].flush()
            except base_exception:
                pass

    def summarize(error):
        # The last line names the error ("SyntaxError: invalid syntax"); the
        # lines before it, for a syntax error, show where.
        try:
            text = format_only(kind_of(error), error)[-1].strip()
        except base_exception:
            text = kind_of(error).__name__
        if kind_of(text) is not to_text:
            return ""
        return text[:${SUMMARY_LIMIT}]

    # The class itself, not isinstance, which follows a __class__ the program
    # may have defined.
    def outcome(failure):
        if failure is None:
            return "ok", "", None
        summary = summarize(failure)
        cls = kind_of(failure)
        if is_subclass(cls, system_exit):
            code = failure.code
            if code is None or (kind_of(code) is integer and code == 0):
                return "ok", "", None
            return "runtime", summary, None
        if is_subclass(cls, syntax_error):
            report(failure, None)
            return "syntax", summary, failure.lineno
        tb = learner_frames(failure)
        report(failure, tb)
        line = last_line(tb)
        if is_subclass(cls, eof_error):
            return "input_ended", summary, line
        if is_subclass(cls, memory_error):
            return "memory", summary, line
        return "runtime", summary, line

    # Built without json, which the program can change. A line is kept only
    # if it is in the program (a syntax error may point one past its end).
    def result(kind, message, line, line_count):
        if kind_of(line) is not integer or line < 1 or line > line_count + 1:
            line = None
        line_text = "null" if line is None else to_text(line)
        return '{"kind": ' + quote(kind) + ', "message": ' + quote(message) + ', "line": ' + line_text + "}"

    def run(source):
        restore()
        line_cache[filename] = (length(source), None, split_lines(source, True), filename)
        namespace = {"__name__": "__main__", "__builtins__": builtins}
        failure = None
        try:
            execute(compile_program(source, filename, "exec"), namespace)
        except base_exception as error:
            failure = error
        # Builtins back first, so the error can be formatted; the program's
        # globals stay until then, because its __str__ may read them.
        restore()
        flush()
        try:
            kind, message, line = outcome(failure)
        except base_exception:
            # The error's own attributes raised; it is still the program's error.
            kind, message, line = "runtime", "", None
        dict_clear(namespace)
        namespace = None
        failure = None
        collect()
        restore()
        return result(kind, message, line, length(split_lines(source)))

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
