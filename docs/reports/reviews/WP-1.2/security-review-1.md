# security-reviewer, pass 1 (WP-1.2)

Range: `c2d86a3..939f9a0`. Result: **CHANGES REQUIRED**. 0 BLOCKER, 3 MAJOR, several MINOR.

The reviewer's full text was not kept. This record lists each finding as the implementer noted it during the session, with what was done.

## MAJOR

1. `git config set core.hooksPath`, `git config unset core.hooksPath` (Git 2.46 subcommand form), and the `--file` form were allowed. **Fixed** in 05c81d1: `checkConfig` handles both forms, `--file`, `--edit`, and removing the `core` or `alias` section. Deny rules added for the subcommand forms.
2. The file tools could edit `.githooks/**`, `.claude/settings.json`, the guard scripts, and `.git/config`. Shell forms got through: `sed -i`, `cp`, `tee`, and redirects such as `> ./.githooks/...`. **Fixed** in 05c81d1 for the hooks, `.git/config`, `.git/hooks/**`, and `.claude/settings.local.json` (file tools, deny rules, and shell commands). A change to `.claude/settings.json` must keep the attribution keys, every deny rule, and the guard hook, and must not turn hooks off. **Open for the owner**: the guard scripts themselves are not protected from agent edits.
3. Shell globs over `.env` files (`cat .env*`) got through. **Fixed** in 05c81d1.

## MINOR

4. Wrappers (`timeout`, `nice`, `stdbuf`, `pnpm exec`, `env -i`) hid commands. **Fixed** in 05c81d1.
5. A body from `$(cat file)` and a body piped to `--body-file -` were not checked. **Fixed** in 05c81d1: substituted files are read and checked; a body piped from another command is blocked, a here-document is allowed.
6. `git push origin @` on `main` was not seen as a push to `main`. **Fixed** in 05c81d1.
7. The generated-with pattern was too broad. **Fixed** in 73a297b.
8. Session links on claude.com were not caught. **Fixed** in 73a297b.
9. The commit-msg hook did not check the author and committer identity. **Fixed** in 73a297b.
10. False positives on `git rm --cached .env.local`, `cp .env.example .env.local`, `supabase status -o env > .env.local`, and `git commit -uno`. **Fixed** in 05c81d1. `rg ".env"` is still refused; documented in `docs/reports/guardrails.md`.
11. Environment schema: the publishable key had no prefix check, http was allowed outside localhost, and the build needed `RESEND_API_KEY`. **Fixed** in 07a9396.
12. gitleaks reported a requirement ID list at `docs/spec/08-delivery-plan.md:94`. **Fixed** in 2e469fa with a narrow allowlist and a test.
13. ESLint 9 is marked no longer supported in the lockfile. **Stated** in the pull request: eslint-plugin-react in eslint-config-next peers `^9.7`.
14. The guard failed open when it crashed. **Fixed** in 05c81d1: the hook command ends in `|| exit 2`.
15. Nothing verifies `core.hooksPath`. **Documented** in `docs/reports/guardrails.md`; the `static` job of WP-1.3 covers it.
