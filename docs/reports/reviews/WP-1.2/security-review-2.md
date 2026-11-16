# security-reviewer, pass 2 (WP-1.2)

Range: `c2d86a3..c4b9ea3`, fixes `939f9a0..c4b9ea3`. Result: **CHANGES REQUIRED**. 0 BLOCKER, 4 MAJOR, 4 MINOR.

The reviewer's report follows as returned, shortened where it repeats. The outcome of each finding is in `outcomes-2.md`.

The listed first-round fixes work, but the guard can still be bypassed in four of the areas the "Done when" line requires blocking. Push to `main` is the most serious, because nothing else stops it right now: `gh api repos/Fah2d/heap-academy/branches/main` returns `{"protected":false}`, and rulesets need GitHub Pro or a public repository (HTTP 403). Until WP-1.3, the guard is the only thing between a session and `main`.

## Incident during the review

A probe command chain failed early, and two commands ran in the real repository instead of the scratch one. They added `include.path=<scratchpad>/inc.cfg` to `.git/config` and renamed the local `[user]` section to `[userx]`. The reviewer undid both straight away. The implementer checked afterwards: `git config --local --list` shows `user.name=Fahad`, `core.hookspath=.githooks`, and no `include.*`. The remote and the files of the repository were not changed.

## MAJOR 1. Push to `main` still gets through with ordinary commands (T-18)

Allowed by the guard; the first two really reached `main` on a scratch bare remote:

- `git push origin heads/main`.
- `git config remote.origin.push HEAD:main`, then a plain `git push` from a feature branch.
- Allowed, not run: `git config push.default upstream`; `gh api repos/o/r/merges -f base=main -f head=wp/x`; `gh api -X PATCH repos/o/r/git/refs/heads/main/` and with `?x=1`; `gh api graphql` with `mergePullRequest`, `updateRef` or `createCommitOnBranch`; `gh alias set mg 'pr merge'`, then `gh mg 1`.

Fix proposed: a `pre-push` Git hook that refuses any remote ref `refs/heads/main` and runs the attribution check on each pushed range; in the guard, resolve `heads/` and `refs/heads/`, block `remote.*.push`, `push.default`, `branch.*.merge` and `gh alias set`, block GraphQL mutations and `/merges`, and strip the query and trailing slash from endpoints.

## MAJOR 2. Git hooks can still be skipped through config includes and plumbing (T-18)

- `git -c include.path=/tmp/evil.cfg commit ...` and the `GIT_CONFIG_*` form; `git config include.path` and `includeIf.onbranch:wp/**.path`.
- `git config --rename-section core corex` and `git config rename-section core corex`.
- `git commit-tree HEAD^{tree} -p HEAD -F <file with trailer>`: plumbing never runs `commit-msg`, nor does `cherry-pick` of fetched commits.

Fix proposed: block `include.*` and `includeIf.*` everywhere; treat `rename-section` on `core` like `remove-section`; the `pre-push` range check catches plumbing commits.

## MAJOR 3. The guardrail files can still be changed (T-18)

- `git checkout c2d86a3 -- .claude/settings.json`, `git checkout c2d86a3 -- .githooks`, `git restore --source=... .githooks/commit-msg`, `git rm .githooks/commit-msg`, `git stash push -- .claude/settings.json`.
- `mv .claude /tmp/x`, `rm -rf .claude`, `cd .githooks && rm commit-msg`.
- Globs: `rm .githook?/commit-msg`, `mv .githook* /tmp/x`.
- `echo exit 0 >| .githooks/commit-msg`: the splitter treats the `|` after `>` as a pipe.
- Case variants on a case-insensitive disk: a Write to `.GITHOOKS/commit-msg`, `.claude/Settings.json`, `.git/CONFIG`.
- The settings check only looks for strings: a matcher of `"NoSuchTool"`, a command of `"true # scripts/claude-guard.mjs"`, and `"PreToolUse": []` with the hook moved to `Stop` all passed.
- All of this sits below the open owner decision on `scripts/claude-guard.mjs`: while that file can be edited, every check in it is one edit away from being removed.

## MAJOR 4. Secret files can still be read, including through a regression from this round's fix (T-18, T-12)

- The `git rm --cached` exemption checked for `rm` and `--cached` anywhere: `git --no-pager grep --no-index -h -e SECRET -e rm -e --cached -- .env.local` was allowed and, on a fake file under another name, printed its content.
- `cp --target-directory=/tmp/x .env.example .env.local` copies the secret out.
- Still allowed: `cat .e*`, `cat .en?.local`, `cat .[e]nv.local`, `cat $'\x2eenv.local'`, `f=.en; cat ${f}v.local`, `find . -name '.e*' -exec cat {} +`, a `node -e` that calls `@next/env` `loadEnvConfig`.
- The Read tool on `.ENV.local` is allowed by the guard and opens the real file on this disk; whether the deny rule catches it is not verified. The Grep tool with glob `.e*` is allowed; whether it reads hidden, ignored files is not verified.

Fix proposed: exact forms for both exemptions, case-insensitive names, globs expanded against the directory, and Claude Code's OS-level sandbox with a read deny for `.env*`.

## MINOR

1. Attribution in `gh` bodies: `--body-file /dev/stdin < body.md`; `cat body.md | gh pr create --body-file - # <<`; `-Fbody=@file`, `--field=body=@file`, `--notes-file=file`, `-b "$(head -n 50 body.md)"`.
2. The guard can be made to fail open: a FIFO as `--body-file` or in `$(cat ...)` blocks `readFileSync` until the 10 s timeout, and a timed-out hook does not block.
3. Wrappers and shells: `command -p git push -f origin HEAD`, `exec -a x git push -f ...`, `env -S 'git push -f origin HEAD'`, `echo -f | xargs git push origin HEAD`, `bash -ec '...'`, `bash -lc '...'`, `echo 'git push -f' | bash`, `bash <<< '...'`.
4. The raw HTML lint (T-06): `el["innerHTML"] = h`, `Object.assign(el, { innerHTML: h })` and `createElement("div", { "dangerouslySetInnerHTML": ... })` pass.

## Confirmed fixed

`core.hooksPath` changes in every form; `timeout`, `nice` and `pnpm exec` wrappers; `sed -i`, `cp` and `ln` onto guardrail files; the four false positives; the hook fails closed; the `commit-msg` identity check; the environment schema; the narrow gitleaks allowlist and its test.

## Ran

`pnpm verify` (304 tests passed); `check-attribution.mjs --range c2d86a3..HEAD` exit 0; `gitleaks git` over the range, no leaks; probes of `evaluate()`; Git behaviour in a scratch repository and bare remote; `eslint --stdin` for the raw HTML rule; two read-only `gh api` calls.

## Not checked

How Claude Code's permission rules handle case variants and symlinks; whether its Grep tool reads hidden or ignored files; how it treats a hook that times out; whether `disableAllHooks` in user-level settings turns off project hooks.
