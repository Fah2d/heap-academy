# Runbook: usage spike or a free-tier limit reached

Owner only. Use it when a video spreads and traffic jumps, when a vendor emails that a limit is near or reached, when a figure in the morning review passes a trigger of ADR-0029, or when the site or sign-in stops and a limit is the likely cause.

Every vendor here is on its free plan (ADR-0029). On a free plan a limit reached does not raise a bill; the feature stops. On Vercel Hobby it can stay stopped for up to 30 days (E-23). So this runbook is about acting before a limit, and about what still works after one.

Some steps name a thing a later work package builds; each says which. Until it is merged, skip that step.

Vendor screens change. The menu names and figures below were checked against each vendor's documentation on 2026-11-24 and are listed with their sources at the end. Where a label has moved, look for the same setting nearby and correct this file in a pull request.

## 0. First five minutes

1. [ ] Note the time.
2. [ ] Find which vendor and which figure. Open, in this order:
   - Vercel → **Usage** in the sidebar: fast data transfer, fast origin transfer, function invocations, active CPU, provisioned memory, CDN requests, and the rate-limit rule's allowed requests once WP-7.1 has created the rule. Where that last figure is shown is not verified; if it is not on **Usage**, read it on the **Firewall** overview.
   - Supabase → the organization's **Usage** page: database size, egress, monthly active users. And each project's home page: is production or staging **Paused**?
   - Resend → **Settings → Usage**: emails sent today and this month.
   - `https://<domain>/api/health`, and the uptime monitor once you have created it (an owner action of WP-7.3). Until WP-2.1 merges, the health answer does not check the database.
3. [ ] Compare each figure with the table in section 1. Go to the section for the first one over its trigger.
4. [ ] Decide the severity (`07-operations.md` section 8). Learners cannot open or run lessons: S1. Only sign-in, email, or the dashboard is affected: S2. A paused production database is an S1. Either way, write the short incident report at the end.

## 1. The figures that matter

| Vendor | Figure | Free amount | Trigger | What stops when it is reached |
|---|---|---|---|---|
| Vercel Hobby | Fast data transfer | 100 GB a month | 50 GB (ADR-0029) | The site, for up to 30 days |
| Vercel Hobby | Fast origin transfer | 10 GB a month | 5 GB (ADR-0029) | Every page: each renders per request (ADR-0028) and its response counts here, so this may be the first Hobby limit reached |
| Vercel Hobby | Function invocations | 1,000,000 a month | 500,000 (ADR-0029) | Every page |
| Vercel Hobby | Active CPU | 4 hours a month | 2 hours (ADR-0029) | Every page |
| Vercel Hobby | Provisioned memory | 360 GB-hours a month | 180 GB-hours (ADR-0029) | Every page |
| Vercel Hobby | CDN requests | 1,000,000 a month | 500,000 (ADR-0029) | Not stated by Vercel; treat it like transfer |
| Vercel Hobby | Allowed requests of the rate-limit rule (from WP-7.1) | 1,000,000; Vercel does not state the period, read here as a month | 500,000 (ADR-0029) | Not stated by Vercel. Plan for the rule to stop limiting, which leaves only the per-action limits of `07-operations.md` section 7 |
| Supabase Free | Database size | 500 MB | 400 MB (ADR-0029) | Restrictions after a warning: read-only, or 402 on every API request |
| Supabase Free | Egress | 5 GB | 2.5 GB (ADR-0029) | Same as above |
| Supabase Free | Monthly active users | 50,000 | 40,000 (ADR-0029) | Same as above |
| Supabase Free | Inactivity | Paused after 1 week | Any pause of production (ADR-0029) | The whole database: lessons that are not cached, sign-in, progress, the dashboard |
| Resend Free | Emails | 100 a day, 3,000 a month | 80 a day, 1,500 a month (ADR-0029) | Email sign-in codes until 00:00 UTC (or the month's end); Google sign-in still works |
| GitHub Free | Artifact storage | 500 MB | 250 MB (ADR-0029); ADR-0030 is also revisited when a dump passes 50 MB | Backups (later parts of WP-7.3, ADR-0030) |

Every trigger is in ADR-0029, amended on 2026-11-24 with the owner's approval (WP-7.3 decision D): half of each free amount where no other figure was set. The rate-limit row is from WP-7.3 decision N, which awaits the owner's approval.

## 2. Vercel: a spike in transfer, invocations, or CPU

### 2.1 Is it learners or an attack?

1. [ ] Vercel → the project → **Observability** (or **Logs**) for the last hour: are the requests spread over many addresses and over lesson and course pages (a video), or concentrated on a few addresses or one path (an attack, T-25)?
2. [ ] Vercel → **Firewall** overview: the traffic chart, and what the rate-limit rule is stopping once WP-7.1 has created it.

### 2.2 An attack: a few addresses or one path

Traffic the firewall denies, challenges, or rate-limits does not count toward transfer or CDN requests.

1. [ ] Block the addresses: **Firewall → Configure → IP Blocking → + Add IP**. Address, Host `<domain>`, **Add IP Block Rule → Review Changes → Publish**. Hobby allows 10 IP blocks per project. Block single addresses, not wide ranges: a mobile carrier puts many learners behind one range.
2. [ ] A path no learner uses: **Firewall → Configure → custom rule**, condition on the request path, action **Deny** (answers 403). Hobby allows 3 custom rules per project. Never edit or remove the rate-limit rule of WP-7.1 to free a slot.
3. [ ] Add no bypass rule of any kind; Hobby allows none for addresses, and a bypass would let traffic past the rate limit.
4. [ ] Many addresses, and you cannot tell learners from the attack: turn on Attack Mode (section 2.4).

### 2.3 Real learners

The figure that grows fastest after a video is likely transfer: once WP-3.1 ships the Python runtime, it is about 5.5 MB per new learner, cached after the first visit (`07-operations.md` section 9.1). Origin transfer grows with every page view.

1. [ ] Work out the day the figure reaches the free amount at today's rate: (amount left) / (today's use). Write it in the incident report.
2. [ ] Transfer past 50 GB: `07-operations.md` section 9.2 says to point `RUNTIME_ASSET_BASE_URL` at an object store with no egress fees behind a CDN, with no code change. That variable does not exist yet (WP-3.1 builds the runtime files), and a runtime on another origin changes the page and worker script policies (`'self'` today) and T-13's "served by us". So it is a pull request with a `security-reviewer` review, probably an ADR, and a deploy. Start it the day the trigger fires.
3. [ ] Invocations, CPU, origin transfer, or memory past half: the choice is static pages (`07-operations.md` section 9.2; ADR-0028 describes the route) or Vercel Pro (ADR-0029). Both are your decision; static pages take days, Pro takes minutes. Decide before the limit, not after.
4. [ ] Vercel's terms allow Hobby for personal or non-commercial use only. If the spike came with anything sold or advertised, ADR-0029 says move to Pro.

### 2.4 Attack Mode

Vercel's emergency challenge, formerly called Attack Challenge Mode (E-27). It is free on every plan. Every visitor sees a Vercel Security Checkpoint and passes it once an hour; known crawlers such as Googlebot are let through; requests it blocks do not count toward usage. Services Vercel does not recognise may be blocked, which likely includes the uptime monitor, `pnpm infra:verify`, and the Deploy workflow's smoke step, which runs from a GitHub runner. Learners in an in-app browser have not been tested against the checkpoint.

1. [ ] **Firewall** → the **⋯** menu at the top right of the overview → **Enable Attack Mode** → **Enable for 1 Hour** (6 and 24 hours are in the menu beside it). It turns itself off at the end.
2. [ ] While it is on, merge nothing and re-run no Deploy: the smoke step would likely fail and the job would roll production back.
3. [ ] Expect an uptime alert. Check the site in a browser instead.
4. [ ] Turn it off from the same menu (**Disable Attack Mode**) when the traffic chart is back to normal.

### 2.5 A Vercel limit was reached

1. [ ] Vercel's notification or the **Usage** page names the feature. On Hobby, "in most cases" you wait until 30 days have passed. Nothing is billed.
2. [ ] The only ways back sooner: move to Vercel Pro (ADR-0029, your decision), or serve the site elsewhere, which is not prepared.
3. [ ] Post on Heap's channels that the site is down and when it is expected back. Do not promise a date Vercel has not given.

## 3. Supabase

### 3.1 The production project is paused

Supabase pauses a Free project after a week of inactivity, and ADR-0029 says any pause of production is a trigger to move it to Pro. This is unpausing the project, not the restore-from-backup runbook.

1. [ ] Supabase → the project's home page → **Restore project**. It is one button; a restored Free project moves to the latest minor version of Postgres. Supabase's page says a paused project can be restored for a limited window, and states that window inconsistently, so restore at once.
2. [ ] When it is back: `pnpm infra:verify --url https://<domain>` passes. From WP-2.1 the health answer checks the database; from WP-5.1, also open the course list; from WP-5.2, a lesson page; from WP-2.2, sign in.
3. [ ] The trigger fired. Decide on Supabase Pro for production (ADR-0029) and record the decision.

### 3.2 The staging project is paused

A paused staging project fails the Deploy workflow's `staging migrations` job, so no production deploy can run. It is not an ADR-0029 trigger.

1. [ ] Supabase → the staging project's home page → **Restore project**.
2. [ ] Re-run the failed Deploy run, if there is one (`deploy-and-rollback.md`).

### 3.3 Database size, egress, or monthly active users near the free amount

1. [ ] Organization **Usage** shows which. Database size: the project's **Database** report shows the largest tables.
2. [ ] Egress far above what learners explain: the browser never talks to the database (`02-architecture.md` section 9, ADR-0027); every read goes through the app on Vercel. So in the project's API logs, any Data API traffic that does not come from Vercel is suspect: the publishable key is public, and anyone can call the API with it (T-25). One address reading a lot is a finding for `security-reviewer`. Vercel's firewall (section 2.2) cannot block it: those calls go straight to Supabase.
3. [ ] Over the trigger: move production to Supabase Pro (ADR-0029), your decision. Restrictions on Free come after a warning and lift at the start of the next billing cycle, or at once on upgrade.
4. [ ] Separate from the 500 MB quota: when the project's disk (2 GB on Free) reaches 95 %, Supabase makes the database read-only. Writes then fail; pages served from the data cache (from WP-5.1) still show.

## 4. Resend: email codes stopped

Email sign-in codes exist from WP-2.2; deletion record emails from account deletion (WP-6.3 part 2 and later parts of WP-7.3).

1. [ ] Resend → **Settings → Usage**. At 100 in a UTC day, Resend refuses new emails (`daily_quota_exceeded`) and does not queue them; it resets at 00:00 UTC. At 3,000 in a month, until the month ends (`monthly_quota_exceeded`).
2. [ ] Learners can still sign in with Google.
3. [ ] Supabase's project-wide cap of 20 emails an hour (`infrastructure-setup.md` section 10 step 3) limits how fast a burst uses the day. Do not raise it during a spike.
4. [ ] Deletion record emails share the cap. A deletion whose email failed is still done, but a restore in that window must be checked by hand (ADR-0030). Note the dates the cap was reached, for the restore runbook.
5. [ ] Over 80 in a day: move to a paid email plan before the next campaign (ADR-0029), your decision.

## 5. Web Analytics and Speed Insights stopped collecting

Only once analytics is on (WP-7.3, decision pending). The site is not affected.

1. [ ] Web Analytics: Hobby includes 50,000 events a month across every project of the account; past that, collection pauses. Speed Insights: 10,000 events over a rolling 30 days; past that, Vercel pauses collection for at least 14 days.
2. [ ] Note the dates in the morning review. Nothing else to do.

## 6. GitHub artifact storage

Only once the backup workflow exists (later parts of WP-7.3, ADR-0030). Each backup is kept 7 days. GitHub's documentation does not say what happens on Free at 500 MB, and storage already counted in the cycle "remains in your total" after deletion, so deleting artifacts may not help.

1. [ ] Watch the dump size in each backup run. ADR-0030 is revisited when a dump passes 50 MB, long before 500 MB; act then.
2. [ ] If a backup run fails on storage and deleting cannot be avoided: **Actions →** the backup workflow **→** the oldest run **→ Artifacts** → delete that one only. Never delete the newest attested scheduled backup.
3. [ ] Check that the database's growth explains the size.

## After the spike

- [ ] Every figure from section 0 step 2, with the time, in `docs/reports/incidents/` for an S1 or S2 (`07-operations.md` section 8): timeline, cause, what limited the damage, what will change.
- [ ] Any trigger that fired, and what you decided, recorded in a pull request against ADR-0029 if a plan changed.
- [ ] Attack Mode is off, and every IP block or custom rule you added is still wanted. Remove the ones that are not.

## Sources, checked on 2026-11-24

- Vercel: [Hobby plan](https://vercel.com/docs/plans/hobby) (last updated 2026-11-12), [manage and optimize usage](https://vercel.com/docs/pricing/manage-and-optimize-usage), [notifications](https://vercel.com/docs/notifications), [Attack Mode](https://vercel.com/docs/vercel-firewall/attack-mode) (last updated 2026-08-11), [firewall concepts](https://vercel.com/docs/vercel-firewall/firewall-concepts), [WAF usage and pricing](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing), [custom rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules), [IP blocking](https://vercel.com/docs/vercel-firewall/vercel-waf/ip-blocking), [Web Analytics limits](https://vercel.com/docs/analytics/limits-and-pricing), [Speed Insights limits](https://vercel.com/docs/speed-insights/limits-and-pricing).
- Supabase: [billing FAQ](https://supabase.com/docs/guides/platform/billing-faq), [database size](https://supabase.com/docs/guides/platform/database-size), [egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [monthly active users](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users), [upgrading and restoring](https://supabase.com/docs/guides/platform/upgrading).
- Resend: [account quotas and limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits).
- GitHub: [billing for Actions](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions).

Not found in the documentation read: the thresholds at which Vercel sends usage notifications on Hobby (they are on by default and cannot be changed on Hobby), whether Hobby can pause a project, what Vercel stops when CDN requests or provisioned memory run out, what GitHub does on Free at 500 MB of artifacts, how long Supabase keeps a paused Free project restorable, and whether Resend sends usage warnings. The figures this runbook relies on are in `09-evidence.md` E-27.
