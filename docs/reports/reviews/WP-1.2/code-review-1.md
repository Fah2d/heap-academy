# code-reviewer, pass 1 (WP-1.2)

Range: `c2d86a3..939f9a0`. Result: **CHANGES REQUIRED**. 1 BLOCKER, 6 MAJOR, several MINOR.

The reviewer's full text was not kept. This record lists each finding as the implementer noted it during the session, with what was done.

## BLOCKER

1. The generated-with pattern flagged the first line of `docs/templates/pull-request.md`, so a pull request opened from the template would be refused. **Fixed** in 73a297b, with a test that the template passes.

## MAJOR

2. The guard missed abbreviated long options that Git accepts (`--no-veri`, `--force-w`, `--delet`), `git config set` and `unset`, configuration in `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_n`, `GIT_CONFIG_VALUE_n`, and `GIT_CONFIG_PARAMETERS`, shell edits to the hooks, `cat .e*` globs, and file-tool writes. **Fixed** in 05c81d1, with tests.
3. no-inline-strings missed ternaries, `??`, `+`, prose props of components such as `heading="Saved"`, and `metadata` and `generateMetadata`. **Fixed** in 3d56392, with tests.
4. `features/*/client/**` was not treated as client code, and nothing required `server-only` in `features/*/server/**` and `infrastructure/db/**`. **Fixed** in 3d56392, with tests.
5. The module table additions (`messages`, `app` to `messages`, `app` to `ui` stylesheets, the root area) go beyond `docs/spec/02-architecture.md` section 4.1 and need the owner's decision. **Open for the owner**, raised in the pull request.
6. `docs/spec/04-content-system.md` section 3.2 puts a Node worker-thread runner in `src/grader`, which conflicts with the purity rule. **Open for the owner**, raised in the pull request with a recommended default.
7. NFR-MAINT-08 had no check of files. **Fixed** in 73a297b: `pnpm attribution` scans tracked files outside `docs/spec/` and `docs/later/`.

## MINOR

8. The rule's `src` root depended on the working directory. **Fixed** in 3d56392.
9. The privileged-client path check was a prefix. **Fixed** in 3d56392: one exact file.
10. Comment lines were stripped from commit messages before the check. **Fixed** in 73a297b: only lines below the scissors line are dropped.
11. logical-properties scope: `.ts` files, and the stylesheet rule flagged `width`, `height`, `top`. **Fixed** in 3d56392.
12. `@param {any}` in a rule source. **Fixed** in 3d56392.
13. Purity missed `globalThis.fetch`, `setTimeout`, and `structuredClone`. **Fixed** in 3d56392.
14. `RESEND_API_KEY` was required at build. **Fixed** in 07a9396.
15. Duplicate guard test titles. **Fixed** in 05c81d1.
16. git-hooks test temporary directories were not removed. **Fixed** in 73a297b.
17. gitleaks had no automated test. **Fixed** in 2e469fa.
18. The guard failed open. **Fixed** in 05c81d1.
