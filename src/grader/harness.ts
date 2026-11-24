// The Python harness (docs/spec/04-content-system.md section 3.1). It runs one
// test case as section 2.2 describes, with the isolation of
// docs/spec/02-architecture.md section 5.5, and returns a structured result.
// It does not raise to its caller because of the program's own errors.
//
// The Python worker and the Node runner evaluate this same text in Pyodide, so
// the two cannot run test cases differently (FR-GRD-04). It is trusted code
// next to untrusted code, so it is small and uses the standard library only.
//
// Everything the harness needs once learner code has started is held as a
// reference first. The program, or the follow-up code, may delete or replace
// any builtin, so nothing after that point looks a builtin up by name
// (section 14, pitfall 3). Learner code can still run after the program
// ends, in a `__str__` or a `__del__`, so the state is restored after the
// program, again after its objects are freed, and before the next case.
//
// "The state" is what section 5.5 lists, plus the interpreter's hooks and
// settings: builtins, the module table, the three streams, a fresh
// namespace, the import system's lists (sys.path, sys.meta_path,
// sys.path_hooks, sys.path_importer_cache), the line cache, the recursion
// limit, the integer digit limit, the trace and profile hooks, the
// sys.monitoring tools, the garbage collector's callbacks, saved garbage,
// debug flags, thresholds and enabled state, the async generator hooks, and
// the exception, unraisable, display and breakpoint hooks.
//
// Not undone: changes to a standard library module's attributes (ADR-0004),
// audit hooks (they cannot be removed), objects moved to the collector's
// permanent generation with gc.freeze() (memory only), and sys.monitoring
// local events set on a code object (no call clears them for every code
// object; a later case that takes the same tool id would receive them). A
// monitoring callback that moves to another tool id while the tools are freed
// is freed on a later pass. After each restore the state is checked by
// identity; if it is not back (a callback still moving after the last pass, or
// a __del__ that ran while the state was put back and changed it again), the
// harness raises NotRestored. It also raises when eight collections at the
// end of a case still find garbage (a chain of __del__ methods, each making a
// new reference cycle). The check itself runs no learner code, and
// restore() keeps the collector off until the check has passed, so an
// automatic collection cannot call a __del__ from a reference cycle after a
// part has passed. A fresh worker is the control for all of these.
//
// Nor is the harness itself protected: a program can reach its closure and
// change what later test cases on the same worker report, so a check is
// evidence only for code that is not hostile. Validate
// (WP-4.3) must start a new worker for each program (`freshWorker`); the spec
// text for that is an open owner decision.
//
// This file must stay erasable TypeScript: the Node runner's thread loads it
// with Node's own type stripping.

/** Included in every result (section 3.1). Change it with any change to the Python below. */
export const HARNESS_VERSION = "5";

/** The file name the learner's program has in tracebacks. */
export const HARNESS_PROGRAM_FILENAME = "main.py";
/** The file name the follow-up code has in tracebacks. */
export const HARNESS_TEST_FILENAME = "test.py";

/** The most output one test case keeps, in characters, as for a run (FR-RUN-03). */
export const HARNESS_OUTPUT_LIMIT = 64_000;
/** The longest error summary a result carries, in characters. */
export const HARNESS_MESSAGE_LIMIT = 1_000;
/** The longest missing name a result carries; a longer one is left out. */
export const HARNESS_NAME_LIMIT = 200;

export const HARNESS_DEFINITION = String.raw`
def _heap_make_grader():
    import builtins
    import gc
    import io
    import linecache
    import sys
    import traceback

    version = "${HARNESS_VERSION}"
    program_file = "${HARNESS_PROGRAM_FILENAME}"
    test_file = "${HARNESS_TEST_FILENAME}"
    output_limit = ${HARNESS_OUTPUT_LIMIT}
    message_limit = ${HARNESS_MESSAGE_LIMIT}
    name_limit = ${HARNESS_NAME_LIMIT}

    builtins_dict = builtins.__dict__
    builtins_snapshot = dict(builtins_dict)
    sys_dict = sys.__dict__
    modules = sys.modules
    modules_snapshot = dict(modules)
    sys_snapshot = {
        name: sys_dict[name]
        for name in (
            "modules", "stdin", "stdout", "stderr",
            "excepthook", "unraisablehook", "displayhook", "breakpointhook",
            "path", "meta_path", "path_hooks", "path_importer_cache",
        )
    }
    # The harness writes its two file names here before each case, so a key
    # the program left could run its __eq__ there; the cache is put back.
    line_cache = linecache.cache
    line_cache_snapshot = dict(line_cache)
    # Interpreter settings outside sys.__dict__ that a test case could change
    # for the next one, or use to run its code inside the harness.
    recursion_limit = sys.getrecursionlimit()
    set_recursion_limit = sys.setrecursionlimit
    set_trace = sys.settrace
    set_profile = sys.setprofile
    # The sys.monitoring tool ids (0 to 5) that are free now are freed again
    # after each case; freeing one also removes its events and callbacks.
    monitoring = sys.monitoring
    get_tool = monitoring.get_tool
    set_events = monitoring.set_events
    free_tool_id = monitoring.free_tool_id
    tool_ids = [tool for tool in range(6) if get_tool(tool) is None]
    # A callback can take a freed id again while the others are freed, so
    # the ids are freed in up to eight passes.
    passes = [index for index in range(8)]
    # The interpreter calls this list object, whatever gc.callbacks names.
    gc_callbacks = gc.callbacks
    gc_callbacks_snapshot = list(gc_callbacks)
    # A program can turn the collector off or change when it runs, which
    # changes the timing of every later case on the worker. With
    # gc.DEBUG_SAVEALL, the harness's own collection would keep the case's
    # objects in gc.garbage for the next case to read.
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
    digit_limit = sys.get_int_max_str_digits()
    set_digit_limit = sys.set_int_max_str_digits
    asyncgen_hooks = sys.get_asyncgen_hooks()
    set_asyncgen_hooks = sys.set_asyncgen_hooks
    get_asyncgen_hooks = sys.get_asyncgen_hooks
    get_digit_limit = sys.get_int_max_str_digits
    get_recursion_limit = sys.getrecursionlimit
    get_trace = sys.gettrace
    get_profile = sys.getprofile
    dict_get = dict.get
    dict_items = dict.items
    absent = object()

    dict_clear = dict.clear
    dict_update = dict.update
    dict_keys = dict.keys
    to_text = str
    join = str.join
    plain_text = str.__str__
    translate = str.translate
    split_lines = str.splitlines
    length = len
    kind_of = type
    is_subclass = issubclass
    integer = int
    attribute = getattr
    compile_code = compile
    execute = exec
    collect = gc.collect
    string_io = io.StringIO
    string_io_write = io.StringIO.write
    string_io_value = io.StringIO.getvalue
    format_only = traceback.format_exception_only
    base_exception = BaseException
    system_exit = SystemExit
    syntax_error = SyntaxError
    name_error = NameError
    eof_error = EOFError
    memory_error = MemoryError

    escapes = {code: "\\u%04x" % code for code in range(0x20)}
    escapes.update({code: "\\u%04x" % code for code in range(0xD800, 0xE000)})
    escapes[0x22] = '\\"'
    escapes[0x5C] = "\\\\"

    def quote(text):
        return '"' + translate(text, escapes) + '"'

    # Raised by a write past the limit. A BaseException, so the program's
    # "except Exception" does not swallow it.
    class OutputLimit(base_exception):
        pass

    # Raised when the state is not back after a restore, so that the harness
    # fails closed.
    class NotRestored(base_exception):
        pass

    # Raised when eight collections cannot free what a test case left. The
    # fallback does not catch it: the chain would still be there.
    class Uncollected(NotRestored):
        pass

    # Standard output of the program and the follow-up code, and how much
    # room is left. Past the limit a write keeps what fits and raises, so a
    # flood stops at its next print. A program can still reach the count,
    # through the write method's closure, or write around the capture; the
    # result is cut to the limit again at the end, and the grade is the
    # output limit. Memory is not bounded on those routes.
    def make_capture():
        state = {"room": output_limit, "truncated": False}

        class Capture(string_io):
            def write(self, text):
                if not is_subclass(kind_of(text), to_text):
                    return string_io_write(self, text)
                text = plain_text(text)
                room = state["room"]
                size = length(text)
                if size <= room:
                    state["room"] = room - size
                    return string_io_write(self, text)
                if room > 0:
                    string_io_write(self, text[:room])
                    state["room"] = 0
                state["truncated"] = True
                raise OutputLimit()

        return Capture(), state

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
        set_digit_limit(digit_limit)
        set_asyncgen_hooks(*asyncgen_hooks)
        set_recursion_limit(recursion_limit)
        dict_clear(builtins_dict)
        dict_update(builtins_dict, builtins_snapshot)
        dict_update(sys_dict, sys_snapshot)
        # Cleared rather than emptied name by name, so the program's keys are
        # not hashed while the table is cleared. A key a __del__ adds during
        # the clear is still compared by the update; intact() then fails.
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
    # keys with the same hash, and a learner's key could run its __eq__.
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
    # no object. Clearing a dict or a list frees the learner's objects in it,
    # and a __del__ that runs then can change the state again after its part
    # was put back: set a monitoring tool, add a builtin, put back a finder.
    def intact():
        if get_trace() is not None or get_profile() is not None:
            return False
        for tool in tool_ids:
            if get_tool(tool) is not None:
                return False
        hooks = get_asyncgen_hooks()
        if hooks[0] is not asyncgen_hooks[0] or hooks[1] is not asyncgen_hooks[1]:
            return False
        if get_recursion_limit() != recursion_limit or get_digit_limit() != digit_limit:
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

    def register(name, source):
        line_cache[name] = (length(source), None, split_lines(source, True), name)

    def innermost_file(error):
        name = None
        tb = error.__traceback__
        while tb is not None:
            name = tb.tb_frame.f_code.co_filename
            tb = tb.tb_next
        return name

    def program_line(error):
        line = None
        tb = error.__traceback__
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == program_file:
                line = tb.tb_lineno
            tb = tb.tb_next
        return line

    def summarize(error):
        try:
            text = format_only(kind_of(error), error)[-1].strip()
        except base_exception:
            text = kind_of(error).__name__
        if kind_of(text) is not to_text:
            return ""
        return text[:message_limit]

    def describe(error, stage, line_count):
        cls = kind_of(error)
        if is_subclass(cls, OutputLimit):
            return "output_limit", "", None, None
        message = summarize(error)
        if is_subclass(cls, syntax_error):
            line = error.lineno if stage == "program" else None
            kind = "syntax"
        else:
            line = program_line(error)
            kind = "runtime"
            if is_subclass(cls, eof_error):
                kind = "input_ended"
            elif is_subclass(cls, memory_error):
                kind = "memory"
        if kind_of(line) is not integer or line < 1 or line > line_count + 1:
            line = None
        # Follow-up code that names something the program did not define:
        # "This test needs something named area" (section 2.2). Only when the
        # follow-up code itself raised: a typo inside the learner's function
        # is the learner's error at its line.
        name = None
        if stage == "after_code" and is_subclass(cls, name_error) and innermost_file(error) == test_file:
            name = attribute(error, "name", None)
            if kind_of(name) is not to_text or length(name) > name_limit or name == "":
                name = None
        return kind, message, line, name

    # Python ends with status 0 for exit(), exit(0) and exit(False). An exit
    # whose code cannot be read did not finish cleanly.
    def finished(error):
        try:
            if not is_subclass(kind_of(error), system_exit):
                return False
            code = attribute(error, "code", None)
            return code is None or code is False or (kind_of(code) is integer and code == 0)
        except base_exception:
            return False

    def result(stage, output, truncated, error):
        parts = [
            '{"version": ', quote(version),
            ', "stage": ', quote(stage),
            ', "output": ', quote(output),
            ', "truncated": ', "true" if truncated else "false",
            ', "error": ',
        ]
        if error is None:
            parts.append("null}")
        else:
            kind, message, line, name = error
            parts.append('{"kind": ' + quote(kind) + ', "message": ' + quote(message))
            parts.append(', "line": ' + ("null" if line is None else to_text(line)))
            parts.append(', "name": ' + ("null" if name is None else quote(name)) + "}}")
        return join("", parts)

    # The harness does not raise to its caller because of the program's own
    # errors (section 3.1). Learner code can still reach the harness's own
    # steps, through a hook or an object the harness touches; then the test
    # case is a runtime error of the program, with no message and no output,
    # whichever stage it came from. The hooks are cleared first. A profile
    # hook still runs on the call that removes it, and can set a raising trace
    # hook on this frame; code that rewrites the harness's closure can too, and
    # so can a monitoring callback that raises on every call, as no call can
    # then run to free its tool. A state that is still not back after the
    # fallback, garbage that eight collections cannot free, or any failure in
    # the fallback's own collection makes the harness raise too. Then the
    # worker gives up with runtime_crashed and is replaced, and the Node
    # runner reports the test case as crashed.
    def check(source, stdin, after_code):
        try:
            return run_case(source, stdin, after_code)
        except Uncollected:
            raise
        except base_exception:
            pass
        # The fallback runs after the except block, so the failed case's
        # frame, which holds the case's namespace, is released before the
        # collection below.
        set_profile(None)
        set_trace(None)
        try:
            for tool in tool_ids:
                if get_tool(tool) is not None:
                    set_events(tool, 0)
                    free_tool_id(tool)
        except base_exception:
            pass
        try:
            restore()
        except base_exception:
            pass
        if not intact():
            raise NotRestored()
        # The namespace was not cleared, so what the case left is freed here.
        # Any failure now makes the harness raise.
        # collect_all() returns only after a restore that passed its check,
        # which leaves the collector as it was saved.
        try:
            collect_all()
        except base_exception:
            raise NotRestored()
        return result("program", "", False, ("runtime", "", None, None))

    # A __del__ that runs in a collection can make a new reference cycle,
    # which that collection does not free; the next case's own collection
    # would then run it in the middle of that case. So the harness collects
    # and restores until a collection finds nothing, and raises Uncollected
    # after eight passes (the same as the run support, WP-3.1 security
    # review 8, MAJOR 1).
    # The restore first: learner code runs while the namespace is cleared,
    # and an object it puts in the state could make a cycle only when that
    # restore frees it, after a first collection that found nothing (WP-3.3
    # security review 6, MAJOR 1).
    def collect_all():
        restore()
        for index in passes:
            found = collect()
            restore()
            if found == 0:
                return
        raise Uncollected()

    def run_case(source, stdin, after_code):
        restore()
        register(program_file, source)
        register(test_file, after_code)
        line_count = length(split_lines(source))
        output, state = make_capture()
        sys_dict["stdin"] = string_io(stdin)
        sys_dict["stdout"] = output
        sys_dict["stderr"] = string_io()
        namespace = {"__name__": "__main__", "__builtins__": builtins}
        stage = "program"
        failure = None
        try:
            execute(compile_code(source, program_file, "exec"), namespace)
        except base_exception as error:
            if not finished(error):
                failure = error
        if failure is None and after_code:
            stage = "after_code"
            try:
                execute(compile_code(after_code, test_file, "exec"), namespace)
            except base_exception as error:
                if not finished(error):
                    failure = error
        restore()
        error = None
        if failure is not None:
            try:
                error = describe(failure, stage, line_count)
            except base_exception:
                error = ("runtime", "", None, None)
        text = string_io_value(output)
        truncated = state["truncated"] is True
        if length(text) > output_limit:
            text = text[:output_limit]
            truncated = True
        dict_clear(namespace)
        namespace = None
        failure = None
        output = None
        collect_all()
        return result(stage, text, truncated, error)

    return check
`;

/** What the worker and the Node runner evaluate: its value is the harness's `check`. */
export const HARNESS_SOURCE = `${HARNESS_DEFINITION}
_heap_make_grader()
`;
