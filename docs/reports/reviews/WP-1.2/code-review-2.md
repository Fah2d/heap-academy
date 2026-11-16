# code-reviewer, pass 2 (WP-1.2)

Range: `c2d86a3..c4b9ea3`, fixes `939f9a0..c4b9ea3`. Result: **CHANGES REQUIRED**. 1 BLOCKER, 5 MAJOR, 8 MINOR.

The reviewer's report follows as returned. The outcome of each finding is in `outcomes-2.md`.

`pnpm verify` passes (format, lint, types, attribution, 304 tests in 7 files). Most first-round findings are fixed. But some fixes are incomplete or narrowed a check too far, and one tokenizer bug lets the guard allow skipped hooks and force pushes.

## Findings

- **BLOCKER** `scripts/claude-guard.mjs:139`: a quoted here-document turns the guard off for the rest of the command.
  - **What is wrong:** the redirection loop includes `'` and `"` in the operator. `<<'EOF'` eats the opening quote, the closing quote then opens a new quoted string, and everything after it becomes one inert word.
  - **Why it matters:** this is the exact shape used for commit messages here.
  - **Evidence:** `evaluate()` with the repository code:
    ```
    allow  "cat <<'EOF' | git commit --no-verify -F -\nfeat: one\nEOF"
    allow  "git commit -F - <<'EOF'\nfeat: one\nEOF\ngit push --force origin wp/x"
    block  "cat <<EOF > notes.txt\nhello\nEOF\ngit push --force origin wp/x"   (unquoted form works)
    ```
    This bug was already there at 939f9a0. The first round missed it.
  - **Fix:** parse `<<` and `<<-` properly. Read the delimiter word with quotes removed, then skip the body up to the line that matches the delimiter. The whole-text attribution scan still covers the body. Add both commands above as tests.

- **MAJOR** `scripts/check-attribution.mjs:41`: the narrowed "Generated with" pattern no longer catches credit lines it caught before.
  - **Evidence:** `findAttribution` returns `[]` for four credit lines: the phrase followed by the bare name and a full stop, by a colon and the product name, by "the help of" and the name, and "by" followed by the company and the name. The old pattern caught the first, third and fourth. The exact lines are fixtures in `scripts/check-attribution.test.ts` (`generatedEndOfSentence`, `generatedColon`, `generatedHelp`, `generatedByAnthropic`); they are not written out here because the repository scan would report this file.
  - **Why it matters:** the guard and `--files` use the same pattern, so they miss these lines too.
  - **Fix:** something like `/\bgenerated\s+(?:with|by)\b.*\bclaude\b(?![\w-]|\.md\b|\/)/i`. Add the four lines above as positive tests.

- **MAJOR** `scripts/check-attribution.mjs:97`: a forged scissors line hides attribution from the commit-msg hook. Git only cuts at the scissors line when the message is edited with `--verbose` or `--cleanup=scissors`; with `-F` the default cleanup keeps everything after it. A scratch-repository `git commit -F msg.txt` with a scissors line and then a co-author trailer exited 0 and the trailer is in the commit.
  - **Fix:** cut only when the scissors line is followed by Git's own explanatory comment lines and a `diff --git` line; otherwise check everything. Add a hook test.

- **MAJOR** `scripts/claude-guard.mjs:322,325`: the abbreviated-option fix is incomplete. The guard allows `git push --de origin wp/x`, `git push --m origin` and `git push --b origin`. In a scratch repository with a local bare remote, `git push --de origin side` printed `- [deleted] side`, and `git push --b --dry-run origin` and `git push --m --dry-run origin` listed every branch.
  - **Fix:** use the shortest unique prefix (`--de` 4, `--m` 3, `--b` 3). Add tests.

- **MAJOR** `scripts/claude-guard.mjs:812`: `sh -c` is only found as a separate word. The guard allows `bash -lc "git push -f"` and `zsh -ic "git push -f"`. Already present at 939f9a0.
  - **Fix:** treat any short-option cluster containing `c` as `-c`, and take the next word as the script.

- **MAJOR** `scripts/claude-guard.mjs:56,49`: the `cat .e*` finding from round one is not fixed. The guard allows `cat .e*`, `cat .en?`, `cat .[e]nv`, `head -c 400 .e?v.local`.
  - **Fix:** for any word with `*?[{` in its last segment, test `path.matchesGlob` against the secret names.

- **MINOR** `scripts/claude-guard.mjs:171`: one shared table of wrapper options is wrong for several wrappers. The guard allows `time -p git push --force`, `command -p git push --force`, `caffeinate -s git push -f`, `xargs -p git push -f`, `exec -a foo git push -f`, `xargs -I {} git push -f`.

- **MINOR** `scripts/claude-guard.mjs:673`: changing the Git hooks still gets through in plain forms: `git rm .githooks/commit-msg`, `git mv .githooks/commit-msg /tmp/x`, `git checkout HEAD~5 -- .githooks`, `git restore --source=HEAD~9 .githooks`, `cd .githooks && rm commit-msg`, `echo x >| .githooks/commit-msg`, `rm .githoo?s/commit-msg`, `find .githooks -delete`.

- **MINOR** `scripts/claude-guard.mjs:470`: `git config rename-section core x` and `--rename-section core x` are allowed.

- **MINOR** `scripts/claude-guard.mjs:514-614`: `gh alias set m "pr merge"` is allowed; `gh api graphql` mutations are not checked; `gh api --input=file` is not read; `git commit --fil msg.txt` and `-Fmsg.txt` are not read (the Git hook still covers both).

- **MINOR** `scripts/claude-guard.mjs:867`: the settings check only looks for the strings `PreToolUse` and `scripts/claude-guard.mjs`. A change can keep both and still disable the guard (a matcher that never matches, `; exit 0`, or the guard moved under `PostToolUse`).

- **MINOR** `scripts/eslint/no-inline-strings.mjs`: `const label = "Save changes"; … {label}`, `{["One item"].map(…)}`, `{String("Loose words")}`, and `generateMetadata` as an arrow function are not reported.

- **MINOR** `scripts/eslint/logical-properties.mjs:17`: `allStrings` mode reports bare tokens (`type Side = "left" | "right"`, `lang="pl"`) and misses `origin-left`, `bg-left`, `object-right`.

- **MINOR** `scripts/eslint/rules.test.ts:66-67`: two privileged-client assertions are vacuous, because the inputs lack `import "server-only"` and the `serverOnly` report alone satisfies the assertion.

## Verified fixed

The pull request template passes; `--files` scan; comment lines checked; pending identity checked; `--no-veri`, `--force-w`, `--delet`; `git config set`/`unset`; configuration in the environment; file-tool writes to hook and settings files; the guard fails closed; inline-string forms; boundaries; purity globals; no `any`; build needs no server secret; scratch cleanup; gitleaks test runs the real binary; `git log --format=fuller c2d86a3..HEAD` shows Fahad as author and committer with no trailers or credit lines.

## Not checked by the reviewer

Commands naming `.env` files could not be probed live (the guard blocks them) and were confirmed from the code. Whether the Claude Code deny rules catch any guard miss. `next build`, `pnpm test:e2e`, gitleaks over the history.
