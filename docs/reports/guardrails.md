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
| 10 | Pull request whose description says it was generated with Claude Code | `gh pr create --dry-run --base main --title "WP-1.2: guardrail probe" --body "Probe. <the robot-emoji Generated with Claude Code line and link>"` | Guard hook | Blocked |

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

A real `git commit -F` through that hook, in a scratch repository, is refused and leaves no commit: test `[NFR-MAINT-08] refuses a commit whose message file carries a co-author trailer` in `scripts/git-hooks.test.ts`.

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
- The secret scan configuration finds a generated Supabase secret key and a generated Resend key in a scratch file (rules `supabase-secret-key` and `resend-api-key`), and finds nothing in `.env.example`.
- `next build` with no environment stops with each missing variable's name: `NEXT_PUBLIC_SUPABASE_URL: required`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: required`, `RESEND_API_KEY: required`.

## What these controls do not cover

- The guard reads command text. A command that hides its intent, for example a script file that runs `git push --force` when executed, gets past it. Layer 3, branch protection and the `static` job from WP-1.3, is what cannot be bypassed from a session.
- The guard runs before the permission rules. For shell commands it blocked every attempt first, so the Bash deny rules were not seen blocking on their own in this session. The Read deny rule was (attempt 1).
- Read deny rules cover Claude Code's file tools and the file commands it recognizes in the shell. They do not cover a program that opens a file by itself. The guard adds a text check for `.env` names in any command.
- Settings in `.claude/settings.json` do not apply to a claude.ai cloud session (`docs/spec/09-evidence.md` E-18). The `commit-msg` hook and, from WP-1.3, the `static` job still apply.
- The pre-commit secret scan needs `gitleaks` on the machine. Without it, the hook stops the commit and says how to install it; it does not skip the scan.
