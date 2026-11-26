# WP-3.3 security review 4

- Reviewer: security-reviewer subagent, fresh context, read-only. It could not write files; this report is saved from its messages and condensed.
- Range: 203b6bb (round 1), 6a4f0f8 (round 2), 839707a (round 3) on `wp/3.3-grader`. The commits answer security review 2, MINOR 5: `sys.monitoring` callbacks, `gc.callbacks`, `sys.excepthook` and `sys.unraisablehook` survived into later test cases on the same interpreter.
- Threats in scope: T-22 (same worker only), FR-RUN-04, FR-GRD-01, `CLAUDE.md` rule 4, `docs/spec/02-architecture.md` section 5.5, `docs/spec/04-content-system.md` section 3.1.
- Date: 2026-11-24
- The reviewer ran `pnpm exec vitest run src/grader/harness.test.ts` and its own probe and mutant scripts under Node 26.13.1 against the repository's Pyodide 314.0.7. It did not run the harness in a browser or `pnpm verify`.

## Round 1, on 203b6bb: CHANGES REQUIRED, 4 MINOR

**MINOR 1** `src/grader/harness.ts`, the tool sweep in `restore` and in the fallback. The sweep ran once. A monitoring callback on `CALL` fired on `set_events(own_id, 0)`, took an id the sweep had already freed, and wrote into every later test case. The header said the tools were restored.

```
hostile: {"version": "3", "stage": "program", "output": "", ... "error": null}
victim1: {"version": "3", "stage": "after_code", "output": "INJECTED\u000a12\u000a", ... "error": null}
victim2: ... "output": "['hop', None, None, None, None, None]\u000a"
```

Fix asked: repeat the sweep with a fixed limit, raise when tools are still in use, and test the relocating program.

**MINOR 2** The comment said freeing a tool "also removes its events". Local events set with `set_local_events` stay on the code object:

```
local-after: ... "output": "None 1\u000a"   (get_tool(1), get_local_events(1, json.dumps.__code__))
```

Fix asked: name it in the header as not undone.

**MINOR 3** Three hooks of the same kind persisted unnamed: `sys.meta_path` changed in place, the async generator hooks, and the integer digit limit.

```
metapath-after: ... "output": "FINDER decimal\u000aFINDER _decimal\u000aFINDER numbers\u000ax\u000a"
asyncgen-after: ... "asyncgen_hooks(firstiter=<function <lambda> at 0x15ee598>, finalizer=None)"
intdigits-after: ... "error": {"kind": "runtime", "message": "ValueError: Exceeds the limit (640 digits) ..."
```

Fix asked: restore `meta_path`, `path_hooks`, `path` and `path_importer_cache` by contents, the async generator hooks and the digit limit, or name them as not undone.

**MINOR 4** Two header comment lines of 124 and 105 characters were not rewrapped.

Found holding in round 1: tool ids 0 to 5 are the right set (6 and 7 belong to `settrace` and `setprofile`); keeping the interpreter's own `gc.callbacks` list means rebinding the name does not escape; every raise ends in `runtime_crashed` (`src/runtime/worker/core.ts:244-248`) or in a raise out of the Node host; `HARNESS_VERSION` and the hash moved together. Its mutants: 8 killed, 2 equivalent on this runtime (the `gc.callbacks` snapshot is empty in Pyodide 314.0.7; `free_tool_id` clears global events anyway).

All four fixed in 6a4f0f8: up to eight passes and a raise; local events and audit hooks named in the header; the import lists, the importer cache, the digit limit and the async generator hooks restored; the header rewrapped.

## Round 2, on 6a4f0f8: CHANGES REQUIRED, 2 MINOR

All four round-1 minors fixed; the relocating program now makes the harness raise (`RAISED _heap_make_grader.<locals>.ToolsInUse`).

**MINOR 1** `dict_clear(builtins_dict)` then `dict_update`, older than this range. `dict.clear` frees the old values after it swaps in an empty table, so a `__del__` running then can write a new object into builtins and register a tool after the sweep. The same opening exists at the new `list_clear` and `dict_clear` calls on the import lists and the importer cache.

```
hostile: {"version": "3", ... "error": null}
victim1: {"version": "3", "stage": "after_code", "output": "INJECTED\u000a12\u000a", ...}
victim2: {"version": "3", "stage": "after_code", "output": "INJECTED\u000a12\u000a", ...}
victim3: ... "output": "del True\u000a"
```

Fix asked: end `restore()` with checks that free no learner object (no tool in use, no trace or profile hook, the builtins as in the snapshot) and raise when one fails.

**MINOR 2** The import-list test compared two runs taken after the change, so mutants that left `path_hooks` out of the restored lists, or `path_importer_cache` out of the restored names, survived. Fix asked: compare with a run from before the change, and add a case that rebinds the four names.

Both fixed in 839707a: `intact()` checks every restored part by identity, with calls that free no object, at the end of `restore()` and after the fallback, and the harness raises `NotRestored` when it fails; the import-list test compares with a run from before and rebinds the four names.

## Round 3, on 839707a: CHANGES REQUIRED, 2 MINOR

The session that ran this round stopped before it saved the reviewer's message, so the findings below are taken from the fixes that session left uncommitted and the tests it wrote for them. The reviewer's own evidence for this round is not available.

**MINOR 1** A key with the hash of a builtin's name and an `__eq__` that returns True could take the place of that name. `intact()` looked the name up, the key's `__eq__` ran inside the check, and the lookup returned the real value, so the check passed with a foreign key in the builtins. The same held for `sys.__dict__`, which `restore()` does not clear.

**MINOR 2** There was no test per part `intact()` checks, where a `__del__` changes that part after its restore.

Both fixed in f4c7a16: `plain_keys()` checks that every key is exactly `str` before any lookup, in `same_dict` and for `sys.__dict__`; a table of nine probes, one per part; a test for a builtin key and one for a `sys.__dict__` key that are not `str`. The header now says that an automatic garbage collection during the check can still call a `__del__`.

## Round 4, on f4c7a16: CHANGES REQUIRED, 1 MAJOR, 2 MINOR

Finding (a) of round 3 is closed inside `intact()`. Finding (b) only partly.

**MAJOR** `src/grader/harness.test.ts:562-647` against `src/grader/harness.ts:252-294`. Six of the reviewer's twelve mutants failed only the hash pin (`Tests 1 failed | 55 passed (56)`): `kind_of(key) is not to_text` changed to `not is_subclass(kind_of(key), to_text)`; `plain_keys` moved after the lookups in `same_dict`; `plain_keys(sys_dict)` moved after the sys-name loop; the profile-hook check removed; the digit-limit check removed; the async generator finalizer check removed. The first is a real gap if the code ever changes that way: a `str` subclass key with the hash of `len`, added by a `__del__`:

```
real harness case1: {"output": "", "error": {"kind": "runtime", "message": "", ...}}
mutant M1 case1:    {"output": "INJECTED\u000a", "error": null}
```

Fix asked: table rows for the profile hook, the digit limit, the finalizer and a monitoring tool; a `str` subclass key test for the builtins and for `sys.__dict__`; a test that pins the check order, with a key whose `__eq__` puts the real entry back.

**MINOR 1** `src/grader/harness.ts:90` and `:296-297`. The same key class works on `linecache.cache`, which `register()` writes after `intact()` passed. A key with the hash of `"main.py"` ran its `__eq__` in every later case, walked to the `run_case` frame and rewrote the source:

```
B case1: {"stage": "program", "output": "case 1 ran\u000a", "error": null}
B case2 (program prints 'honest'): {"stage": "program", "output": "FORGED\u000a", "error": null}
B case3: {"stage": "program", "output": "FORGED\u000a", "error": null}
```

MINOR because the header already concedes that a program can reach the harness's closure (the reviewer's probe C replaced `run_case`'s `restore` cell and got `FORGED` with no raise). Fix asked: put `line_cache` back from a snapshot in `restore()` and check it in `intact()`.

**MINOR 2** `src/grader/harness.ts:233-235`. `name not in modules_snapshot` and `dict_pop` hash a learner key of the module table, so learner code runs with the harness's frames on the stack. No gain found beyond what a program can already do. Fix asked: avoid hash operations on keys that are not `str`.

Found holding: `type()` cannot be spoofed (a metaclass `__call__` has no effect; `__class__ = str` on a `str` subclass raises `TypeError`); `kind_of` and `to_text` are closure captures; iterating with `dict.keys` and calling `type(k)` runs no learner code (a logging subclass recorded `[]`); `plain_keys` covers every dict `intact()` looks up in. The garbage-collection residual named in the header could not be triggered on Pyodide 314.0.7 (Python 3.14.2) with `gc.set_threshold(1,1,1)` and 5000 allocations. Noted: the `gc` thresholds and `gc.isenabled()` carry over between cases (`(1, 1, 0) False`).

Ran: `pnpm exec vitest run src/grader/harness.test.ts` (56 passed), `pnpm verify` (exit 0, 1087 tests), probe scripts p1 to p10 and 12 mutants under `$TMPDIR`. Not verified: a browser worker.

All three fixed in 7468f65: five table rows (profile hook, digit limit, finalizer, monitoring tool 4, line cache); a `str` subclass key test for the builtins and for `sys.__dict__`; a check-order test for each of the two dicts, with a key whose `__eq__` puts the name back and removes itself; `linecache.cache` put back from a snapshot at the end of `restore()` and checked in `intact()`, with a test that a key left there does not run in the next case; the module table cleared and updated instead of emptied name by name. The reviewer's six surviving mutants and three more (line cache restore removed, line cache check removed, tool check removed) each fail at least one test other than the hash pin.

## Round 5, on 7468f65: APPROVE, 1 MINOR

7468f65 closes the round-4 major and both minors. The reviewer found no new way for learner code to reach a later test case's output or verdict, or to make the harness return while the state is not back.

**MINOR** `src/grader/harness.ts:235-238`. Putting back the old name-by-name loop over the module table (mutant N1) failed only the hash pin (`Tests 1 failed | 65 passed (66)`). The new comment was too broad: a key a `__del__` adds during the clear is still compared by `dict_update(modules, modules_snapshot)`, as is any key left in `sys.__dict__`; in both cases `plain_keys` then fails the check. Fix asked: a test where the program leaves a key in `sys.modules` whose `__hash__` logs into a list parked in `sys.__dict__`, and the next case expects the list empty; reword the comment.

The reviewer's three questions:

1. Clearing `sys.modules` opens nothing. Imports in a `__del__` while the table is empty, a learner object under `"os"`, a key with the hash of `"os"` and an `__eq__` that returns True: each made the case a runtime error and the next case clean. A `__del__` that re-adds itself forever made the harness raise `NotRestored` on every case (fail closed). The snapshot holds every original module, so the clear frees only learner objects.
2. Restoring `linecache.cache` breaks no reporting. Fourteen programs (syntax errors in both stages, runtime errors, a missing name in the follow-up code, `traceback.print_exc` in both stages), twice each, on f4c7a16 and 7468f65: `differences: 0`. With logging versions of `linecache.getlines` and `linecache.updatecache`, `describe()` called them zero times. The worker's Run path writes `main.py` into the cache on every run, so a check that clears it does not break a later run.
3. The check-order tests pin the order inside `intact()`. On the real harness the builtins key's `__eq__` never runs; under the mutant it runs inside the check, heals the dict, and the case passes. For `sys.__dict__` the `__eq__` runs in the fallback's update on the real harness too, and the check then passes on a state that is really back.

Mutants: 16 on 7468f65. Killed: the six that survived round 4, three more on the tools and `plain_keys`, three on the line cache, two on the key check. Survived: N1 (the finding) and N4 (the line-cache restore moved to the start of `restore()`, equivalent for security).

Outside this commit: `src/runtime/worker/run-support.ts` still empties the module table name by name and never restores the line cache, so a run can leave a line-cache key whose `__eq__` runs during the next run. Run has no verdict, and the next check's first restore clears the cache. Noted only.

Ran: `pnpm exec vitest run src/grader/harness.test.ts` (66 passed), `pnpm verify` (exit 0, 1097 tests), probes under `$TMPDIR/r5`, 16 mutants under `$TMPDIR/mut5`. Not verified: a browser worker, and garbage-collection timing between worker messages.

Fixed in 3fa2bd3: the test the reviewer asked for (N1 now fails it) and the comment reworded. While running it, the line-cache test of 7468f65 failed 1 run in 5: its `__eq__` printed in its own case a varying number of times. Its key is now armed only after it is added and raises instead of printing, and the program removes its own `main.py` entry so that the next case's write meets the key. With the line-cache restore and check removed, that test now fails (before, the print went outside the capture and it passed). 6 of 6 runs passed after the change. No reviewer has seen 3fa2bd3 (tests and one comment).
