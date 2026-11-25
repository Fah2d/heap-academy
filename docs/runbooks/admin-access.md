# Runbook: admin access

How the owner becomes the admin, what to do when the authenticator app is lost, and how to remove an admin. The design is in `docs/spec/02-architecture.md` section 11.2 and ADR-0025: an admin is a row in `public.admins` **and** a session at assurance level `aal2`, which Supabase sets only after a code from an authenticator app. No screen grants or removes admin rights; this runbook is the only way.

Run every SQL step in the Supabase dashboard of the project named in the step, under **SQL Editor**. Never run it from the development machine (CLAUDE.md rule 10).

## 1. Make the owner the admin (once per project)

Do this on production after WP-2.3 is merged, and on staging if you want to use the dashboard on previews.

1. [ ] Check that **Authentication → Multi-Factor** shows **TOTP (App Authenticator)** enabled for enrollment and verification (`docs/runbooks/infrastructure-setup.md` section 10 step 8).
2. [ ] Sign in on the site of that project (`https://heapacademy.dev/sign-in` for production) with Google or an email code, using the address you will use as the admin. This creates your user.
3. [ ] Sign out every other session of that user, so only the browser in front of you can add an authenticator once you are on the list. In **SQL Editor**, replace the address and run:

   ```sql
   delete from auth.sessions
   where user_id = (select id from auth.users where email = 'you@example.com');
   ```

   Then sign in again in the same browser (step 2).
4. [ ] In **SQL Editor**, replace the address and run:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com'
   returning user_id;
   ```

   It must return exactly one row. No row means the address has not signed in yet, or is spelled differently: check **Authentication → Users**.
5. [ ] Check that you are the only admin:

   ```sql
   select a.user_id, u.email, a.created_at
   from public.admins as a join auth.users as u on u.id = a.user_id;
   ```

6. [ ] Open `/admin` on the site. You must be sent to `/admin/setup`. **If you are sent to `/admin/verify` instead, stop**: an authenticator is already on your user that you did not add. Go to section 2, steps 1 and 2, then start again here.
7. [ ] Press **Show the QR code**. Scan it with your authenticator app (or type the key shown under it), then enter the six-digit code the app shows and press **Finish setup**. The dashboard opens. Each press makes a new QR code and replaces any you did not finish.
8. [ ] Check that your user has exactly one verified factor:

   ```sql
   select factor_type, status, created_at from auth.mfa_factors
   where user_id = (select id from auth.users where email = 'you@example.com');
   ```

   One row, `totp`, `verified`. Any other row: remove it (section 2 step 2) and repeat from step 6.
9. [ ] Keep the key somewhere safe outside this machine only if your app has no backup of its own. Anyone with the key and a session of yours can pass the second step.
10. [ ] Sign out, sign in again, and open `/admin`: you are now asked for a code at `/admin/verify`. This happens at the start of every session.
11. [ ] In a private window, signed out, open `/admin`, `/admin/setup` and `/admin/verify`: each shows the standard not-found page.

## 2. The authenticator app is lost, reset, or on a stolen phone

You cannot pass `/admin/verify` without the app, and the dashboard has no way around it. You still can sign in as a learner, and learning is not affected.

1. [ ] If the phone was stolen, first sign out every session of your user, so a session that already passed the second step stops being renewed. In **SQL Editor** of the project:

   ```sql
   delete from auth.sessions
   where user_id = (select id from auth.users where email = 'you@example.com');
   ```

   An access token already issued stays valid until it expires (the project's JWT expiry, one hour by default).
2. [ ] Remove the lost factor. In **Authentication → Users**, open your user and remove its MFA factor, or run:

   ```sql
   delete from auth.mfa_factors
   where user_id = (select id from auth.users where email = 'you@example.com');
   ```

3. [ ] Sign in again and open `/admin`. With no factor you are sent to `/admin/setup`: follow section 1 from step 7.
4. [ ] Note the time and the reason in the day report.

If you also lost access to your email account and to Google, recover those first: the second step protects the dashboard only together with your sign-in (T-19).

## 3. Remove an admin

1. [ ] In **SQL Editor**:

   ```sql
   delete from public.admins
   where user_id = (select id from auth.users where email = 'them@example.com')
   returning user_id;
   ```

2. [ ] The change applies to their next request: every admin policy asks `private.is_admin()` on every statement. Their open dashboard page refuses every read and write, and `/admin` shows them the not-found page.

## 4. Someone may be guessing codes

The provider limits code checks per network address only (Supabase "Rate limits", read 2026-11-21). A person who has one of your sessions, from a phished email code for example, can call the provider directly from many addresses and keep guessing. This is a residual risk the owner accepted on 2026-11-24 (decision 2 in the WP-2.3 description), recorded in `docs/spec/06-security-privacy.md` section 6.

1. [ ] Weekly, and whenever you get a sign-in email you did not ask for: Supabase production → **Logs**, the **Auth** source, search `mfa_verification_failed`. A handful from your own typing is normal. Many in a day, or any when you were not signing in, means someone is guessing.
2. [ ] Then sign out every session of your user (section 2 step 1), change the password of your email account, and check its own second step. Removing and adding the authenticator again (section 2) gives a new key.

## 5. Things that look wrong but are not

- **"Too many tries. Wait a minute, then enter a new code."** The provider allows 15 code checks a minute, with bursts up to 30, counted per network address (Supabase "Rate limits", read 2026-11-21). The address it sees is the app server's, so the limit is shared by every admin session. Wait a minute.
- **The not-found page at `/admin` while signed in.** You are signed in with a different address, your admin row is missing (section 1 step 4), or the auth service could not be reached and the site treats you as signed out (`docs/runbooks/sign-in-outage.md`).
- **"The second sign-in step is not working right now."** The auth service answered with an error. Check the Supabase status page and the auth logs (**Logs**, the **Auth** source). `mfa_ip_address_mismatch` there means the provider saw the challenge and the answer come from two server addresses: try again.
