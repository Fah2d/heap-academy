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

/** The routine that makes the runner, for the unit tests to call with their own streams. */
export const RUN_SUPPORT_DEFINITION = String.raw`
def _heap_make_runner(require_streaming):
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
    sys_snapshot = {
        "modules": modules,
        **streams,
        **{
            name: sys_dict[name]
            for name in (
                "excepthook", "unraisablehook", "displayhook", "breakpointhook",
                "path", "meta_path", "path_hooks", "path_importer_cache",
            )
        },
    }

    # The same state the grading harness puts back between test cases
    # (src/grader/harness.ts, which keeps its own copy of this routine): a
    # program could otherwise change the learner's next run through it.
    # Each run writes the program's file name here, so a key the program left
    # could run its __eq__ there; the cache is put back.
    line_cache = linecache.cache
    line_cache_snapshot = dict(line_cache)
    recursion_limit = sys.getrecursionlimit()
    set_recursion_limit = sys.setrecursionlimit
    get_recursion_limit = sys.getrecursionlimit
    set_trace = sys.settrace
    set_profile = sys.setprofile
    get_trace = sys.gettrace
    get_profile = sys.getprofile
    # sys.monitoring (3.12) and the integer digit limit (3.11) are missing in
    # the older CPython some unit tests start; Pyodide has both.
    monitoring = getattr(sys, "monitoring", None)
    if monitoring is None:
        tool_ids = []
    else:
        get_tool = monitoring.get_tool
        set_events = monitoring.set_events
        free_tool_id = monitoring.free_tool_id
        # The tool ids (0 to 5) that are free now are freed again after each
        # run; freeing one also removes its events and callbacks.
        tool_ids = [tool for tool in range(6) if get_tool(tool) is None]
    # A callback can take a freed id again while the others are freed, so
    # the ids are freed in up to eight passes.
    passes = [index for index in range(8)]
    has_digit_limit = hasattr(sys, "set_int_max_str_digits")
    if has_digit_limit:
        digit_limit = sys.get_int_max_str_digits()
        set_digit_limit = sys.set_int_max_str_digits
        get_digit_limit = sys.get_int_max_str_digits
    asyncgen_hooks = sys.get_asyncgen_hooks()
    set_asyncgen_hooks = sys.set_asyncgen_hooks
    get_asyncgen_hooks = sys.get_asyncgen_hooks
    # The interpreter calls this list object, whatever gc.callbacks names.
    gc_callbacks = gc.callbacks
    gc_callbacks_snapshot = list(gc_callbacks)
    # With gc.DEBUG_SAVEALL, the run's own collection would keep the
    # program's objects in gc.garbage for the next run to read.
    gc_garbage = gc.garbage
    gc_garbage_snapshot = list(gc_garbage)
    gc_debug = gc.get_debug()
    gc_threshold = gc.get_threshold()
    gc_enabled = gc.isenabled()
    get_debug = gc.get_debug
    set_debug = gc.set_debug
    get_threshold = gc.get_threshold
    set_threshold = gc.set_threshold
    is_gc_enabled = gc.isenabled
    enable_gc = gc.enable
    disable_gc = gc.disable
    list_clear = list.clear
    list_extend = list.extend
    # Changed in place by an import hook or a program; the names themselves
    # are put back with sys_snapshot.
    import_lists = [(sys.path, list(sys.path)), (sys.meta_path, list(sys.meta_path)),
                    (sys.path_hooks, list(sys.path_hooks))]
    importer_cache = sys.path_importer_cache
    importer_cache_snapshot = dict(importer_cache)
    dict_get = dict.get
    dict_items = dict.items
    absent = object()

    dict_clear = dict.clear
    dict_update = dict.update
    dict_keys = dict.keys
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

    # Each line a program prints reaches the page when it is printed, not
    # when a buffer fills (FR-RUN-01: output streams while the program runs).
    # A line without its newline still waits. The worker refuses to start
    # without this; the unit tests' in-memory streams have nothing to set.
    if require_streaming:
        for name in ("stdout", "stderr"):
            streams[name].reconfigure(line_buffering=True, write_through=True)

    # Raised when the state is not back after a restore. It reaches core.ts,
    # which gives up with runtime_crashed, so the worker is replaced.
    class NotRestored(base_exception):
        pass

    # The profile hook goes first: it runs on the call that removes the trace
    # hook, and could put that hook back. A monitoring callback runs on these
    # calls too, until its tool is freed. Then the collector stays off until
    # the check has passed, so an automatic collection cannot run a __del__
    # from a reference cycle after its part was checked.
    def restore():
        set_profile(None)
        set_trace(None)
        for index in passes:
            in_use = False
            for tool in tool_ids:
                if get_tool(tool) is not None:
                    in_use = True
                    set_events(tool, 0)
                    free_tool_id(tool)
            if not in_use:
                break
        disable_gc()
        list_clear(gc_callbacks)
        list_extend(gc_callbacks, gc_callbacks_snapshot)
        list_clear(gc_garbage)
        list_extend(gc_garbage, gc_garbage_snapshot)
        set_debug(gc_debug)
        set_threshold(*gc_threshold)
        for current, snapshot in import_lists:
            list_clear(current)
            list_extend(current, snapshot)
        dict_clear(importer_cache)
        dict_update(importer_cache, importer_cache_snapshot)
        if has_digit_limit:
            set_digit_limit(digit_limit)
        set_asyncgen_hooks(*asyncgen_hooks)
        set_recursion_limit(recursion_limit)
        dict_clear(builtins_dict)
        dict_update(builtins_dict, builtins_snapshot)
        dict_update(sys_dict, sys_snapshot)
        # Cleared rather than emptied name by name, so the program's keys are
        # not hashed while the table is cleared.
        dict_clear(modules)
        dict_update(modules, modules_snapshot)
        dict_clear(line_cache)
        dict_update(line_cache, line_cache_snapshot)
        if is_gc_enabled() or not intact():
            raise NotRestored()
        if gc_enabled:
            enable_gc()

    def same_list(current, snapshot):
        if length(current) != length(snapshot):
            return False
        index = 0
        for item in current:
            if item is not snapshot[index]:
                return False
            index += 1
        return True

    # Every key is a plain str, checked before any lookup: a lookup compares
    # keys with the same hash, and a program's key could run its __eq__.
    def plain_keys(current):
        for key in dict_keys(current):
            if kind_of(key) is not to_text:
                return False
        return True

    def same_dict(current, snapshot):
        if length(current) != length(snapshot) or not plain_keys(current):
            return False
        for key, value in dict_items(snapshot):
            if dict_get(current, key, absent) is not value:
                return False
        return True

    # Whether the state is back, checked by identity and with calls that free
    # no object. Clearing a dict or a list frees the program's objects in it,
    # and a __del__ that runs then can change the state again after its part
    # was put back.
    def intact():
        if get_trace() is not None or get_profile() is not None:
            return False
        for tool in tool_ids:
            if get_tool(tool) is not None:
                return False
        hooks = get_asyncgen_hooks()
        if hooks[0] is not asyncgen_hooks[0] or hooks[1] is not asyncgen_hooks[1]:
            return False
        if get_recursion_limit() != recursion_limit:
            return False
        if has_digit_limit and get_digit_limit() != digit_limit:
            return False
        if get_debug() != gc_debug or get_threshold() != gc_threshold:
            return False
        if not plain_keys(sys_dict):
            return False
        for name, value in dict_items(sys_snapshot):
            if dict_get(sys_dict, name, absent) is not value:
                return False
        for current, snapshot in import_lists:
            if not same_list(current, snapshot):
                return False
        return (
            same_list(gc_callbacks, gc_callbacks_snapshot)
            and same_list(gc_garbage, gc_garbage_snapshot)
            and same_dict(importer_cache, importer_cache_snapshot)
            and same_dict(builtins_dict, builtins_snapshot)
            and same_dict(modules, modules_snapshot)
            and same_dict(line_cache, line_cache_snapshot)
        )

    def register(source):
        line_cache[filename] = (length(source), None, split_lines(source, True), filename)

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
            # Python exits with status 0 for None, 0 and False.
            if code is None or code is False or (kind_of(code) is integer and code == 0):
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
        register(source)
        namespace = {"__name__": "__main__", "__builtins__": builtins}
        failure = None
        try:
            execute(compile_program(source, filename, "exec"), namespace)
        except base_exception as error:
            failure = error
        # Builtins back first, so the error can be formatted; the program's
        # globals stay until then, because its __str__ may read them. The
        # restore empties the line cache, and the traceback shows the
        # program's lines from it, so the program goes back in.
        restore()
        register(source)
        flush()
        try:
            kind, message, line = outcome(failure)
        except base_exception as broken:
            # The error's own attributes raised; it is still the program's
            # error, of the kind its class names. A memory error, or running
            # out of memory while reading one, still ends in a new worker.
            cls = kind_of(failure)
            if is_subclass(cls, memory_error) or is_subclass(kind_of(broken), memory_error):
                kind = "memory"
            elif is_subclass(cls, eof_error):
                kind = "input_ended"
            else:
                kind = "runtime"
            message, line = "", None
        dict_clear(namespace)
        namespace = None
        failure = None
        collect()
        restore()
        return result(kind, message, line, length(split_lines(source)))

    return run
`;

/** What the worker evaluates: its value is the runner. */
export const RUN_SUPPORT_SOURCE = `${RUN_SUPPORT_DEFINITION}
_heap_make_runner(True)
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
