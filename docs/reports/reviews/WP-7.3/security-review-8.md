# Security review 8: WP-7.3 part 6

- Reviewer: `security-reviewer`, fresh context, read-only, two rounds.
- Range: round 1 `f33e346..5872bc6` (the backup workflow, backup and restore scripts, the verify script, the role's database test, the runbooks); round 2 `b68531d` (the answers).
- Date: 2026-11-26. The implementer saved this record and wrote the answers.

## Round 1: CHANGES REQUIRED, 4 MAJOR, 4 MINOR

Found sound: the three actions are pinned to the SHAs of their version tags (checked through the GitHub API); permissions are minimal; the restore checks the run before it downloads and the provenance before it decrypts; the run ID and repository are validated.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | MAJOR | psql `--single-transaction` commits when its input ends, also when the Node parent dies and the pipe closes, so a cut-off restore could commit. | Fixed in b68531d. No `--single-transaction`: the script writes `BEGIN`, then age's output, and `COMMIT` only after age exits 0. With real psql 17.12: `BEGIN` and a whole dump with no `COMMIT` left 0 accounts; with `COMMIT`, 2. Stream-level tests; the mutation that always commits fails 2 of them. |
| 2 | MAJOR | `BACKUP_DB_HOST` and `BACKUP_DB_USER` came from `vars`, which the runner prints in clear in the step's header before `::add-mask::` runs. | Fixed in b68531d: both are secrets, the mask lines are gone, and `workflows.test.ts` fails on any `vars.BACKUP_DB_`. ADR-0030's real-job log test is recorded as not verified. |
| 3 | MAJOR | The runbook put the target's password on a command line (shell history, process list). | Fixed in b68531d: `restore.mjs` refuses a target holding a password, and psql asks on the terminal. |
| 4 | MAJOR | The role's password was pasted into the SQL Editor, which keeps history. | Fixed in b68531d: `\password backup_reader` in psql on the drill machine, which hashes it locally. |
| 5 | MINOR | The dump carried sessions, tokens, codes, challenges and the audit log. | Fixed in b68531d (decision Q). |
| 6 | MINOR | EPIPE on psql's input would crash Node. | Fixed in b68531d: it stops age, and psql's exit is reported. Test added. |
| 7 | MINOR | The rotation step that undoes `nologin` had no `login`. | Fixed in b68531d. |
| 8 | MINOR | Tool versions too loose. | Fixed: psql 17.6 or later, the newest gh. |

## Round 2: CHANGES REQUIRED, 1 MAJOR, 4 MINOR

All eight round 1 fixes found correct, and none opens a new hole. A data-only plain dump writes no `BEGIN` or `COMMIT`, its data cannot leave a COPY block, and `\restrict` (17.6+) stops any other meta-command; foreign keys cannot fail under `replica`, and the excluded set is closed under references.

| # | Severity | Finding | Answer |
|---|---|---|---|
| 1 | MAJOR | ADR-0030 still prescribes `--single-transaction` and `::add-mask::`; a later "fix" back to the ADR would bring the bug back. | The ADR text now says what the code does, with an amendment note marked as proposed and not yet approved, for the `spec-change` review (decisions Q and R). |
| 2 | MINOR | `holdsPassword` missed `?password=`, percent-encoded keywords, and multi-host URLs. | Fixed: it decodes first, reads the user part without the URL parser, and refuses what does not decode. Seven new cases. |
| 3 | MINOR | The excluded tables were a hand-kept list. | Fixed: the database test pins every `auth` table as dumped or left out (a new table fails it), and a unit test requires the left-out list to equal the script's. Four token tables the local auth service has were added to the exclusions. |
| 4 | MINOR | Nothing checked that the nightly `pg_dump` is 17.6 or later. | Fixed: `backup.sh` refuses an older one. Test added. |
| 5 | MINOR | The migration's comment still said to set the password in the SQL Editor. | Fixed (the migration is not on `main`). |

Not checked by the reviewer: real pg_dump, psql or age output; the live auth tables (the implementer listed them from the local stack); that psql's password prompt reads the terminal while its input is a pipe; `\password` on hosted Supabase; the GitHub environment.
