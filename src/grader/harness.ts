// The Python harness (docs/spec/04-content-system.md section 3.1). It runs one
// test case as section 2.2 describes, with the isolation of
// docs/spec/02-architecture.md section 5.5, and returns a structured result.
// It never raises to its caller.
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

    builtins_dict = builtins.__dict__
    builtins_snapshot = dict(builtins_dict)
    sys_dict = sys.__dict__
    modules = sys.modules
    modules_snapshot = dict(modules)
    sys_snapshot = {name: sys_dict[name] for name in ("modules", "stdin", "stdout", "stderr")}
    line_cache = linecache.cache

    dict_clear = dict.clear
    dict_update = dict.update
    dict_pop = dict.pop
    dict_keys = dict.keys
    to_list = list
    to_text = str
    join = str.join
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

    # Standard output of the program and the follow-up code. Past the limit
    # a write keeps what fits and raises, so a flood stops at its next print.
    class Capture(string_io):
        def __init__(self):
            string_io.__init__(self)
            self.room = output_limit
            self.truncated = False

        def write(self, text):
            if kind_of(text) is not to_text:
                return string_io_write(self, text)
            room = self.room
            size = length(text)
            if size <= room:
                self.room = room - size
                return string_io_write(self, text)
            if room > 0:
                string_io_write(self, text[:room])
                self.room = 0
            self.truncated = True
            raise OutputLimit()

    def restore():
        dict_clear(builtins_dict)
        dict_update(builtins_dict, builtins_snapshot)
        dict_update(sys_dict, sys_snapshot)
        for name in to_list(dict_keys(modules)):
            if name not in modules_snapshot:
                dict_pop(modules, name, None)
        dict_update(modules, modules_snapshot)

    def register(name, source):
        line_cache[name] = (length(source), None, split_lines(source, True), name)

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
        # "This test needs something named area" (section 2.2).
        name = None
        if stage == "after_code" and is_subclass(cls, name_error):
            name = attribute(error, "name", None)
            if kind_of(name) is not to_text:
                name = None
        return kind, message, line, name

    # Python ends with status 0 for exit(), exit(0) and exit(False).
    def finished(error):
        if not is_subclass(kind_of(error), system_exit):
            return False
        code = error.code
        return code is None or code is False or (kind_of(code) is integer and code == 0)

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

    def check(source, stdin, after_code):
        restore()
        register(program_file, source)
        register(test_file, after_code)
        line_count = length(split_lines(source))
        output = Capture()
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
        truncated = output.truncated is True
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
