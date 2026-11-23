# Runbook: usage spike or a free-tier limit reached

Owner only. Use it when a video spreads and traffic jumps, when a vendor emails that a limit is near or reached, when a figure in the morning review passes a trigger of ADR-0029, or when the site or sign-in stops and a limit is the likely cause.

Every vendor here is on its free plan (ADR-0029). On a free plan a limit reached does not raise a bill; the feature stops. On Vercel Hobby it can stay stopped for up to 30 days (E-23). So this runbook is about acting before a limit, and about what still works after one.

Vendor screens change. The menu names and figures below were checked against each vendor's documentation on 2026-11-24 and are listed with their sources at the end. Where a label has moved, look for the same setting nearby and correct this file in a pull request.

## 0. First five minutes

1. [ ] Note the time.
2. [ ] Find which vendor and which figure. Open, in this order:
   - Vercel → **Usage** in the sidebar: fast data transfer, function invocations, active CPU, CDN requests.
   - Supabase → the organization's **Usage** page: database size, egress, monthly active users. And the production project's home page: is it **Paused**?
   - Resend → **Settings → Usage**: emails sent today.
   - The uptime monitor and `https://<domain>/api/health`.
3. [ ] Compare each figure with the table in section 1. Go to the section for the first one over its trigger.
4. [ ] If learners cannot open or run lessons, it is an S1 (`07-operations.md` section 8). If only sign-in or email is affected, an S2. Either way, write the short incident report at the end.

## 1. The figures that matter

| Vendor | Figure | Free amount | Trigger (ADR-0029) | What stops when it is reached |
|---|---|---|---|---|
| Vercel Hobby | Fast data transfer | 100 GB a month | 50 GB | The site, for up to 30 days |
| Vercel Hobby | Function invocations | 1,000,000 a month | 500,000 | Every page (each renders per request, ADR-0028) |
| Vercel Hobby | Active CPU | 4 hours a month | 2 hours | Every page |
| Vercel Hobby | CDN requests | 1,000,000 a month | Not in ADR-0029 | Not stated by Vercel; treat like transfer |
| Supabase Free | Database size | 500 MB | 400 MB | Restrictions after a warning: read-only, or 402 on API requests |
| Supabase Free | Egress | 5 GB | 2.5 GB | Same as above |
| Supabase Free | Monthly active users | 50,000 | 40,000 (`07-operations.md` section 9.2) | Same as above |
| Supabase Free | Inactivity | Paused after 1 week | Any pause | The whole database: sign-in, progress, the dashboard |
| Resend Free | Emails | 100 a day, 3,000 a month | 80 a day | Email sign-in codes, until 00:00 UTC; Google sign-in still works |
| GitHub Free | Artifact storage | 500 MB | Not in ADR-0029 | Backups (WP-7.3, ADR-0030) |

CDN requests and GitHub artifact storage have no trigger in ADR-0029. They are listed so the morning review sees them; giving them a trigger is a change to ADR-0029, decided by you.

## 2. Vercel: a spike in transfer, invocations, or CPU

### 2.1 Is it learners or an attack?

1. [ ] Vercel → the project → **Observability** (or **Logs**) for the last hour: are the requests spread over many addresses and over lesson and course pages (a video), or concentrated on a few addresses or one path (an attack, T-25)?
2. [ ] Vercel → **Firewall** overview: the traffic chart and what the rate-limit rule (WP-7.1) is already stopping.

### 2.2 An attack: a few addresses or one path

Traffic the firewall denies, challenges, or rate-limits does not count toward transfer or CDN requests.

1. [ ] Block the addresses: **Firewall → Configure → IP Blocking → + Add IP**. Address or CIDR range, Host `<domain>`, **Add IP Block Rule → Review Changes → Publish**. Hobby allows 10 IP blocks per project.
2. [ ] A path no learner uses: **Firewall → Configure → custom rule**, condition on the request path, action **Deny** (answers 403). Hobby allows 3 custom rules per project, and the rate-limit rule of WP-7.1 is one of them.
3. [ ] Many addresses, and you cannot tell learners from the attack: turn on **Attack Mode** (section 2.4).

### 2.3 Real learners

The figure that grows fastest after a video is transfer: the Python runtime is about 5.5 MB per new learner, cached after the first visit (`07-operations.md` section 9.1).

1. [ ] Work out the day the figure reaches the Hobby amount at today's rate: (amount left) / (today's use). Write it in the incident report.
2. [ ] Transfer past 50 GB: point `RUNTIME_ASSET_BASE_URL` at an object store with no egress fees behind a CDN (`07-operations.md` section 9.2). That needs a pull request and a deploy, so start it the day the trigger fires.
3. [ ] Invocations or CPU past half: the choice in ADR-0029 is static pages (ADR-0028 describes the route) or Vercel Pro. Both are your decision; static pages take days, Pro takes minutes. Decide before the limit, not after.
4. [ ] Vercel's terms allow Hobby for personal or non-commercial use only. If the spike came with anything sold or advertised, ADR-0029 says move to Pro.

### 2.4 Attack Mode

Vercel's emergency challenge. ADR-0029 and T-25 call it Attack Challenge Mode; Vercel now calls it **Attack Mode**. Free on every plan.

1. [ ] **Firewall** → the **⋯** menu at the top right of the overview → **Enable Attack Mode** → **Enable for 1 Hour** (6 and 24 hours are in the menu beside it). It turns itself off at the end.
2. [ ] What changes: every visitor sees a Vercel Security Checkpoint and passes it once an hour. Known crawlers such as Googlebot are let through. Requests it blocks do not count toward usage.
3. [ ] What breaks while it is on: services Vercel does not recognise may be blocked, which likely includes the uptime monitor and `pnpm infra:verify` from your machine. Expect an uptime alert; check the site in a browser instead. Learners in an in-app browser have not been tested against the checkpoint.
4. [ ] Turn it off from the same menu (**Disable Attack Mode**) when the traffic chart is back to normal.

### 2.5 A Vercel limit was reached

1. [ ] Vercel's notification or the **Usage** page names the feature. On Hobby, "in most cases" you wait until 30 days have passed. Nothing is billed.
2. [ ] The only ways back sooner: move to Vercel Pro (ADR-0029, your decision), or serve the site elsewhere, which is not prepared.
3. [ ] Post on Heap's channels that the site is down and when it is expected back. Do not promise a date Vercel has not given.

## 3. Supabase

### 3.1 The production project is paused

Supabase pauses a Free project after a week of inactivity, and ADR-0029 says any pause is a trigger to move production to Pro.

1. [ ] Supabase → the project's home page → **Restore project**. It is one button; a restored Free project moves to the latest minor version of Postgres. Supabase's page says a paused project can be restored for a limited window; the window it states is not consistent within the page, so restore at once.
2. [ ] When it is back: `pnpm infra:verify --url https://<domain>` passes, and you can sign in.
3. [ ] The trigger fired. Decide on Supabase Pro for production (ADR-0029) and record the decision.

### 3.2 Database size, egress, or monthly active users near the free amount

1. [ ] Organization **Usage** shows which. Database size: the project's **Database** report shows the largest tables.
2. [ ] Egress far above what learners explain (the browser reads the database directly for progress): look for one address or one key reading a lot, in the project's API logs. The browser's grants are limited to what the app calls (T-25); a pattern outside that is a finding for `security-reviewer`.
3. [ ] Over the trigger: move production to Supabase Pro (ADR-0029), your decision. Restrictions on Free come after a warning and lift at the start of the next billing cycle, or at once on upgrade.
4. [ ] Separate from the 500 MB quota: when the project's disk (2 GB on Free) reaches 95 %, Supabase makes the database read-only. Writes then fail; lessons that are already cached still show.

## 4. Resend: email codes stopped

1. [ ] Resend → **Settings → Usage**. At 100 in a UTC day, Resend refuses new emails (`daily_quota_exceeded`) and does not queue them. It resets at 00:00 UTC. At 3,000 in a month, until the month ends.
2. [ ] Learners can still sign in with Google. Email sign-in codes and the deletion record emails (ADR-0030) share the cap.
3. [ ] Supabase's project-wide cap of 20 emails an hour (`infrastructure-setup.md` section 10 step 3) limits how fast a burst uses the day. Do not raise it during a spike.
4. [ ] Over 80 in a day: move to a paid email plan before the next campaign (ADR-0029), your decision.

## 5. Web analytics and Speed Insights stopped collecting

Only when analytics is on (WP-7.3). On Hobby, Web Analytics includes 50,000 events a month across every project of the account; past that, collection pauses. Speed Insights includes 10,000 events over a rolling 30 days; past that, Vercel pauses collection for at least 14 days. The site is not affected. Note the date in the morning review; nothing else to do.

## 6. GitHub artifact storage

Only when the backup workflow exists (WP-7.3, ADR-0030). Each backup is kept 7 days. If storage nears 500 MB, a failed backup run is the first sign; the heartbeat monitor emails you after 26 hours without a success. Delete old artifacts under **Actions →** the backup workflow **→ a run → Artifacts**, and check that the database's growth explains the size.

## After the spike

- [ ] Every figure from section 0 step 2, with the time, in `docs/reports/incidents/` for an S1 or S2 (`07-operations.md` section 8): timeline, cause, what limited the damage, what will change.
- [ ] Any trigger that fired, and what you decided, recorded in a pull request against ADR-0029 if a plan changed.
- [ ] Attack Mode is off, and every IP block or custom rule you added is still wanted. Remove the ones that are not.

## Sources, checked on 2026-11-24

- Vercel: [Hobby plan](https://vercel.com/docs/plans/hobby) (last updated 2026-11-12), [manage and optimize usage](https://vercel.com/docs/pricing/manage-and-optimize-usage), [notifications](https://vercel.com/docs/notifications), [Attack Mode](https://vercel.com/docs/vercel-firewall/attack-mode) (last updated 2026-08-11), [firewall concepts](https://vercel.com/docs/vercel-firewall/firewall-concepts), [WAF usage and pricing](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing), [custom rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules), [IP blocking](https://vercel.com/docs/vercel-firewall/vercel-waf/ip-blocking), [Web Analytics limits](https://vercel.com/docs/analytics/limits-and-pricing), [Speed Insights limits](https://vercel.com/docs/speed-insights/limits-and-pricing).
- Supabase: [billing FAQ](https://supabase.com/docs/guides/platform/billing-faq), [database size](https://supabase.com/docs/guides/platform/database-size), [egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [monthly active users](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users), [upgrading and restoring](https://supabase.com/docs/guides/platform/upgrading).
- Resend: [account quotas and limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits).
- GitHub: [billing for Actions](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions).

Not found in the documentation read: the thresholds at which Vercel sends usage notifications on Hobby (they are on by default and cannot be changed on Hobby), whether Hobby can pause a project, what Vercel stops when CDN requests run out, what GitHub does on Free at 500 MB of artifacts, how long Supabase keeps a paused Free project restorable, and whether Resend sends usage warnings.
