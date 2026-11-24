# 07 Operations

How the product is built, shipped, watched, recovered, and paid for. One person operates it, so everything here favors automation, written steps, and early warnings.

## 1. Environments

| Environment | App | Database and auth | Data | Purpose |
|---|---|---|---|---|
| Local | Dev server | Supabase local stack in containers | Seed data, throwaway | Development and most tests |
| Preview | One deployment per pull request | Staging project | Seeded test accounts and sample lessons | Review by the owner |
| Production | Live site | Production project | Real | Learners and the owner's lessons |

- Two Supabase projects, staging and production, both on the free plan, which allows two active projects (E-11, E-24). Production stays on Free until a trigger in ADR-0029 fires.
- Preview deployments sign in against staging. Their addresses must be covered by the auth provider's redirect allow-list, with a pattern pinned to this project's prefix and account suffix, not a wildcard over the whole preview domain.
- Previews require Vercel Authentication, and Vercel's Git Fork Protection is on (ADR-0029). Staging is seeded with no admin row and no credential that exists in the repository.
- Lessons are data, so they are per environment. The owner writes real lessons in production only. Staging has seeded sample lessons.
- Configuration is validated at build and at start (`02-architecture.md` section 13). `.env.example` is the list of record.

### 1.1 Configuration as files

Where a vendor supports configuration in the repository, it is used: database schema and policies as migrations, auth and local stack settings in the Supabase config file, hosting settings in the project config file, pipeline definitions as workflow files. Settings that exist only in a vendor's screen are listed step by step in `docs/runbooks/infrastructure-setup.md`, and a script (`pnpm infra:verify`) checks what can be checked from outside: response headers, redirect behavior, the health endpoint, DNS.

## 2. Continuous integration

### 2.1 Pull request pipeline

| Job | Does | Runs when |
|---|---|---|
| `static` | Format, lint (import rules, no raw HTML, no inline strings), types, AI attribution check (handbook section 4.1), secret scan, dependency audit | Always |
| `unit` | Unit, harness, and component tests with coverage | Code changes |
| `db` | Starts the local Supabase stack, applies every migration to an empty database, runs policy and integration tests | `supabase/` or server code changes |
| `build` | Production build, bundle secret check, runtime size check | Code changes |
| `e2e` | Journeys and axe checks on Chromium against the built app and the local stack | Code changes |

The workflow also runs when a pull request's title or description is edited, so the attribution check always sees the final text.

Rules for the workflows are in `.claude/rules/ci.md`: actions pinned by commit, least-privilege permissions, a timeout on every job, frozen lockfile, no secrets in pull request jobs.

### 2.2 On `main`

- The full end-to-end suite on Chromium, Firefox, and WebKit.
- The deploy workflow of section 3.

## 3. Delivery

`main` is always deployable. A merge to `main` goes to production through one ordered workflow. The hosting provider's automatic production deploy is turned off so that the order below is guaranteed. Preview deployments stay automatic.

```mermaid
flowchart LR
  merge[merge to main] --> stg[apply migrations to staging]
  stg --> gate{contains a migration}
  gate -- yes --> approve[owner approves]
  gate -- no --> prod
  approve --> prod[apply migrations to production]
  prod --> deploy[deploy the app]
  deploy --> smoke[smoke production]
  smoke -- fail --> rollback[promote the previous deployment and alert]
```

1. Apply migrations to staging.
2. If the change contains a migration, wait for the owner's approval in the production environment. Otherwise continue.
3. Apply migrations to production, then deploy the app. The database always moves first.
4. Smoke production: the health endpoint, the home page, one lesson page, one runtime file, the response headers.
5. On failure, promote the previous deployment and alert the owner.

> **Approved by the owner on 2026-11-20 (proposed in WP-1.3, pull request #4):** the owner approves every production deploy, not only one that contains a migration. A GitHub environment's required reviewer applies to every job that names the environment, so approving only migrations needs a fourth environment. Accepting this changes step 2, the diagram, and `.claude/rules/ci.md`; rejecting it means adding the fourth environment.

### 3.1 Database changes

- Forward-only migrations. An applied migration is never edited.
- **Expand, then contract.** A change that the previous app version could not work with is split: first add, deploy code that uses both, then remove in a later change. Every migration's pull request states whether the previous app version still works with it.
- Migrations are tested from an empty database on every pull request.
- No command is ever run against the production project from a working machine. Production changes happen in the deploy workflow. The one exception is the owner adding his own admin row, by the runbook.

### 3.2 Rollback

- App: promote the previous deployment. Target: within 5 minutes (NFR-REL-04). The owner practices it once in WP-7.3.
- Database: not rolled back. Because of expand and contract, the previous app version works against the new schema. A bad migration is fixed forward.
- Lessons: a lesson that turns out wrong is unpublished or archived in the dashboard, at once, with no deploy.

## 4. Observability

### 4.1 Logs

Structured JSON on the server: request ID, action or route, outcome code, duration. No email, name, or learner code (NFR-PRIV-03). A server error is logged with its digest next to the request ID, and the error page shows the digest so a learner can quote it (NFR-OBS-01). A browser error shows the request ID of its report to `/api/client-error` once the report is stored, and no reference if the report fails (approved by the owner on 2026-11-24, WP-7.3 decision B).

### 4.2 Errors

Server errors are logged with the request ID and the release version. Client errors are sent to `/api/client-error` with the release version, the route, and a short error code: runtime failed to load, worker crashed, an unexpected exception. No message text from learner code is sent. The release is the browser bundle's, inlined at build as `NEXT_PUBLIC_HEAP_RELEASE`; the log line carries it as `clientRelease` next to the server's own `release`, so a tab still on an older bundle after a deploy is logged under the code it runs (approved by the owner on 2026-11-24, WP-7.3 decisions A and B).

### 4.3 Analytics

The hosting provider's analytics, which uses no cookies: page views and Core Web Vitals. No custom events in this release.

### 4.4 Uptime

An external uptime service checks `/api/health` every few minutes and emails the owner when it fails (NFR-OBS-04). The owner creates it in WP-7.3.

## 5. Service levels

This release sets no formal objectives. It has three numbers the owner looks at each morning for the first two weeks: uptime from the uptime service, client error reports by code, and sign-in failures in the auth provider's log. Objectives are set from that data.

## 6. Backup and recovery

- A nightly workflow dumps production through the session pooler as a read-only role, pipes the dump into `age` to the owner's public key, attests the ciphertext, and keeps it as a workflow artifact for 7 days (ADR-0030). Free projects have no provider backups (E-24), and the repository is public, so nothing unencrypted is uploaded.
- A heartbeat monitor on a free tier emails the owner when `backup.yml` has not reported success for 26 hours. The ping URL is a masked secret of `production-backup`, pinged only after the upload and the attestation succeed (ADR-0030).
- When FR-ADM-12 is built, a course export is a second copy of the lessons that the owner keeps himself.
- Schema, policies, and configuration are in Git.
- Recovery point 24 hours. Recovery time 4 hours.
- **Restore drill**: in WP-7.3 the owner restores the latest attested backup into a local stack on a separate machine without Claude Code, by the runbook, and runs the verification script (table counts, one known lesson, policy checks). A backup that has never been restored is not a backup.

## 7. Rate limits

Starting values. Every write is also bounded by a database key or a size check, which is the last line.

| What | Limit | Where |
|---|---|---|
| Email code requests | The provider's limits (one resend per 60 seconds per address, a project-wide cap of 20 an hour) and a bot challenge | Auth provider |
| Every request, including `/runtime/*` | A per-address limit set in WP-7.1 from the measured page and runtime request counts | The host's firewall: the one rate-limit rule of a Hobby project (E-23) |
| Each server action and report endpoint | 120 per minute per network address, lower for sign-in and deletion | Postgres counters in the action wrapper |
| Report endpoints | Body at most 8 kB | Handler |

A Hobby project has one rate-limit rule, which counts by network address in a fixed window, with 1,000,000 allowed requests included (E-23). Vercel does not state the period of that amount or what happens when it is used up; ADR-0029's trigger reads it as a month, like the other Hobby figures. One rule cannot carry every limit, so WP-7.1 builds both: the firewall rule on every path, and a small counter table in Postgres used by the action wrapper for per-action limits. The counter table follows T-14 in `06-security-privacy.md`. The action wrapper sends the client address with an HMAC made from a server-only secret; the counter function checks it against the same secret in Supabase Vault, so a direct call through the Data API with the public key cannot choose a key or write a row.

Provider settings to configure in WP-2.2: Resend free as the custom email sender (the built-in one is limited to 2 emails per hour, E-11; Resend free allows 100 a day, E-26), the custom-sender hourly limit set to 20 (default 30, E-24) so one burst cannot use the whole day, sign-in rate limits, the bot challenge, code lifetime, and the email template that shows a code.

## 8. Incidents

| Severity | Meaning | Response |
|---|---|---|
| S1 | Learners cannot open or run lessons, or data is at risk | Act immediately. Roll back first, investigate second. |
| S2 | Sign-in, sync, or the dashboard is degraded | Same day. |
| S3 | Minor defect or a single lesson | Next working session. A wrong lesson is unpublished at once. |

Every S1 and S2 gets a short, blameless write-up in `docs/reports/incidents/`: timeline, cause, what limited the damage, what will change.

### 8.1 Runbooks

Each is a numbered procedure in `docs/runbooks/`, written in the work package that introduces the thing it covers.

| Runbook | Written in |
|---|---|
| Infrastructure setup from zero | WP-1.3 |
| Deploy and roll back | WP-1.3 |
| Make the owner an admin | WP-2.3 |
| The owner lost the authenticator | WP-2.3 |
| Sign-in or email provider outage | WP-2.2 |
| A published lesson is wrong | WP-4.3 |
| Restore from backup | WP-7.3 |
| Rotate a secret | WP-7.3 |
| Usage spike or a free-tier limit reached | WP-7.3 |
| A learner asks by email to delete their data | WP-7.3 |

## 9. Cost and vendor limits

Facts checked on 2026-11-13 and 2026-11-15 (see `09-evidence.md`). Limits change; the day check compares usage with them.

| Vendor | Plan | Limit that matters | Watch |
|---|---|---|---|
| GitHub | Free, public repository (ADR-0029) | Branch protection is available on public repositories (E-14). Actions minutes are free for public repositories; artifact storage is 500 MB (E-25). | Artifact storage used by backups |
| Vercel | Hobby (ADR-0029) | Personal or non-commercial use only; the terms do not define commercial use. Per month: 100 GB fast data transfer, 1,000,000 function invocations, 4 active CPU-hours. Past a limit the feature waits up to 30 days; nothing is billed (E-23). | All three monthly figures |
| Supabase | Free for staging and production (ADR-0029) | 500 MB database, 5 GB egress, 50,000 monthly active users. Paused after one week of inactivity. No provider backups (E-24). | Database size, egress, any pause |
| Resend | Free (ADR-0029) | 100 emails a day, 3,000 a month (E-26). | Daily sends |
| Bot challenge, uptime check | Free tiers | | |
| Domain | The only paid item | Needed on Day 1 for email sending and Google sign-in. | Renewal |

### 9.1 The costs that scale with success

- **Runtime transfer.** The Python runtime is about 5.5 MB per new learner with Brotli (E-02). It is cached permanently after the first visit. Ten thousand new learners in a month is about 55 GB of transfer.
- **Page rendering.** Every page view runs a function, because pages are rendered per request (ADR-0028). Lesson content comes from the data cache, so a view costs rendering time and usually no database query.

Both show on the host's usage page. That page is the number to watch after a video does well: on Hobby, a limit reached takes the feature offline for up to 30 days instead of raising a bill.

### 9.2 Scale triggers

The triggers that move a vendor to its paid plan are in ADR-0029. Within the free tiers:

| When | Do |
|---|---|
| Runtime transfer passes 50 GB in a month | Point `RUNTIME_ASSET_BASE_URL` at an object store with no egress fees behind a CDN. No code change. |
| Function invocations or active CPU pass half of the Hobby amount | Move public pages to static rendering with a hash-based script policy (ADR-0028 describes the route), or move to Vercel Pro (ADR-0029). |
| Monthly active users pass 40,000, the database passes 400 MB, or production pauses | Move production to Supabase Pro (ADR-0029). |
| Email sends pass 80 in a day | Move to a paid email plan before the next campaign. |

## 10. Launch readiness for a traffic spike

Heap's traffic arrives in bursts when a video spreads. Before launch:

- A lesson page view with a warm cache makes no database query. A test proves it.
- The request proxy does no network work without a session cookie, and fails open if the auth service is slow.
- Runtime files are served with immutable caching from the host's CDN.
- The firewall rate limit is on.
- Usage notifications are on at every vendor that offers them, and the free-tier figures are in the morning review (NFR-COST-02).
- The owner has rolled back once and restored once, each from the runbook.
