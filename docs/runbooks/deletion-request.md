# Runbook: a deletion request by email

Owner only. When someone writes to the contact address of the privacy notice (`src/messages/legal.ts`, "Contact") and asks for their account or their data to be deleted.

The site already lets a learner delete their own account on the profile page, with no one's help (`06-security-privacy.md`, FR-PRF-03). That path proves who they are, because they signed in with a code sent to their address. Prefer it. Delete an account by hand only when the learner cannot use it, and only when you know the request comes from the account's own address.

Act on the request the day you read it. How long the law allows is open question 6 of `06-security-privacy.md` section 8; until the person named there answers, do not wait.

## 1. Answer with the self-service path

1. [ ] Reply from the contact address: they can delete the account themselves. Sign in at `https://heapacademy.dev/sign-in` with the account's address, open the profile page, and choose "Delete my account". It erases everything the privacy notice lists under "When you have an account", at once.
2. [ ] If they write back that it worked, or the account is gone (step 2 of section 2 finds no row), go to section 3.

## 2. Delete it for them

Only if they say they cannot use the profile page, and only if the request came from the account's own address.

1. [ ] Check the sender. In Gmail, open the message → **⋮ → Show original**: SPF and DKIM both say `PASS` for the sender's domain. If either fails, or the request came from another address than the account's, do not delete. Reply that you can act only on a request from the account's own address, or through the profile page.
2. [ ] Supabase production → **Authentication → Users** → search for the address. If there is no row, there is no account: tell them so, and stop.
3. [ ] If the row is your own account, stop. Deleting it removes your admin row (`admin-access.md`).
4. [ ] Copy the row's user ID. Then the row's menu → **Delete user** → confirm. The profile, completions and any admin row go with it (`on delete cascade`). Only what the privacy notice keeps, "the log of account events", stays.
5. [ ] Send yourself one email, to the inbox that receives the automatic deletion emails, with the subject `Account deleted` and the user ID as its only text. No name, no address. It is the record a restore needs (`restore.md` section 5).
6. [ ] Reply to them: the account is deleted. Backups taken before today still hold it, encrypted, until they expire within 7 days; if one is ever restored, the account is deleted from it again.

## 3. Afterwards

1. [ ] After 8 days, delete the `Account deleted` email you sent yourself, and the whole thread with the learner: it holds their address. By then no backup with their data is left (ADR-0030).
2. [ ] Log nothing about the request in the repository, an issue, or a report. If you need to count requests, count them without names or addresses.
