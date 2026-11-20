# Runbook: sign-in or email provider outage

What to do when learners cannot sign in. Sign-in depends on three services outside the app: Supabase Auth (sessions, Google, codes), Resend (the email that carries the code), and Cloudflare Turnstile (the bot challenge on a code request). Google is a fourth for Google sign-in only. Severity follows `docs/spec/07-operations.md` section 8.

Learning never depends on sign-in. A guest keeps learning, and progress waits on the device (ADR-0011). So an outage of sign-in alone is an S2, not an S1, unless it blocks the admin from fixing a wrong published lesson.

## 1. Find which part is down

1. [ ] Note the time.
2. [ ] Try both methods yourself on `https://heapacademy.dev/sign-in`, in a private window.
   - Google fails, email code works: go to section 2.
   - The code request fails, or the email never arrives: go to section 3.
   - The code arrives but is refused: go to section 4.
   - Both fail, or every page is slow: go to section 5.
3. [ ] Check each provider's status page: Supabase, Resend, Cloudflare, and Google Cloud. Each links it from its dashboard.
4. [ ] Read the app's log lines for the sign-in actions in the Vercel dashboard, under **Logs**: search for `POST /actions/request-email-code` or `POST /actions/verify-email-code`. The `outcome` says which answer the provider gave: `error:rate-limited`, `error:challenge-failed`, `error:unavailable`, `error:code-rejected`. A line never holds an address or a code.

## 2. Google sign-in fails

1. [ ] If Google's status page shows an incident, wait. Email codes still work, and the sign-in page offers them.
2. [ ] Otherwise, open Google Cloud console → **Google Auth Platform → Clients** → the `heap-academy` client. Check that the redirect URIs still list `https://<prod-ref>.supabase.co/auth/v1/callback` (and the staging one), and that the client secret has not been deleted or rotated.
3. [ ] In Supabase production, **Authentication → Sign In / Providers → Google**: on, with the same client ID and secret. If you rotated the secret in Google, paste the new one here.
4. [ ] **Authentication → URL Configuration**: the redirect URLs list `https://heapacademy.dev/auth/callback`. A missing entry sends learners to the site address without signing them in.

## 3. The code request fails, or no email arrives

1. [ ] Supabase production → the auth logs (**Logs**, the **Auth** source). Look for `over_email_send_rate_limit`: the hourly cap of 20 has been reached (ADR-0029). It resets within the hour. If real learners hit it, raise **Authentication → Rate Limits → email sends per hour** in steps of 10, and never above what Resend's 100 a day can carry (E-26). Record the change in the day report.
2. [ ] Resend dashboard → **Emails**: are codes being sent and delivered? A **bounced** or **failed** row names the reason. **Domains**: `heapacademy.dev` must still show **Verified**. If DNS changed at the registrar, add the records Resend shows again.
3. [ ] Resend dashboard → **Usage**: 100 emails a day is the free limit. Past it, no code is sent until the next day. The deletion record email to you shares the same limit.
4. [ ] Supabase → **Authentication → Emails → SMTP Settings**: host `smtp.resend.com`, port `465`, user `resend`, sender `signin@heapacademy.dev`. If you rotated the Resend key, paste the new one here and in Vercel's `RESEND_API_KEY`.
5. [ ] `error:challenge-failed` in the app's logs means the bot challenge was refused. Cloudflare dashboard → **Turnstile** → the widget: the hostnames still include `heapacademy.dev`. Supabase → **Authentication → Attack Protection**: Turnstile on, with the widget's secret key. Never turn the challenge off in production to make sign-in work (`.claude/rules/server.md`); if Turnstile itself is down, wait for it.
6. [ ] If Supabase's built-in sender must stand in while Resend is down: do not. It allows 2 emails an hour for the whole project (E-11), which helps no one. Wait for Resend.

## 4. The code arrives but is refused

1. [ ] The code works for 10 minutes and only for the last one sent. Ask yourself whether the learner used an older email.
2. [ ] Supabase → **Authentication → Sign In / Providers → Email**: **Email OTP expiration** is `600`, **Email OTP length** is `6`. A length other than 6 breaks the form, which accepts six digits.
3. [ ] **Authentication → Emails → Templates**: both **Magic link** and **Confirm signup** show `{{ .Token }}`. If one shows a link instead, paste `supabase/templates/sign-in-code.html` again.
4. [ ] `error:rate-limited` on `verify-email-code` means too many tries from one network address in five minutes. It clears by itself.

## 5. Supabase Auth is down

1. [ ] If Supabase's status page shows an incident for the project's region, wait. The site keeps serving pages: the proxy treats a visitor as signed out when the auth service cannot be reached (`docs/spec/02-architecture.md` section 11.1), so guests keep learning.
2. [ ] Signed-in learners see their progress marked as not yet saved; it syncs when the service is back (`docs/spec/02-architecture.md` section 10).
3. [ ] If the project is **Paused** (Free plan projects pause after a week without activity, `07-operations.md` section 9), press **Restore project** in the Supabase dashboard. Then check that the uptime check turns green.

## 6. After

1. [ ] Sign in with both methods once more on production.
2. [ ] Note the time. Write the incident up in `docs/reports/incidents/` for an S1 or S2 (`07-operations.md` section 8): what broke, how long, what you changed.
