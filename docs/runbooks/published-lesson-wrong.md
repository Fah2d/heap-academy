# Runbook: a published lesson is wrong

What to do when a lesson on the site teaches something false, has a test case that refuses correct code, accepts code that is wrong, or shows text that should not be there. A single wrong lesson is an S3 (`docs/spec/07-operations.md` section 8): unpublish it at once, then fix it in the next working session. If the lesson shows something harmful or private, treat it as an S1 and do section 1 before anything else.

The rules behind this runbook: a lesson is published only after its solution passed every test case, its starter failed one, and each wrong answer failed one, since its last change (`docs/spec/04-content-system.md` section 4). The database enforces that, so a wrong lesson is wrong in a way the checklist cannot see: a mistaken expected output that the solution shares, a test case that is too strict, or wrong text. Earlier completions stand either way (section 4.4).

## 1. Take it off the site

1. [ ] Note the time, the lesson's address on the site, and what is wrong. The address has the form `https://heapacademy.dev/learn/<course-address>/<lesson-address>`.
2. [ ] Sign in on `https://heapacademy.dev/sign-in` and open `/admin`. Pass the second step at `/admin/verify` with the authenticator app. If you cannot, go to section 4.
3. [ ] Open the course, then the lesson. The lesson editor opens at `/admin/lessons/<id>`.
4. [ ] In the list of sections, choose **Publish**. Under the checklist, the **Status** group says "This lesson is published."
5. [ ] Press **Move back to draft**. The dialog says what learners will see: the lesson leaves the site, their completions are kept, and publishing it again brings it back. Press **Move back to draft** in the dialog.
   - If the dialog's warning would be wrong because the lesson should never come back, press **Archive** instead. An archived lesson is also gone from the site, and it can still be moved back to draft later.
6. [ ] The group now says "This lesson is a draft." If it shows a reason instead:
   - "The lesson's status was changed somewhere else": reload the page in the browser, then check the status it shows.
   - "This lesson was changed somewhere else after you opened it": copy anything you typed, press **Reload the page**, then repeat step 5.
   - "The status could not be changed right now": wait a minute and repeat step 5. If it keeps failing, go to section 4.
7. [ ] Leave any unsaved edits in the editor alone for now. Moving the status saves nothing else; the page still marks them unsaved.

## 2. Check that learners no longer see it

The status move expires the cached published content at once, so the next page view reads the database. A cached answer that was missed expires within 60 seconds anyway (FR-ADM-11).

1. [ ] In a private window, where you are not signed in, open the lesson's address on the site. It answers that the page was not found.
2. [ ] Open the course page, `https://heapacademy.dev/courses/<course-address>`. The lesson is gone from its chapter. On `https://heapacademy.dev/courses`, the course's lesson count is one lower.
3. [ ] If this was the course's last published lesson, the course is still published and its page shows no lesson. Either publish a fixed lesson soon (section 3), or open the course in the dashboard and press **Move back to draft** there too.
4. [ ] If the lesson is still listed after two minutes, go to section 4, step 3.

Learners who had the lesson open keep their copy until they leave the page. Their code stays on their device. Nothing they write is sent anywhere, so nothing needs cleaning up on the server.

## 3. Fix it and publish it again

1. [ ] In the lesson editor, correct what was wrong: the instructions, a test case's expected output or comparison, the solution, the starter, or the wrong answers. If a test case refused correct code, add a wrong answer that the old test case let through, so the mistake cannot return unnoticed.
2. [ ] Press **Save**.
3. [ ] Under **Publish**, press **Validate**. Every rule must say "Passed". A failed rule says what to fix; fix it and validate again.
4. [ ] Read each test case's "What the solution printed". It is the output a learner who writes the solution will get. Check it against the expected output with your own eyes: the checklist proves the solution and the test cases agree, not that both are right.
5. [ ] Press **Publish**. Publish saves the lesson as it is in the editor, then puts it on the site.
6. [ ] Repeat section 2, steps 1 and 2: the lesson opens again, and the course page lists it.
7. [ ] If you moved the course back to draft in section 2, step 3, publish the course again from its editor.

A small fix to a published lesson can also be saved without unpublishing it first: Save on a published lesson validates first and saves only after every rule passes. Use that only for a mistake that does not mislead a learner, such as a typo.

## 4. The dashboard cannot be used

1. [ ] Sign-in fails: follow `docs/runbooks/sign-in-outage.md`. The authenticator app is lost: follow `docs/runbooks/admin-access.md` section 2.
2. [ ] If the lesson must leave the site before either is solved, open the Supabase dashboard of the production project, then **SQL Editor**, and run, with the two parts of the lesson's address (section 1, step 1) in place of `course-address` and `lesson-address`:

   ```sql
   update public.lessons l
   set status = 'draft'
   from public.courses c
   where l.course_id = c.id
     and c.slug = 'course-address'
     and l.slug = 'lesson-address'
     and l.status = 'published'
   returning l.id, l.title, l.status;
   ```

   It must return exactly one row. Run it only in the dashboard, never from the development machine (CLAUDE.md rule 10). This path does not expire the cached content, so the site may show the lesson for up to 60 more seconds.
3. [ ] If the site still lists the lesson two minutes after the status changed, the cache is not expiring. Redeploy the current production deployment in Vercel (`docs/runbooks/deploy-and-rollback.md`), which starts with an empty data cache, and report it as a defect.

## 5. After

1. [ ] Note the time the lesson left the site and the time it came back.
2. [ ] In the day report, record what was wrong and how it passed the checklist. If a learner reported it, answer them by email once the fix is live.
3. [ ] For an S1, write the incident up in `docs/reports/incidents/` (`07-operations.md` section 8).
