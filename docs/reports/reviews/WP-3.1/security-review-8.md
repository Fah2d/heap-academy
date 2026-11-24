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

## Round 3, on a24111c

Not done. A security-reviewer started on a24111c at about 09:37 on 2026-11-24. Its session was interrupted at 09:47 ("Request interrupted by user") before it reported anything. It was not started again, in case the interruption was on purpose. No reviewer has seen a24111c.
