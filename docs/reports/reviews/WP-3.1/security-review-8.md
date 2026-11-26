# Security review 8: WP-3.1, Run gets the harness's restore between runs

- Reviewer: security-reviewer, fresh context.
- The reviewer is read-only; this file was written by the implementer from the reviewer's reports.
- Scope: `src/runtime/worker/run-support.ts` and its tests, from the WP-3.3 "Not fixed" item "Run does not get the new restore".

## Round 1, on 4d6608f

Verdict: **CHANGES REQUIRED**, 2 MAJOR, 4 MINOR.

The reviewer compared the port with `restore()` and `intact()` of `origin/wp/3.3-grader:src/grader/harness.ts` routine by routine and found them the same. It also confirmed that the version guards are right for Pyodide 3.14. Every probe of the newly covered hooks and settings either reset cleanly or failed closed with `NotRestored`, including:

- a monitoring callback that raises on every call;
- a callback that moves between tool ids;
- `asyncio.run`;
- each row of the "carried over" table.

The probes ran in Pyodide 314.0.7 under Node, with `RUN_SUPPORT_SOURCE` and Pyodide's own streams.

### 1. MAJOR: a chain of `__del__` methods outlived the run's single `collect()`

- **Where:** `run-support.ts`, the end of `run`.
- **Finding:** a `__del__` that runs during the collection creates a new young cycle, and that cycle has its own `__del__`. The run's one collection did not free it. The next run's automatic collection then ran the chain in the middle of that program.
- **Evidence from the reviewer:** run 1's chain replaced `print`. Run 2 printed only the chain's own text, and run 3 did the same. Every run reported `ok`.
- **Fixed in 16711f5:**
  - The runner collects and restores until a collection finds nothing.
  - It raises `NotRestored` after eight passes.
  - A Pyodide test runs the reviewer's chain.
- **Not fixed here:** the harness has the same single `collect()` (`origin/wp/3.3-grader:src/grader/harness.ts`, the end of `run_case`). The reviewer inferred this from the code and did not run it. It is recorded for WP-3.3.

### 2. MAJOR: the three stream objects carry a program's changes to later runs

- **Where:** `run-support.ts`, the streams and `report()` and `flush()`.
- **How it differs from the harness:** the harness makes new streams for each case. The run support keeps the same three objects for the worker's whole life, and its `report()` and `flush()` looked up `.write` and `.flush` on them.
- **What the reviewer saw in Pyodide when run 1 changed a stream:**
  - A replaced `write` upper-cased run 2's output.
  - A replaced `stderr.write` hid run 2's traceback.
  - `stdout.close()` or `stdin.close()` broke every later run.
  - `reconfigure(encoding="ascii")` made `print("café")` raise.
  - `reconfigure(line_buffering=False, write_through=False)` turned streaming off (FR-RUN-01).
- **Fixed in 16711f5**, with the reviewer's minimum option:
  - Each stream's own `__dict__` is saved, put back in `restore()` and checked in `intact()`.
  - A stream that is closed, or whose encoding, errors, line buffering or write-through differ from the saved values, fails the check.
  - The runner writes and flushes through the methods of the stream's type, held at creation.
- **Tests added in 16711f5:**
  - Through `RUN_SUPPORT_SOURCE` with Pyodide's own streams:
    - a replaced `write` is gone in the next run;
    - each of the four `close` and `reconfigure` cases;
    - an error whose `__str__` replaces `stderr.write` still has its traceback written.
  - With a `__del__`: one that sets a stream attribute after its restore.
- **Decision:** the preferred option, new fd-backed streams for each run, was not taken. Nobody has verified it against Pyodide's per-run `setStdout` device swap. The minimum option fails closed, so the worker is replaced.

### 3. MINOR: the worker file system

- **Finding:** `sys.path[0]` is `''` and the working directory is `/home/pyodide`. A run that writes `statistics.py` there changes what the next run's `import statistics` loads.
- **Not fixed:** this needs the owner. One option is a new empty working directory for each run. The other is to record it as a residual risk in ADR-0004 and spec 06.

### 4. MINOR: `sys` names outside the snapshot

- **Finding:** `sys.tracebacklimit = 0` cut the runner's own traceback in the next run, and `sys.argv` changes carried over.
- **Fixed in 16711f5:**
  - `tracebacklimit` is removed again when it was absent at the snapshot, and kept by name when it was present.
  - `argv` is restored in place and by name.
  - Three table rows test them.
- **Not fixed:** other `sys` names outside the snapshot. ADR-0004 accepts this for learners.

### 5. MINOR: test strength

- **Fixed in 16711f5:**
  - a test where a `__del__` calls `gc.enable()` during the restore;
  - traceback source lines checked in Pyodide;
  - tests for findings 1 and 2.
- **Not fixed:** the multi-pass monitoring loop is not tested in the run support. The reviewer checked it by hand, and the harness tests it.

### 6. MINOR: the comment in `core.ts`

- **Finding:** the comment on an exception from `run` said it is "the runtime itself failing", but it can now be the program's own doing.
- **Fixed in 16711f5:** the comment is corrected.
- **Not fixed:** the learner sees the "crashed" message in that case. Whether that is acceptable is a question for the owner.

## Round 2, on 16711f5

Verdict: **CHANGES REQUIRED**, 1 MAJOR, 3 MINOR. Fixes 1, 4 and 6 of round 1 were confirmed correct.

The reviewer checked ordinary programs against the collect loop, and all of them pass:

- 300 000 objects that refer to themselves, plus 200 000 list cycles, in 114 ms;
- 10 000 cycles with a `__del__`;
- generators finalized in cycles;
- a `MemoryError`, which still ends as `memory`.

### 1. MAJOR: the stream objects could still be changed (round 1, MAJOR 2, not fixed by 16711f5)

- **Finding:** the type's `write`, `flush` and `readline` look up `write`, `flush` and `read1` on the buffer by name, and nothing saved the buffer or the raw file.
- **What the reviewer saw:**
  - A replaced `sys.stdout.buffer.write` or `sys.stdout.buffer.raw.write` rewrote the output of later runs.
  - `sys.stdin.buffer.read1` forged the next run's `input()`.
  - Calling `io.TextIOWrapper.__init__` on `sys.stdout` again kept the same object, the same `__dict__` and the same settings.
  - The settings check then read `closed` through the program's buffer, which ran the program's code inside `intact()`. A `closed` property that set a trace hook traced runs 2 and 3, and both reported `ok`.
- **Fixed in a24111c**, with the option the reviewer preferred in both rounds:
  - In the worker, each run gets three new text streams over file descriptors 0, 1 and 2.
  - The streams use the originals' encoding and errors, newline `"\n"`, and line buffering and write-through for output.
  - The originals are put back by name between runs, and the runner never reads them.
  - The stream snapshot and the settings check are gone.
- **How the fix was checked:** the reviewer checked in Node that such streams follow Pyodide's per-run `setStdout` and `setStdin`, which reopen file descriptors 0 to 2.
- **Tests:** they run `RUN_SUPPORT_SOURCE` and set the handlers before each run, as `core.ts` does. They cover each attack and check that a printed line still reaches the file at once.

### 2. MINOR: `reconfigure(newline="\r\n")` carried over

- **Fixed in a24111c**, by the new streams.
- **Test:** a test runs this case.

### 3. MINOR: unread input carried over

- **Finding:** run 1 read one character of `["ab", "cd"]`, and run 2's `input()` returned `"b"`. This was older than this series.
- **Fixed in a24111c**, by the new streams.
- **Test:** a test runs this case.

### 4. MINOR: the chain test was endless

- **Finding:** the test would pass with any pass limit.
- **Fixed in a24111c**, with two more tests:
  - a finite chain of five links, where run 1 is `ok` and run 2's `print` works;
  - the harness's test of a monitoring callback that takes a freed tool id.

### Not caused by this series

- **`asyncio.run`** fails in Pyodide under Node ("Cannot stack switch because the Python entrypoint was a synchronous function") on aec6c83 as well.
- **`warnings.simplefilter("error")`** carries over. ADR-0004 accepts this.

## Mutants

Each of these changes to `run-support.ts` was made on its own, and each fails at least one test in `run-support.test.ts`. The first list was run on 16711f5, where that file had 58 tests. The run on a24111c had 64 tests and dropped the four stream mutants, whose code a24111c removed.

- The profile hook or the trace hook not cleared.
- The tools not freed.
- The collector:
  - its callbacks not cleared, or not put back;
  - its saved garbage not cleared;
  - its debug flags or thresholds not put back;
  - the collector not turned back on;
  - the "collector is on" check removed.
- The `sys` lists not cleared.
- The importer cache not cleared.
- The digit limit, the async generator hooks or the recursion limit not put back.
- The line cache not put back.
- The `intact()` check disabled.
- The exception hook dropped from the snapshot.
- The program not written back into the line cache after the restore.
- One collection instead of the loop.
- The stream's own attributes not put back, or not checked.
- The stream settings not checked.
- The traceback written through `stderr.write` looked up on the stream.
- `tracebacklimit` not removed.
- `argv` not restored in place, or not restored by name.

On a24111c, these four take the place of the four stream mutants:

- No new streams.
- The new streams not bound into `sys`.
- No line buffering on them.
- The runner's traceback written through `sys.stderr`.

## Round 3, on a24111c and a7c3ba7

A first attempt at about 09:37 on 2026-11-24 was interrupted at 09:47 before it reported. This round ran on 2026-11-24 from about 14:10, in a clone of `wp/3.1-python-worker` at 01a141a (`git diff a7c3ba7 HEAD -- src/runtime` is empty).

Verdict: **CHANGES REQUIRED**, 2 MAJOR, 3 MINOR.

- **Scope:** `git show a24111c a7c3ba7`, which changes `src/runtime/worker/run-support.ts` and its tests. The reviewer also read the parts of `core.ts`, `controller.ts` and Pyodide 314.0.7's stream code that these commits rely on.
- **How the probes ran:** `run-support.ts` compiled with the repository's `tsc` into a scratch folder. A scratch Node script runs `RUN_SUPPORT_SOURCE` over Pyodide's own streams, calling `setStdout`, `setStderr` and `setStdin` before each run, as `core.ts` and the test helper `workerRunner()` do. For comparison, the same probes ran against copies of 16711f5 and aec6c83 built the same way.

### Answers to the four questions

1. **Do changes to the three streams, their buffers or raw files still reach the next run?**
   - **Fixed:** changes to the stream objects the program is given, and to their buffers. Every attack in round 2 now resets.
   - **Not fixed:** three other routes carry over: the codec the new streams look up each run (MAJOR 1, new in a24111c); the device files that Pyodide reopens as file descriptors 0, 1 and 2 (MAJOR 2, older than this series); the original streams, which a program can still reach as `sys.__stderr__` (MINOR 1).
2. **Does the settings check run the program's code?** The settings check is gone, and `intact()` now compares by identity only. But `make_streams()` runs code left by an earlier program, at the start of every run and after its restore (MAJOR 1).
3. **Does a7c3ba7 close the first-pass gap?** Yes. Reproduced without the new `restore()`; it closes with it. The test that came with it does not catch the gap (MINOR 2).
4. **New issues:** MAJOR 1 is new in a24111c. a7c3ba7 adds nothing new.

### 1. MAJOR: each run's new streams run code left by an earlier program, after that run's restore (new in a24111c)

- **Where:** `run-support.ts:188-205` (`make_streams`) and `run-support.ts:407-411`. `run` calls `restore()` first, then `make_streams()`, then binds the streams.
- **Finding:** `_io.TextIOWrapper(..., encoding=...)` looks the codec up by name in the interpreter's codec registry each run, and creates its incremental encoder and decoder from what it finds. A program can change that registry, and the change lasts for the worker's life: set attributes on the cached `CodecInfo` that `codecs.lookup("utf-8")` returns; put its own `CodecInfo` in `encodings._cache["utf_8"]`, then clear the interpreter's cache with `codecs.register(f); codecs.unregister(f)`; or patch `encodings.utf_8.IncrementalEncoder.__init__`.
- **Why it matters:** the code runs inside `make_streams()`, after the restore and before the next program starts, so `intact()` never sees what it sets; it sets a trace hook that is live for the whole next program. The encoder and decoder it supplies stay inside the new streams, so they rewrite every later run's output and forge its `input()`. On 16711f5 the streams were built once, before any learner code, so none of this happened (all three probes checked against 16711f5).
- **Evidence:** run 1 sets attributes on the cached codec, with an `Enc` class whose `__init__` calls `sys.settrace` and whose `encode` upper-cases, and a `Dec` class that returns `"forged\n"`. Then twice: `print("hello", sys.gettrace())` and `print(input())`, with stdin `["real"]`.
  ```
  a7c3ba7:  run 2: {"kind":"ok"} stdout "HELLO <FUNCTION ENC.__INIT__.<LOCALS>.<LAMBDA> AT 0X16A38A8>\nFORGED\n"
            run 3: {"kind":"ok"} stdout "HELLO <FUNCTION ENC.__INIT__.<LOCALS>.<LAMBDA> AT 0X113B008>\nFORGED\n"
  16711f5:  run 2: {"kind":"ok"} stdout "hello None\nreal\n"
  ```
  Through the cache clear and `encodings._cache`: a7c3ba7 gives `"HELLO NONE\nREAL\n"`, 16711f5 `"hello None\nreal\n"`. Through the `IncrementalEncoder.__init__` patch: a7c3ba7 gives `"hello <function init.<locals>.<lambda> ...>\nreal\n"` (a live trace hook), 16711f5 `"hello None\nreal\n"`.
- **Why ADR-0004 should not cover this:** ADR-0004 accepts that "a learner who mutates a preloaded standard library module affects later runs". That case needs a later program to use the module. Here the runner itself runs the code at the start of every run, so the stream rebinding and the restore of section 5.5 never take effect.
- **Suggested fix:** stop trusting a by-name lookup after the restore. Hold, when the runner is made, the `CodecInfo` for each encoding, its `incrementalencoder` and `incrementaldecoder` classes, and copies of the `__dict__`s involved. In `run`, make the streams first, with the collector off; check `_codecs.lookup(encoding) is held_codec`; then call `restore()`, so `intact()` checks whatever the lookup ran. Check in `intact()` the held copies, and that each new wrapper's encoder and decoder are instances of exactly the held classes (`gc.get_referents(stream)` lists them without running Python code). Raise `NotRestored` on any difference.
- **Tests to add:** the three probes above, each through `workerRunner()`, each expecting the next run to be clean or to raise `NotRestored`.

### 2. MAJOR: a program can replace the device files that Pyodide reopens as file descriptors 0, 1 and 2 (older than this series)

- **Where:** `run-support.ts:188-205`, where `file_io(0|1|2, ..., closefd=False)` trusts what the descriptors are now; and Pyodide's `refreshStreams` (`FS.closeStream(0),FS.closeStream(1),FS.closeStream(2),FS.open("/dev/stdin",0),FS.open("/dev/stdout",1),FS.open("/dev/stderr",1)`).
- **Finding:** `setStdout` and `setStdin` reopen descriptors 0 to 2 by path. A program that replaces `/dev/stdin` or `/dev/stdout` controls every later run's input and output for the worker's life. The commit's comment says nothing a program does to the streams or "their raw file" outlives the run; that is not true for the descriptors.
- **Evidence for input:** run 1 is `os.unlink("/dev/stdin"); open("/dev/stdin","w").write("forged\n")`. Then twice `print(input())` with stdin `["real"]`: run 2 and run 3 both `{"kind":"ok"} stdout "forged\n"`.
- **Evidence for output:** run 1 makes `/dev/stdout` a regular file and `/dev/stderr` a symlink to it. After that every run's output and traceback go into the file: run 2 `{"kind":"runtime","message":"ZeroDivisionError: division by zero","line":2} stdout "" stderr ""`, run 3 `{"kind":"ok"} stdout "" stderr ""`; run 4 read the earlier tracebacks back out of the file.
- **Where it came from:** 16711f5 and aec6c83 give the same results, so this series did not cause it.
- **What does not carry over:** `os.dup2` onto 1 or 2, and `os.close(0)`, are undone by the refresh. Deleting the files, a dangling symlink, or `chmod 0` makes `setStdout` or `setStdin` throw, and the run fails closed (see MINOR 3).
- **Relation to round 1, MINOR 3:** that finding waits on the owner. A new working directory for each run would not fix this one.
- **Suggested fix:** record, when the runner is made, `posix.fstat(fd).st_rdev` and confirm `S_ISCHR` for descriptors 0, 1 and 2, and hold `posix.fstat`. In `make_streams`, before wrapping, check that each descriptor is still that character device with that `st_rdev`; otherwise raise `NotRestored`. (In the probe, after the swap, `os.fstat(0)` showed `0o100666 False 0` instead of `0o20666 True 17152`.) Optionally `lstat` the three paths at the end of each run, so the run that made the change fails.
- **Tests to add:** the two probes above.

### 3. MINOR: the original streams still carry changes, and the interpreter writes to them after the program

- **Where:** `run-support.ts:169-178` (the comment "the runner never reads them") and `restore()`, which binds the originals back into `sys` at line 423, before the namespace is cleared and the collections run.
- **Finding:** the originals can be reached as `sys.__stdin__`, `sys.__stdout__` and `sys.__stderr__`, and a24111c removed their snapshot. From line 423 on, the interpreter writes to `sys.stderr`, the original by then, for warnings and unraisable exceptions raised while the namespace is cleared and while the runner collects.
- **Evidence:** run 1: `sys.__stderr__.buffer.write(b"FORGED by run 1 | ")`; run 2: `c = f()` with an `async def f` never awaited. Run 2's stderr was `"FORGED by run 1 | <exec>:413: RuntimeWarning: coroutine 'f' was never awaited\n..."`. With `sys.__stderr__.write = lambda s: 0` in an earlier run, the same warning in a later run was hidden (`stderr ""`). What the program's replaced `write` sets is undone by the restore at line 456.
- **Suggested fix:** keep the run's own streams bound in `sys` until the last collection has finished, and bind the originals only after that. Also bind `__stdin__`, `__stdout__` and `__stderr__` for the run.
- **Test to add:** the probe above.

### 4. MINOR: the a7c3ba7 test cannot fail, but one that can is cheap

- **Where:** `run-support.test.ts:744-774`.
- **Finding:** the runner's own leftover objects make the first collection find something (first pass: 15 or 16 objects). If the program ends with `import gc; gc.collect()`, the first collection finds nothing and the gap shows.
- **Evidence:**
  ```
  with a7c3ba7:    run 1 stdout "INJECTED\n"  passes "PASS 0 found 1 / PASS 1 found 0";  run 2 stdout "next\n"
  restore removed: run 1 stdout ""            passes "PASS 0 found 0";                   run 2 stdout "INJECTED\nnext\n"
  ```
- **Suggested fix:** add `"import gc", "gc.collect()"` as the last lines of that test's program; its "passes with or without" comment then no longer applies.

### 5. MINOR: `core.ts` sets the stream handlers outside its `try`

- **Where:** `core.ts:172-179`.
- **Finding:** since MAJOR 2, a program can make `setStdout` or `setStdin` throw on the next run, by deleting or `chmod 0`-ing a device file. The exception escapes `receive` with the core left in `running`, and no `fatal` is posted. The page recovers only through the worker's `error` event (`controller.ts:240-244`). Not verified in a browser that the event fires for an exception thrown in a `message` listener.
- **Suggested fix:** put the three handler calls inside the `try`, so the failure ends as `die("runtime_crashed")`.

### Confirmed correct

- The round 2 attacks (closing the stream, turning streaming off, changing the encoding or the line ending, replacing the buffer's or the raw file's `write`, calling `TextIOWrapper.__init__` again) each leave the next run's output at `"café\n||x"`, with nothing on stderr. Replaced or unread input does not reach the next run (`run-support.test.ts:657-717`).
- Nothing in `restore()` or `intact()` reads an attribute of a stream. The stream encoding and errors are read once, when the runner is made.
- After the program, `report()` and `flush()` call the type's methods on that run's own streams; the window left there is the same as the error's `__str__` and the program's `__del__`, contained by the restore and the collect loop.
- `os.dup2` onto 1 and 2 and `os.close(0)` do not reach the next run.

### Not caused by this series

- `encodings.utf_8.IncrementalDecoder._buffer_decode = staticmethod(...)` forges later runs' `input()` on 16711f5 as well (run 2 stdout `"hello None\nforged\n"` on both). This falls under the ADR-0004 residual risk; it also undoes round 2's "forged input" fix for this route.
- A warning raised while the namespace is cleared names the runner's line (`<exec>:413`), not the program's.

### What was run

- `node_modules/.bin/vitest run src/runtime` on 01a141a: `Test Files  7 passed (7)`, `Tests  170 passed (170)`.
- `node_modules/.bin/vitest run src/runtime/worker/run-support.test.ts`: `Tests  65 passed (65)`.
- Scratch probes against a7c3ba7, 16711f5 and aec6c83, in Pyodide 314.0.7 under Node 26.13.1. No file in the clone was edited.

### Not verified

- Any browser run; whether the worker's `error` event fires in a browser in MINOR 5's case; `pnpm verify`, type checks and lint; the mutants listed for a24111c other than the a7c3ba7 restore; whether WP-3.3's harness shares MAJOR 2 or MINOR 3.

## Round 4, on 7d76013 (2026-11-24)

Reviewer: `security-reviewer`, fresh context, read-only, on `wp/3.1-python-worker` at 9940fc8. Verdict: **CHANGES REQUIRED**, 2 MAJOR, 2 MINOR. Round 3's MAJOR 2 and MINOR 5 closed; MAJOR 1 partly closed; MINOR 3 mostly closed; MINOR 2's test not effective.

### 1. MAJOR: the runner's own codec check still runs a search function a program left

- **Where:** `run-support.ts:305` (the lookup in `make_streams`).
- **Finding:** a program registers a search function that returns the held codec, sets `encodings._cache['utf_8'] = None` so the built-in search returns None, and clears the interpreter's codec cache (`codecs.register(d); codecs.unregister(d)`). The next run's lookup misses the cache and calls the program's function; it returns the held object, so the `is` check passes, and the restore after it finds nothing wrong. The function's code runs on the next run's descriptors (it printed `FORGED` before `hello` in runs 2 to 5; with `os.read(0, 100)` run 2 ended `input_ended`), and a `__del__` cycle can clear the cache again so it repeats.
- **Suggested fix:** while the streams are made, a profile hook of the runner's own that raises `NotRestored` on any unexpected call.

### 2. MAJOR (older than this series): a program can replace the JavaScript stream setters

- **Where:** `core.ts:179-181`.
- **Finding:** `core.ts` read `runtime.setStdout`, `setStderr` and `setStdin` from the Pyodide object at every run. A program reaches that object as `pyodide_js` and can replace a setter for the worker's life; runs 2 and 3 of `print(input())` with stdin `["real"]` both printed `forged`, kind `ok`. A program can also patch Pyodide's internal file-system functions, which the setters call. A related route: a hook a program adds with `sys.addaudithook` sees every later run's `compile` event.
- **Suggested fix:** bind the three setters once at load, before any program code. Decide with the owner whether the `js` and `pyodide_js` modules stay reachable; if they do, record a residual risk next to ADR-0004. For the audit hook, the runner could add its own hook first, refusing `sys.addaudithook`.

### 3. MINOR: program code still runs after the originals are bound again

- **Where:** `run-support.ts:352-372`, `:666`.
- **Finding:** `clear_streams` cleared the stream, its buffer and its raw file, not the encoder's or decoder's `__dict__`. An object stored at `enc.keep` was freed in the second `settle()`, with the originals bound (`late: bound to originals=True`), and wrote into the original stdout's buffer, which came out in run 3.
- **Suggested fix:** clear, then check, the `__dict__` of the encoder or decoder each stream holds.

### 4. MINOR: round 3's MINOR 2 test still cannot fail

- **Finding:** with the leading `restore()` removed from `settle()`, all 78 tests in `run-support.test.ts` passed; the second `settle()` hides the gap.
- **Suggested fix:** a test where an object held by a stream makes a `__del__` cycle.

### What the reviewer ran

`vitest run src/runtime` on an unmodified copy: 7 files, 184 tests passed. `tsc --noEmit`: no errors. A mutant without the leading `restore()`: 78 of 78 passed. Scratch probes against the new code, the old code and the mutant in Pyodide 314.0.7 under Node 26.13.1, in `$TMPDIR`. Not verified: any browser run, `pnpm verify`, lint.

### Fixes after round 4

- **MAJOR 1:** the Python functions that making the streams calls (the held encoder's and decoder's `__init__`) are recorded when the runner is made, before any learner code, by making one set of streams under a recording profile hook. Each run makes its streams, lookups included, under a profile hook that raises `NotRestored` on a call to any other Python function, before its first line runs. A search function written in C runs no Python code. Test: the reviewer's probe makes the next run raise; with the guard removed it fails.
- **MAJOR 2, the setters:** `core.ts` takes the three setters and `runPython`, bound, into a frozen object when Pyodide loads, before any program. Test: a program that replaces all three leaves the next run's input and output alone; it fails on the code before.
- **MAJOR 2, the rest:** not fixed; for the owner (see below).
- **MINOR 3:** `clear_streams` also clears the encoder's or decoder's `__dict__` and puts back the state a new one has; `streams_clear` checks it. Test: an object stored on the encoder is freed while the run's streams are bound; with the reset removed it fails (`late other`).
- **MINOR 4:** a test where the stream's object puts another into builtins, whose freeing makes a cycle that makes a second cycle. With the leading `restore()` removed it fails (`cycle other`).

### Found while fixing: the runner's own functions can be rewritten

A program can find the runner's closures with `gc.get_objects()` and replace a function's `__code__` with code of its own that has the same free variables. Probe on the fixed code, Pyodide 314.0.7 under Node: a program replaced `flush`; runs 2 and 3 printed `next` / `third` followed by `PWNED <class 'BaseException'>` twice each, with the report `ok`, and no `NotRestored`. The same holds for any function the runner keeps, `restore` among them. This is the route the pull request description already lists under "Not fixed" (reaching the runner's closure through `sys._getframe` and `gc.get_referrers`), which section 6 accepts for a learner who only touches their own results; the fix that holds, a fresh worker, is what Validate uses. No check inside the worker can stop a program that rewrites the checker. Together with `pyodide_js` and Pyodide's file-system functions (MAJOR 2), a learner's program can always reach that learner's own later runs in the same worker, and nothing beyond it: the worker is the boundary (ADR-0004).
