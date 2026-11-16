# Outcomes of the second reviews (WP-1.2)

Fixes in `c4b9ea3..0472532` (commits d500ed9, 8e06720, c9f07b1, 0472532). `pnpm verify` passes with 364 tests. These fixes have not had a third independent review.

## code-review-2.md

| Finding | Outcome |
|---|---|
| BLOCKER quoted here-document hid the rest of the command | **Fixed** in 8e06720: `<<` and `<<-` read the delimiter without quotes and skip the body to its line. Tests for both reported commands; live attempt 15 in `docs/reports/guardrails.md` |
| MAJOR narrowed Generated-with pattern | **Fixed** in d500ed9: the four reported lines and a quoted product name are tests that must report |
| MAJOR forged scissors line | **Fixed** in d500ed9: cut only before Git's verbose template; a unit test and a real-commit hook test |
| MAJOR `--de`, `--m`, `--b` | **Fixed** in 8e06720 with Git's shortest prefixes; tests |
| MAJOR `bash -lc`, `zsh -ic` | **Fixed** in 8e06720; tests |
| MAJOR `cat .e*` and other globs | **Fixed** in 8e06720: globs are matched against the secret file names with `path.matchesGlob`; tests |
| MINOR shared wrapper option table | **Open**: `command -p`, `exec -a`, `xargs` options, `env -S` still hide a command |
| MINOR plain forms that change the hooks | **Fixed** for `git rm`, `mv`, `checkout`, `restore`, `stash`, `>|`, globs. **Open**: relative paths after `cd`, `find -delete` |
| MINOR `rename-section core` | **Fixed** in 8e06720 |
| MINOR gh gaps | **Fixed**: `gh alias set`, GraphQL mutations, `--input=`. **Open**: `git commit --fil` and `-Fmsg.txt` (the `commit-msg` hook checks both) |
| MINOR settings check by string | **Fixed** in 8e06720: the exact matcher and command must stay; three tests |
| MINOR inline strings in variables, arrays, `String()`, arrow `generateMetadata` | **Open** |
| MINOR `allStrings` false positives, missing `origin-`, `bg-`, `object-` | **Open** |
| MINOR vacuous privileged-client assertions | **Fixed** in c9f07b1 |

## security-review-2.md

| Finding | Outcome |
|---|---|
| MAJOR 1 push to `main` | **Fixed in the guard** (8e06720): `heads/main`, push configuration keys, `/merges`, GraphQL mutations, endpoint query and trailing slash, `gh alias set`; live attempt 16. **Open for the owner**: no branch protection on `main`, and the proposed `pre-push` hook, which the controls stop the implementer from writing |
| MAJOR 2 includes and plumbing | **Fixed**: `include.*`, `includeIf.*` in `-c`, the environment and `git config`; `rename-section`. **Open**: plumbing commits, which the proposed `pre-push` hook would catch |
| MAJOR 3 guardrail files | **Fixed**: Git commands with a protected path, the `.claude` folder, globs, `>|`, case variants, the exact settings entry. **Open for the owner**: the guard scripts can be edited by a session; relative paths after `cd` |
| MAJOR 4 secret files | **Fixed**: the regression (exact `git rm --cached` and `cp` forms), globs, case variants. **Open**: ANSI-C quoting and variables, `find -exec`, a program that loads the environment itself, the OS-level sandbox |
| MINOR 1 gh bodies | **Fixed**: `/dev/stdin` (not a regular file), the here-document must belong to the same command, `-Fbody=@file`, `--input=`. **Open**: `--notes-file=`, `-b "$(head ...)"` |
| MINOR 2 FIFO stalls the guard | **Fixed**: only regular files under 1 MB are read |
| MINOR 3 wrappers and shells | **Fixed**: `bash -ec`, `bash -lc`, a shell reading from a pipe or a here-string. **Open**: per-wrapper options |
| MINOR 4 raw HTML lint gaps (T-06) | **Open** |
