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
// "The state" is what section 5.5 lists, plus the recursion limit and the
// trace and profile hooks: builtins, the module table, the three streams and
// a fresh namespace. Changes to a standard library module's attributes are
// not undone (ADR-0004). Nor is the harness itself protected: a program can
// reach its closure and change what later test cases on the same worker
// report, so a check is evidence only for code that is not hostile. Validate
// (WP-4.3) must start a new worker for each program (`freshWorker`); the spec
// text for that is an open owner decision.
//
// This file must stay erasable TypeScript: the Node runner's thread loads it
// with Node's own type stripping.

/** Included in every result (section 3.1). Change it with any change to the Python below. */
export const HARNESS_VERSION = "1";

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
    sys_snapshot = {name: sys_dict[name] for name in ("modules", "stdin", "stdout", "stderr")}
    line_cache = linecache.cache
    # Interpreter settings outside sys.__dict__ that a test case could change
    # for the next one, or use to run its code inside the harness.
    recursion_limit = sys.getrecursionlimit()
    set_recursion_limit = sys.setrecursionlimit
    set_trace = sys.settrace
    set_profile = sys.setprofile

    dict_clear = dict.clear
    dict_update = dict.update
    dict_pop = dict.pop
    dict_keys = dict.keys
    to_list = list
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

    def restore():
        set_trace(None)
        set_profile(None)
        set_recursion_limit(recursion_limit)
        dict_clear(builtins_dict)
        dict_update(builtins_dict, builtins_snapshot)
        dict_update(sys_dict, sys_snapshot)
        for name in to_list(dict_keys(modules)):
            if name not in modules_snapshot:
                dict_pop(modules, name, None)
        dict_update(modules, modules_snapshot)

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
    # whichever stage it came from. The hooks are cleared first, before any
    # call that could run them. Code that rewrites the harness's closure can
    # still make it raise; the worker then gives up and is replaced.
    def check(source, stdin, after_code):
        try:
            return run_case(source, stdin, after_code)
        except base_exception:
            set_profile(None)
            set_trace(None)
            try:
                restore()
            except base_exception:
                pass
            return result("program", "", False, ("runtime", "", None, None))

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
        collect()
        restore()
        return result(stage, text, truncated, error)

    return check
`;

/** What the worker and the Node runner evaluate: its value is the harness's `check`. */
export const HARNESS_SOURCE = `${HARNESS_DEFINITION}
_heap_make_grader()
`;
