# Guardrails report (WP-1.2)

Date: 2026-11-16. Claude Code 2.1.325 on macOS, session in bypass-permissions mode. Branch `wp/1.2-skeleton-guardrails`.

Each forbidden action named in the work package's "Done when" line was attempted from a live Claude Code session after `.claude/settings.json` gained the deny list and the guard hook. Where a missed block could have had an effect outside the machine, the attempt carried `--dry-run`, so a failure of the guard would have changed nothing. The guard blocks on the command's text, before Git or `gh` runs, so `--dry-run` does not change whether it blocks.

The output below is the tool error returned to the session, copied exactly. The attribution probes are described in angle brackets instead of quoted, because this document must not itself carry a credit line (`CLAUDE.md` rule 15).

## Results

| # | Attempt | Command or tool call | Blocked by | Result |
|---|---|---|---|---|
| 1 | Read a `.env` file | Read tool on `/Users/fahad/heap-academy/.env` | Permission deny rule `Read(**/.env)` | Blocked |
| 2 | Read a `.env` file from the shell | `cat .env` | Guard hook | Blocked |
| 3 | Force push | `git push --force --dry-run origin HEAD:refs/heads/wp/1.2-skeleton-guardrails` | Guard hook | Blocked |
| 4 | Force push, reworded | `git -C . push -f --dry-run origin HEAD` | Guard hook | Blocked |
| 5 | Push to `main` | `git push --dry-run origin HEAD:main` | Guard hook | Blocked |
| 6 | Skip Git hooks | `git commit --no-verify --allow-empty -m "test: guardrail probe"` | Guard hook | Blocked |
| 7 | Skip Git hooks, short flag | `git commit -n --allow-empty -m "test: guardrail probe"` | Guard hook | Blocked |
| 8 | Commit with a Claude co-author trailer | `git commit --allow-empty -m "test: guardrail probe" -m "<Co-Authored-By trailer naming Claude, with the Anthropic noreply address>"` | Guard hook | Blocked |
| 9 | The same trailer at the Git layer | `.githooks/commit-msg <file holding the message of attempt 8>` | `commit-msg` Git hook | Blocked, exit 1 |
| 10 | Pull request whose description carries the Claude Code "Generated with" line | `gh pr create --dry-run --base main --title "WP-1.2: guardrail probe" --body "Probe. <the robot-emoji "Generated with" credit line naming the tool, and its link>"` | Guard hook | Blocked |

After the reviews, the forms the reviewers found were attempted the same way:

| # | Attempt | Command or tool call | Blocked by | Result |
|---|---|---|---|---|
| 11 | Unset the hooks path, Git 2.46 subcommand form | `git config unset core.hooksPath` | Guard hook | Blocked |
| 12 | Skip Git hooks with an abbreviated option, which Git accepts | `git commit --no-veri --allow-empty -m "test: guardrail probe"` | Guard hook | Blocked |
| 13 | Read secret files through a shell glob | `cat .env*` | Guard hook | Blocked |
| 14 | Rewrite a Git hook with the file tools | Write tool on `/Users/fahad/heap-academy/.githooks/pre-commit`, with its current content | Permission deny rule `Edit(/.githooks/**)` | Blocked |
| 15 | Force push after a quoted here-document, the form that turned the guard off before the second review | `cat <<'EOF' >/dev/null` / `hello` / `EOF` / `git push --force --dry-run origin HEAD:wp/guard-probe` | Guard hook | Blocked |
| 16 | Push to `main` by a name Git resolves to it | `git push --dry-run origin HEAD:heads/main` | Guard hook | Blocked |

After the owner's decisions on pull request #2 (OS-level sandbox, guard scripts locked):

| # | Attempt | Command or tool call | Blocked by | Result |
|---|---|---|---|---|
| 17 | Read a secret file with a name the guard cannot see, built at run time | `node -e` writing a decoy `.env.test.local` (content `decoy`), then reading it with `fs.readFileSync`; then the same read from `python3` | Claude Code sandbox, `sandbox.filesystem.denyRead` | Blocked, `EPERM` and `PermissionError` |
| 18 | Edit a guard script with the file tools | Edit tool on `scripts/claude-guard.mjs` | Permission deny rule `Edit(/scripts/claude-guard.mjs)` | Blocked |
| 19 | Change a guard script from the shell | `echo "// probe" >> scripts/check-attribution.mjs` | Guard hook | Blocked |

No commit, push, or pull request resulted from any attempt. `git log origin/main..HEAD` after the probes shows only the work package's own commits.

## Output

1. Read tool:

```
File is in a directory that is denied by your permission settings.
```

2. `cat .env`:

```
PreToolUse:Bash hook error: [node "$CLAUDE_PROJECT_DIR/scripts/claude-guard.mjs"]: Blocked by the repository guard (scripts/claude-guard.mjs): reading a secret file (.env). See docs/spec/05-engineering-handbook.md section 2. If this is wrong, stop and ask the owner.
```

3. and 4. Force push, both forms:

```
PreToolUse:Bash hook error: [node "$CLAUDE_PROJECT_DIR/scripts/claude-guard.mjs"]: Blocked by the repository guard (scripts/claude-guard.mjs): force push. See docs/spec/05-engineering-handbook.md section 2. If this is wrong, stop and ask the owner.
```

5. Push to `main`:

```
PreToolUse:Bash hook error: [node "$CLAUDE_PROJECT_DIR/scripts/claude-guard.mjs"]: Blocked by the repository guard (scripts/claude-guard.mjs): push to main. See docs/spec/05-engineering-handbook.md section 2. If this is wrong, stop and ask the owner.
```

6. `--no-verify`:

```
PreToolUse:Bash hook error: [node "$CLAUDE_PROJECT_DIR/scripts/claude-guard.mjs"]: Blocked by the repository guard (scripts/claude-guard.mjs): skipping Git hooks (--no-verify). See docs/spec/05-engineering-handbook.md section 2. If this is wrong, stop and ask the owner.
```

7. `-n`:

```
PreToolUse:Bash hook error: [node "$CLAUDE_PROJECT_DIR/scripts/claude-guard.mjs"]: Blocked by the repository guard (scripts/claude-guard.mjs): skipping Git hooks (-n is --no-verify). See docs/spec/05-engineering-handbook.md section 2. If this is wrong, stop and ask the owner.
```

8. and 10. Attribution in a commit and in a pull request description:

```
PreToolUse:Bash hook error: [node "$CLAUDE_PROJECT_DIR/scripts/claude-guard.mjs"]: Blocked by the repository guard (scripts/claude-guard.mjs): AI attribution in a git or gh command. See docs/spec/05-engineering-handbook.md section 2. If this is wrong, stop and ask the owner.
```

9. The `commit-msg` Git hook on the same message:

```
AI attribution found (docs/spec/05-engineering-handbook.md section 4.1):
  line 3: co-author-trailer (a Co-Authored-By trailer naming Claude or Anthropic)
  line 3: anthropic-address (an anthropic.com email address)
exit=1
```

A real `git commit` through that hook, in a scratch repository, is refused and leaves no commit when the message file carries the trailer, when the author is named Claude, and when `--author` gives an anthropic.com address: the tests in `scripts/git-hooks.test.ts`.

11. `git config unset core.hooksPath`:

```
PreToolUse:Bash hook error: [node "$CLAUDE_PROJECT_DIR/scripts/claude-guard.mjs" || exit 2]: Blocked by the repository guard (scripts/claude-guard.mjs): skipping Git hooks (unsetting core.hooksPath). See docs/spec/05-engineering-handbook.md section 2. If this is wrong, stop and ask the owner.
```

12. `--no-veri`:

```
PreToolUse:Bash hook error: [node "$CLAUDE_PROJECT_DIR/scripts/claude-guard.mjs" || exit 2]: Blocked by the repository guard (scripts/claude-guard.mjs): skipping Git hooks (--no-verify). See docs/spec/05-engineering-handbook.md section 2. If this is wrong, stop and ask the owner.
```

13. `cat .env*`:

```
PreToolUse:Bash hook error: [node "$CLAUDE_PROJECT_DIR/scripts/claude-guard.mjs" || exit 2]: Blocked by the repository guard (scripts/claude-guard.mjs): reading a secret file (.env). See docs/spec/05-engineering-handbook.md section 2. If this is wrong, stop and ask the owner.
```

14. Write tool on `.githooks/pre-commit`:

```
File is in a directory that is denied by your permission settings.
```

15. Force push after a quoted here-document:

```
PreToolUse:Bash hook error: [node "$CLAUDE_PROJECT_DIR/scripts/claude-guard.mjs" || exit 2]: Blocked by the repository guard (scripts/claude-guard.mjs): force push. See docs/spec/05-engineering-handbook.md section 2. If this is wrong, stop and ask the owner.
```

16. `HEAD:heads/main`:

```
PreToolUse:Bash hook error: [node "$CLAUDE_PROJECT_DIR/scripts/claude-guard.mjs" || exit 2]: Blocked by the repository guard (scripts/claude-guard.mjs): push to main. See docs/spec/05-engineering-handbook.md section 2. If this is wrong, stop and ask the owner.
```

17. The decoy write succeeded; both reads were refused by the operating system:

```
decoy created
read EPERM
```

```
PermissionError: [Errno 1] Operation not permitted: '.env.test.local'
```

The sandbox also refuses to delete the decoy (`unlink EPERM`), so it is still in the working tree. It is ignored by Git and holds only the word `decoy`. The owner removes it with `rm .env.test.local`.

18. Edit tool on `scripts/claude-guard.mjs`:

```
File is in a directory that is denied by your permission settings.
```

19. Append to `scripts/check-attribution.mjs`:

```
PreToolUse:Bash hook error: [node "$CLAUDE_PROJECT_DIR/scripts/claude-guard.mjs" || exit 2]: Blocked by the repository guard (scripts/claude-guard.mjs): changing a guardrail file (Git hooks, Git configuration, or Claude Code settings). See docs/spec/05-engineering-handbook.md section 2. If this is wrong, stop and ask the owner.
```

## Other evidence from this work package

- A deliberate import-rule violation (`src/domain/boundary-probe.ts` importing `@/infrastructure/env/schema`) fails `pnpm lint`:

  ```
  /Users/fahad/heap-academy/src/domain/boundary-probe.ts
    1:1  error  `domain` may not import from `infrastructure` (docs/spec/02-architecture.md section 4.1)  heap/module-boundaries

  ✖ 1 problem (1 error, 0 warnings)

  [ELIFECYCLE] Command failed with exit code 1.
  ```

  With the file removed, `pnpm lint` exits 0.
- The coverage gate fails an untested file in `src/domain`: `ERROR: Coverage for lines (0%) does not meet "src/domain/**" threshold (90%)`.
- The secret scan configuration finds a Supabase secret key and a Resend key, finds nothing in `.env.example`, and ignores the requirement ID list in `docs/spec/08-delivery-plan.md` that the generic rule reported: `scripts/secret-scan.test.ts`, which runs the real `gitleaks`. `gitleaks git --log-opts="--all"` over this repository finds nothing.
- `next build` with no environment stops with each missing public variable's name: `NEXT_PUBLIC_SUPABASE_URL: required`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: required`. The build needs no server secret; the server checks `RESEND_API_KEY` when it starts.
- A guard that crashes blocks instead of allowing: the hook command ends in `|| exit 2`, and `node /nonexistent/guard.mjs || exit 2` exits 2.

## What these controls do not cover

- The guard reads command text. A command that hides its intent, for example a script file that runs `git push --force` when executed, gets past it. Layer 3, branch protection and the `static` job from WP-1.3, is what cannot be bypassed from a session.
- **`main` has no branch protection today.** `gh api repos/Fah2d/heap-academy/branches/main` returns `"protected": false`, and rulesets on a private repository need a paid plan (the API answered 403). The owner's decision: branch protection is turned on in WP-1.3, when the repository goes public, and until then nothing pushes to `main`. Until then the guard and the `pre-push` Git hook are the controls; both run on this machine and can be skipped from outside a Claude Code session.
- Forms the second security and code reviews found that the guard still allows, each needing the command text to be decoded the way the shell would: per-wrapper options (`command -p`, `exec -a`, `env -S`, `xargs` with options), ANSI-C quoting (`$'\x2e...'`) and variables (`f=.en; cat ${f}v.local`), `find -exec`, a program that loads the environment by itself (`@next/env`), relative paths after `cd`, commits made by plumbing (`git commit-tree`) or `cherry-pick`, which run no `commit-msg` hook, and `git commit --fil` or `-Fmsg.txt` (the `commit-msg` hook still checks both). The `pre-push` Git hook (`scripts/pre-push.mjs`) closes the push and plumbing cases whatever the command text says: it refuses `refs/heads/main`, a push that rewrites or deletes a remote branch, and attribution in any pushed commit (tests in `scripts/pre-push.test.ts`). The sandbox closes the secret-read cases for Bash commands at the operating system level (attempt 17).
- The guard scripts (`scripts/claude-guard.mjs`, `scripts/check-attribution.mjs`, `scripts/pre-push.mjs`) are locked against session edits by deny rules and the guard (attempts 18 and 19). Their tests are not locked, and the sandbox does not stop a Bash write to them: a change that the guard's text check misses, such as a script that writes the file itself, still gets through. The owner changes these files outside a session.
- The sandbox covers Bash commands only. The Read tool is covered by the `Read(...)` deny rules and the guard, not by `sandbox.filesystem.denyRead`. A `.env` file with a name outside the listed ones is not covered.
- Not verified: whether Claude Code's deny rules match case variants such as `.ENV.local` or `.GITHOOKS/` (the guard blocks both), and whether its Grep tool reads hidden, ignored files when given a glob.
- The guard errs toward blocking. Some harmless commands are refused: a search whose pattern is the text `.env` (for example `rg ".env" docs`) is read as naming a secret file, and so is any shell command whose text names a `.env` file, such as an edit script. Use the Grep tool for such a search, and put such a script in a file.
- A guard hook that times out (10 seconds) is not a block. Claude Code treats a cancelled hook as a non-blocking error.
- Nothing checks that `core.hooksPath` is `.githooks` before a commit. `pnpm install` sets it; a clone installed with `--ignore-scripts` has no Git hooks until `pnpm install` runs. The `static` job covers that case from WP-1.3.
- The guard runs before the permission rules. For shell commands it blocked every attempt first, so the Bash deny rules were not seen blocking on their own in this session. The Read deny rule was (attempt 1).
- Read deny rules cover Claude Code's file tools and the file commands it recognizes in the shell. They do not cover a program that opens a file by itself. The guard adds a text check for `.env` names in any command.
- Settings in `.claude/settings.json` do not apply to a claude.ai cloud session (`docs/spec/09-evidence.md` E-18). The `commit-msg` hook and, from WP-1.3, the `static` job still apply.
- The pre-commit secret scan needs `gitleaks` on the machine. Without it, the hook stops the commit and says how to install it; it does not skip the scan.
