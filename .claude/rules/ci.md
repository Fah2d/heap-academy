---
paths:
  - ".github/**"
---

# Pipelines

Jobs and their order are in `docs/spec/07-operations.md` sections 2 and 3. The required checks are in `docs/spec/05-engineering-handbook.md` section 10.

- Pin every third-party action to a full commit SHA, with the version in a comment.
- `permissions: {}` at the top of every workflow. Grant each job only what it needs.
- `timeout-minutes` on every job.
- Install with the frozen lockfile. Key caches on the lockfile.
- Pull request workflows use `pull_request`, never `pull_request_target`, and have no access to secrets. No `workflow_run`, `issue_comment`, or `pull_request_review` trigger touches secrets or artifacts from forks. GitHub-hosted runners only. The pull request workflow also runs on `edited`, so the attribution check sees the final title and description.
- Production credentials exist only in the `production` environment, which needs the owner's approval for a deploy that contains a migration, and in the `production-backup` environment, which only `backup.yml` may name. Both are limited to `main` by a deployment branch policy.
- Jobs that hold staging or production credentials save no cache and upload no artifact, except the backup ciphertext (ADR-0030).
- The deploy workflow keeps its order: staging migrations, approval when there is a migration, production migrations, deploy, smoke, roll back on failure. The host's automatic production deploy stays off.
- One concurrency group per workflow and branch, so two deploys never run at once.
- Never remove, rename, or weaken a required check without the owner's approval in a `spec-change` pull request.
